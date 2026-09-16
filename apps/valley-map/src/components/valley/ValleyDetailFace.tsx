/**
 * 시트 뒷면 — 구간 상세. `festival/SpotDetailFace` 의 계곡판.
 *
 * 구조
 *   eyebrow(상류/중류/하류) + 계곡명 + 닫기
 *   → 부제 한 줄("중류 · 허리 · 자갈 · 주차장 320m")
 *   → CTA: 길찾기(primary, 외부 지도) · 닫기(ghost)
 *   → [경고 박스: 물놀이 금지 / riskNote]
 *   → 정보 타일 2×2: 수심 · 바닥 · 접근(거리·경사) · 난이도
 *   → 주변 시설(구간 시작점 기준 거리순, 탭 → 시설 선택; 앞의 픽토그램은 지도 핀과 같은 도형, C5)
 *   → 그늘 타일 1장 "그늘 · 14:00 기준" / "68% · 나무 많음" + 한 줄 고지(F4 결정 (f)).
 *     시각은 지도와 같다 — 그늘이 꺼져 있으면 정오(`shadeRatio` 와 같은 값이라 카드 부제와
 *     일치한다). 데이터가 없는 구간은 "정보 없음". 카드 부제는 바꾸지 않는다.
 *   → 하단 고지
 *
 * 길찾기 목적지는 가장 가까운 주차장이 있으면 그곳, 없으면 구간의 상류 끝이다 —
 * 계곡에 "가는" 길은 물가가 아니라 차를 대는 곳에서 끝나기 때문이다.
 */
import {
  accessDifficultyLabel,
  alertConfidenceLabel,
  alertMeasureTierLabel,
  bedLabel,
  canopyLevel,
  canopyLevelLabel,
  depthLabel,
  type Facility,
  facilityTypeLabel,
  lookupSegment,
  type Segment,
  SHADE_HOURS,
  SHADE_NOON_INDEX,
  type ShadeHourIndex,
  type ShadeMetadata,
  segmentPositionLabel,
  segmentSubtitle,
  shadeAmountLabel,
  shadeTags,
  type UpstreamAlert,
  type ValleyAlertState,
} from '@modu-valley/core';
import { SHADE_AMOUNT_COLORS } from '@modu-valley/map-style';
import { useCallback } from 'react';
import { Animated, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useStaggerEntrance } from '@/animation/useStaggerEntrance';
import { CloseIcon, DirectionsIcon } from '@/icons';
import { FacilityGlyph } from '@/icons/FacilityGlyph';
import { useAppState, useSession } from '@/session';
import { chmYearsLabel, formatKstHHMM, representativeDateLabel, VALLEY_COPY } from '@/theme/copy';
import { createThemedStyles } from '@/theme/ThemeProvider';
import { FONT_FAMILY } from '@/theme/theme';
import { CARD, RADII } from '@/theme/tokens';
import { InfoCardPlaceholder } from '../shell/InfoCardPlaceholder';
import { sheetStyles, useSheetThemedStyles } from '../shell/sheetStyles';
import { directionsUrl } from './directions';
import { FACILITY_GLYPH_SIZE, facilitySummary } from './FacilityRow';
import { InfoTile } from './InfoTile';
import { LandOwnershipPanel } from './LandOwnershipPanel';

/** 데모 선택자 순서와 같은 스태거 자리 — `.cta`=0, 부제/경고=1, 타일=2.. */
const CTA_STAGGER_INDEX = 0;
const RISK_STAGGER_INDEX = 1;
const INFO_STAGGER_START = 2;
/** 경보 타일(F3b) — 그늘 타일 옆(같은 줄, 2칸). */
const ALERT_STAGGER_INDEX = 6;
const SHADE_STAGGER_INDEX = 7;

export type ValleyDetailFaceProps = {
  readonly generation: number;
  /** 시트 내부 가용 폭. 2×2 정보 타일의 칸 폭을 여기서 나눈다. */
  readonly innerWidth: number;
};

export function ValleyDetailFace({ generation, innerWidth }: ValleyDetailFaceProps) {
  const session = useSession();
  const valleys = useAppState((state) => state.valleys);
  const selectedId = useAppState((state) => state.selectedSegmentId);
  const valleyShade = useAppState((state) => state.valleyShade);
  const shadeVisible = useAppState((state) => state.shadeVisible);
  const shadeHourIndex = useAppState((state) => state.shadeHourIndex);
  const alerts = useAppState((state) => state.alerts);
  const ctaEntrance = useStaggerEntrance(CTA_STAGGER_INDEX, generation);
  const riskEntrance = useStaggerEntrance(RISK_STAGGER_INDEX, generation);
  const themed = useThemedStyles();
  const sheetThemed = useSheetThemedStyles();

  const close = useCallback(() => {
    void session.clearSelection();
  }, [session]);
  const onPressFacility = useCallback(
    (facility: Facility) => {
      void session.selectFacility(facility.id);
    },
    [session],
  );

  if (valleys === null || selectedId === null) return <InfoCardPlaceholder />;
  const found = lookupSegment(valleys, selectedId);
  if (!found.ok) return <InfoCardPlaceholder />;

  const { valley, segment } = found.value;
  const nearestParking = valley.nearestFacility(segment.start, 'parking');
  const facilities = valley.facilitiesByDistance(segment.start);
  const tileWidth = (innerWidth - 8) / 2;
  const risk = riskOf(segment);
  const destination = nearestParking?.facility.position ?? segment.start;
  const shade = shadeTileOf(
    segment,
    shadeVisible ? shadeHourIndex : SHADE_NOON_INDEX,
    valleyShade?.get(valley.id)?.metadata,
  );
  const alertTile = alertTileOf(alerts?.get(valley.id));
  // 그늘 태그(N5, 결정 (e)) — 시각 무관, 종일 평균 3단계. 그늘 타일이 없으면(shadeByHour
  // 없음) 태그도 없다 — 둘 다 같은 값에서 갈린다.
  const shadeTag = shade === null ? null : shadeTags(segment);
  // 부제가 eyebrow 와 같은 한 단어("전체")뿐이면 — 1구간 계곡에 수심·바닥·주차장이 아직 없을 때 — 반복하지 않는다(SD1b).
  const subtitle = segmentSubtitle(segment, nearestParking?.distance.meters);
  const showSubtitle = subtitle !== segmentPositionLabel(segment.position);

  return (
    <View>
      <View style={[sheetStyles.headerRow, styles.headerRow]}>
        <View>
          <Text style={[styles.eyebrow, themed.eyebrow]}>
            {segmentPositionLabel(segment.position)}
          </Text>
          <Text style={[sheetStyles.title, sheetThemed.title]} accessibilityRole="header">
            {valley.name}
          </Text>
        </View>
        <Pressable
          style={[sheetStyles.roundButton, sheetThemed.roundButton]}
          dataSet={{ mv: 'round-button' }}
          accessibilityLabel={VALLEY_COPY.controlTitles.close}
          onPress={close}
        >
          <CloseIcon />
        </Pressable>
      </View>

      {showSubtitle ? <Text style={[styles.subtitle, themed.subtitle]}>{subtitle}</Text> : null}

      <Animated.View style={[sheetStyles.ctaRow, ctaEntrance]}>
        <Pressable
          style={[
            sheetStyles.ctaButton,
            sheetStyles.ctaPrimary,
            sheetThemed.ctaPrimary,
            styles.flexOne,
          ]}
          dataSet={{ mv: 'cta' }}
          accessibilityLabel={VALLEY_COPY.directionsButton}
          onPress={() => void Linking.openURL(directionsUrl(destination))}
        >
          <View style={styles.iconLabel}>
            <DirectionsIcon color={PRIMARY_LABEL_COLOR} />
            <Text style={sheetStyles.ctaPrimaryLabel}>{VALLEY_COPY.directionsButton}</Text>
          </View>
        </Pressable>
        <Pressable
          style={[
            sheetStyles.ctaButton,
            sheetStyles.ctaGhost,
            sheetThemed.ctaGhost,
            styles.flexOne,
          ]}
          dataSet={{ mv: 'cta' }}
          accessibilityLabel={VALLEY_COPY.closeButton}
          onPress={close}
        >
          <Text style={[sheetStyles.ctaGhostLabel, sheetThemed.ctaGhostLabel]}>
            {VALLEY_COPY.closeButton}
          </Text>
        </Pressable>
      </Animated.View>

      <LandOwnershipPanel valleyId={valley.id} />

      {risk === null ? null : (
        <Animated.View style={[styles.risk, themed.risk, riskEntrance]}>
          <View style={styles.riskHead}>
            <View style={[styles.riskDot, themed.riskDot]} />
            <Text style={[styles.riskTitle, themed.riskTitle]}>{risk.title}</Text>
          </View>
          {risk.note === null ? null : (
            <Text style={[styles.riskNote, themed.riskNote]}>{risk.note}</Text>
          )}
        </Animated.View>
      )}

      <View style={styles.grid}>
        {infoTiles(segment).map((tile, index) => (
          <InfoTile
            key={tile.label}
            label={tile.label}
            value={tile.value}
            width={tileWidth}
            staggerIndex={INFO_STAGGER_START + index}
            generation={generation}
          />
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[sheetStyles.sectionTitle, sheetThemed.sectionTitle, styles.sectionTitle]}>
          {VALLEY_COPY.facilitiesHeading}
        </Text>
        <Text style={[styles.sectionNote, themed.sectionNote]}>{VALLEY_COPY.facilitiesNote}</Text>
      </View>
      {facilities.length === 0 ? (
        <Text style={[sheetStyles.sectionNote, sheetThemed.sectionNote]}>
          {VALLEY_COPY.facilitiesEmpty}
        </Text>
      ) : (
        <View style={styles.facilityList}>
          {facilities.map(({ facility, distance }) => (
            <Pressable
              key={facility.id}
              style={[styles.facilityItem, themed.facilityItem]}
              dataSet={{ mv: 'facility-item' }}
              accessibilityRole="button"
              accessibilityLabel={`${facilityTypeLabel(facility.facilityType)} ${facility.name}`}
              onPress={() => onPressFacility(facility)}
            >
              <FacilityGlyph type={facility.facilityType} size={FACILITY_GLYPH_SIZE} />
              <View style={styles.facilityText}>
                <Text style={[styles.facilityType, themed.facilityType]}>
                  {facilityTypeLabel(facility.facilityType)}
                </Text>
                <Text style={[styles.facilityName, themed.facilityName]} numberOfLines={1}>
                  {facilitySummary(facility)}
                </Text>
              </View>
              <Text
                style={[styles.facilityDistance, themed.facilityDistance]}
                dataSet={{ mv: 'spot-distance' }}
              >
                {distance.format()}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* 경보(F3b) · 그늘 — 나란히 한 줄(결정: 그늘 타일 옆). 각자 제 섹션 제목을 갖는다. */}
      <View style={[styles.conditionsRow, styles.shadeTitle]}>
        <View style={{ width: tileWidth }}>
          <Text style={[sheetStyles.sectionTitle, sheetThemed.sectionTitle]}>
            {VALLEY_COPY.alertTile.heading}
          </Text>
          <InfoTile
            label={alertTile.label}
            value={alertTile.value}
            width={tileWidth}
            staggerIndex={ALERT_STAGGER_INDEX}
            generation={generation}
            pending={alertTile.pending}
          />
        </View>
        <View style={{ width: tileWidth }}>
          <Text style={[sheetStyles.sectionTitle, sheetThemed.sectionTitle]}>
            {VALLEY_COPY.shadeHeading}
          </Text>
          {shade === null ? (
            <InfoTile
              label={VALLEY_COPY.shadeHeading}
              value={VALLEY_COPY.shadePending}
              width={tileWidth}
              staggerIndex={SHADE_STAGGER_INDEX}
              generation={generation}
              pending
            />
          ) : (
            <InfoTile
              label={shade.label}
              value={shade.value}
              width={tileWidth}
              staggerIndex={SHADE_STAGGER_INDEX}
              generation={generation}
            />
          )}
          {shadeTag === null ? null : (
            <Text style={[styles.shadeTagLine, { color: SHADE_AMOUNT_COLORS[shadeTag.amount] }]}>
              {shadeAmountLabel(shadeTag.amount)}
            </Text>
          )}
        </View>
      </View>
      {alertTile.notice === null ? null : (
        <Text style={[styles.shadeNotice, themed.shadeNotice]}>{alertTile.notice}</Text>
      )}
      {shade === null ? null : (
        <Text style={[styles.shadeNotice, themed.shadeNotice]}>{shade.notice}</Text>
      )}

      <Text style={[sheetStyles.footer, sheetThemed.footer]}>{VALLEY_COPY.sampleNotice}</Text>
    </View>
  );
}

/** 경고 박스 내용. 금지 구역이면 제목이 그것이고, 아니면 안내문만 있을 때 "안전 안내". */
function riskOf(segment: Segment): { title: string; note: string | null } | null {
  const note =
    segment.riskNote !== undefined && segment.riskNote.length > 0 ? segment.riskNote : null;
  if (segment.swimBanned === true) return { title: VALLEY_COPY.swimBanned, note };
  if (note !== null) return { title: VALLEY_COPY.riskHeading, note };
  return null;
}

type AlertTile = {
  readonly label: string;
  readonly value: string;
  readonly notice: string | null;
  readonly pending: boolean;
};

/** 수위 서술 — 상승 중 > 측정 4단계 > 평시("관심 아래"). */
function waterLevelNoteOf(alert: UpstreamAlert): string {
  if ((alert.waterLevelDeltaM ?? 0) > 0) return VALLEY_COPY.alertTile.waterRising;
  if (alert.waterLevelStage !== undefined) return alertMeasureTierLabel(alert.waterLevelStage);
  return VALLEY_COPY.alertTile.waterBelowAttention;
}

/**
 * 경보 상세 타일(F3b, §4) — 그늘 타일 옆. 신선도(`stale`)가 우선이다: 자료가 오래됐으면
 * 값을 몰라도 되는 게 아니라 **모른다고 말해야** 한다(가짜 안전 금지). 활성 경보가 없으면
 * 고정된 평시 문구, 있으면 "N분 전 · 확신" + 관측값.
 */
function alertTileOf(state: ValleyAlertState | undefined): AlertTile {
  if (state?.stale === true) {
    return {
      label: VALLEY_COPY.alertTile.staleLabel(
        state.lastObservedAt === null ? '--:--' : formatKstHHMM(state.lastObservedAt),
      ),
      value: VALLEY_COPY.alertTile.staleValue,
      notice: null,
      pending: true,
    };
  }
  const alert = state?.alert;
  if (alert === null || alert === undefined) {
    return {
      label: VALLEY_COPY.alertTile.heading,
      value: VALLEY_COPY.alertTile.idleValue,
      notice: VALLEY_COPY.alertTile.notice,
      pending: false,
    };
  }
  const minutesAgo = Math.max(
    0,
    Math.floor((Date.now() - new Date(alert.observedAt).getTime()) / 60_000),
  );
  return {
    label: VALLEY_COPY.alertTile.label(minutesAgo, alertConfidenceLabel(alert.confidence)),
    value: VALLEY_COPY.alertTile.value(alert.rainfall1hMm ?? 0, waterLevelNoteOf(alert)),
    notice: VALLEY_COPY.alertTile.notice,
    pending: false,
  };
}

type ShadeTile = { readonly label: string; readonly value: string; readonly notice: string };

/**
 * 그늘 타일 내용. `shadeByHour` 가 없는 구간(그늘 미산출 계곡)은 `null` → "정보 없음".
 * 나무 밀도 3단계 임계값은 core `canopyLevel`(결정 (f)). 고지의 촬영 연도·대표일은 계곡의
 * 그늘 메타에서 — 폴리곤 합본이 없으면 그 조각을 빼고 "위성 기반 추정 · 현장과 다를 수 있습니다".
 */
function shadeTileOf(
  segment: Segment,
  hourIndex: ShadeHourIndex,
  metadata: ShadeMetadata | undefined,
): ShadeTile | null {
  const byHour = segment.shadeByHour;
  if (byHour === undefined) return null;
  const ratio = byHour[hourIndex] ?? 0;
  const cover = segment.canopyCover;
  return {
    label: VALLEY_COPY.shadeTileLabel(SHADE_HOURS[hourIndex]),
    value: VALLEY_COPY.shadeTileValue(
      ratio,
      cover === undefined ? undefined : canopyLevelLabel(canopyLevel(cover)),
    ),
    notice: VALLEY_COPY.shadeNotice(
      metadata === undefined ? undefined : chmYearsLabel(metadata.chmAcquisition),
      metadata === undefined ? undefined : representativeDateLabel(metadata.representativeDate),
    ),
  };
}

function infoTiles(segment: Segment): readonly { label: string; value: string }[] {
  const { info } = VALLEY_COPY;
  return [
    {
      label: info.depth,
      value: segment.depth === undefined ? info.unknown : depthLabel(segment.depth),
    },
    { label: info.bed, value: segment.bed === undefined ? info.unknown : bedLabel(segment.bed) },
    {
      label: info.access,
      value: VALLEY_COPY.accessValue(segment.accessDistanceM, segment.accessGradePct),
    },
    {
      label: info.difficulty,
      value:
        segment.accessDifficulty === undefined
          ? info.unknown
          : accessDifficultyLabel(segment.accessDifficulty),
    },
  ];
}

/** `sheetStyles.ctaPrimaryLabel` 과 같은 흰 글자 — accent 위라 두 테마가 같다. */
const PRIMARY_LABEL_COLOR = '#ffffff';

const styles = StyleSheet.create({
  headerRow: {
    height: 'auto',
    alignItems: 'flex-start',
  },
  eyebrow: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 3,
  },
  subtitle: {
    marginBottom: 14,
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    fontWeight: '500',
  },
  flexOne: {
    flex: 1,
  },
  iconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  risk: {
    marginBottom: 14,
    padding: 12,
    borderWidth: 1,
    borderRadius: RADII.info,
  },
  riskHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  riskDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  riskTitle: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    fontWeight: '600',
  },
  riskNote: {
    marginTop: 6,
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    lineHeight: 21,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionHeader: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    marginBottom: 0,
  },
  sectionNote: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
  },
  facilityList: {
    gap: 8,
  },
  facilityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: CARD.padding,
    borderRadius: RADII.card,
  },
  facilityText: {
    flex: 1,
  },
  facilityType: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
  },
  facilityName: {
    marginTop: 2,
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    fontWeight: '600',
  },
  facilityDistance: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
  },
  shadeTitle: {
    marginTop: 24,
  },
  /** 경보(F3b) · 그늘 두 섹션을 나란히 — 각자 제 헤더 + 타일을 세로로 쌓는다. */
  conditionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  shadeNotice: {
    marginTop: 8,
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    lineHeight: 17,
  },
  /** 그늘 태그(N5) — 색은 `SHADE_AMOUNT_COLORS` 인라인(경보 배지와 같은 이유, 의미색). */
  shadeTagLine: {
    marginTop: 6,
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fontWeight: '600',
  },
});

const useThemedStyles = createThemedStyles((theme) => ({
  eyebrow: { color: theme.colors.eyebrow },
  subtitle: { color: theme.colors.fg2 },
  risk: { backgroundColor: theme.colors.surface, borderColor: theme.colors.line2 },
  riskDot: { backgroundColor: theme.colors.live },
  riskTitle: { color: theme.colors.fg },
  riskNote: { color: theme.colors.fg2 },
  sectionNote: { color: theme.colors.fg3 },
  facilityItem: { backgroundColor: theme.colors.surface },
  facilityType: { color: theme.colors.fg3 },
  facilityName: { color: theme.colors.fg },
  facilityDistance: { color: theme.colors.fg2 },
  shadeNotice: { color: theme.colors.fg3 },
}));
