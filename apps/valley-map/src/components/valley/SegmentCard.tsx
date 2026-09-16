/**
 * 구간 카드 — 목록 면의 한 장. 제목 "중류 · 허리", 부제 "자갈 · 주차장 320m · 그늘 62%".
 *
 * 명당 행(`festival/SpotItem`)과 같은 표면(`surface`, 반경 12, 패딩 13)이지만
 * 내용이 다르다: 점·거리 대신 **제목·부제 문장**과 메타 배지. 둘 다 코어(`segmentTitle`·
 * `segmentSubtitle`)가 만든다 — web 과 네이티브가 같은 문장을 낸다.
 *
 * V1 (d) — F1 은 제목이 계곡명이라 단일 계곡에서 세 카드가 같은 제목을 반복했다. 계곡명은
 * 섹션 헤더(`ValleyListFace`)에만 두고 카드는 구간이 **어디·얼마나 깊은지**를 제목으로 말한다.
 * 접근성 라벨에는 계곡명을 남긴다 — 스크린리더는 헤더와 카드를 이어 듣지 않는다.
 *
 * 배지(무료·야영·반려견)와 접근 난이도는 있을 때만 그린다. `swimBanned` 는
 * 배지가 아니라 **경고**다 — 붉은 점(`live` 토큰)으로 눈에 먼저 걸리게 한다.
 *
 * 경보 배지(F3b, 결정 (b)(g)) — 메타 줄 **맨 앞**. 단계 3색(`ALERT_LEVEL_COLORS`, UI
 * 토큰이 아니라 두 테마가 같은 지시등 팔레트 — `markerPalette` 참고) + 확신 점
 * (●관측 ◐추정 ○특보만). 활성 경보가 없으면(`alertState.alert === null`) **아무것도
 * 그리지 않는다** — 초록 "안전" 배지를 두지 않는 것이 결정 (g).
 *
 * 그늘 태그(N5, 결정 (e)) — 경보 배지 바로 다음(경보가 없으면 메타 줄 맨 앞). 종일
 * 평균 3단계(`shadeTags`)만 그린다 — 늦은 오후 급증은 계산만 하고(결정 (c)) 이
 * 컴포넌트가 읽지 않는다. `shadeByHour` 가 없는 구간은 태그가 없다(빈 값).
 */
import {
  type AlertConfidence,
  accessDifficultyLabel,
  alertLevelLabel,
  type NearestFacility,
  type Segment,
  segmentSubtitle,
  segmentTitle,
  shadeAmountLabel,
  shadeTags,
  type Valley,
  type ValleyAlertState,
} from '@modu-valley/core';
import { ALERT_LEVEL_COLORS, SHADE_AMOUNT_COLORS } from '@modu-valley/map-style';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useStaggerEntrance } from '@/animation/useStaggerEntrance';
import { VALLEY_COPY } from '@/theme/copy';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { FONT_FAMILY } from '@/theme/theme';
import { CARD, RADII } from '@/theme/tokens';
import { Badge } from './Pill';

export type SegmentCardProps = {
  readonly valley: Valley;
  readonly segment: Segment;
  /** 구간 시작점에서 가장 가까운 주차장. 없으면 부제에서 빠진다. */
  readonly nearestParking: NearestFacility | undefined;
  /** 계곡의 경보 상태(F3b). 없거나 `alert` 가 `null` 이면 배지를 그리지 않는다. */
  readonly alertState: ValleyAlertState | undefined;
  readonly staggerIndex: number;
  readonly generation: number;
  readonly onPress: (segment: Segment) => void;
};

/** 확신 등급 점 — 관측 ● / 추정 ◐ / 특보만 ○ (결정 (b), 항상 노출). */
const CONFIDENCE_GLYPH: Readonly<Record<AlertConfidence, string>> = {
  observed: '●',
  estimated: '◐',
  regional: '○',
};

export function SegmentCard({
  valley,
  segment,
  nearestParking,
  alertState,
  staggerIndex,
  generation,
  onPress,
}: SegmentCardProps) {
  const entrance = useStaggerEntrance(staggerIndex, generation);
  const theme = useTheme();
  const themed = useThemedStyles();
  const title = segmentTitle(segment);
  const subtitle = segmentSubtitle(segment, nearestParking?.distance.meters, {
    afterTitle: true,
    shade: true,
  });
  const badges = collectBadges(segment);
  const alert = alertState?.alert ?? null;
  const shadeTag = shadeTags(segment);

  return (
    <Animated.View style={entrance}>
      <Pressable
        style={[styles.card, themed.card]}
        dataSet={{ mv: 'segment-card' }}
        accessibilityRole="button"
        accessibilityLabel={[valley.name, title, subtitle].filter(Boolean).join(' ')}
        onPress={() => onPress(segment)}
      >
        <Text style={[styles.title, themed.title]}>{title}</Text>
        {subtitle === '' ? null : (
          <Text style={[styles.subtitle, themed.subtitle]}>{subtitle}</Text>
        )}

        {badges.length > 0 || segment.swimBanned === true || alert !== null || shadeTag !== null ? (
          <View style={styles.metaRow}>
            {alert === null ? null : (
              <Badge
                label={`${CONFIDENCE_GLYPH[alert.confidence]} ${alertLevelLabel(alert.level)}`}
                textColor={ALERT_LEVEL_COLORS[alert.level]}
                borderColor={ALERT_LEVEL_COLORS[alert.level]}
                weight="700"
                dataSet={{ mv: 'alert-badge', level: alert.level }}
              />
            )}
            {shadeTag === null ? null : (
              <Badge
                label={shadeAmountLabel(shadeTag.amount)}
                textColor={SHADE_AMOUNT_COLORS[shadeTag.amount]}
                borderColor={SHADE_AMOUNT_COLORS[shadeTag.amount]}
                weight="700"
                dataSet={{ mv: 'shade-badge', amount: shadeTag.amount }}
              />
            )}
            {segment.swimBanned === true ? (
              <View style={styles.warning}>
                <View style={[styles.warningDot, themed.warningDot]} />
                <Text style={[styles.warningText, themed.warningText]}>
                  {VALLEY_COPY.swimBanned}
                </Text>
              </View>
            ) : null}
            {badges.map((badge) => (
              <Badge
                key={badge}
                label={badge}
                textColor={theme.colors.fg2}
                borderColor={theme.colors.line2}
              />
            ))}
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

/** 있을 때만 — 시딩 초기 구간은 좌표와 순서만 있다. */
function collectBadges(segment: Segment): readonly string[] {
  const badges: string[] = [];
  if (segment.accessDifficulty !== undefined) {
    badges.push(
      `${VALLEY_COPY.difficultyPrefix}${accessDifficultyLabel(segment.accessDifficulty)}`,
    );
  }
  if (segment.freeAccess === true) badges.push(VALLEY_COPY.badges.free);
  if (segment.campingAllowed === true) badges.push(VALLEY_COPY.badges.camping);
  if (segment.petAllowed === true) badges.push(VALLEY_COPY.badges.pet);
  return badges;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADII.card,
    padding: CARD.padding,
  },
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 2,
    fontFamily: FONT_FAMILY,
    fontSize: 12,
  },
  metaRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingRight: 4,
  },
  warningDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  warningText: {
    fontFamily: FONT_FAMILY,
    fontSize: 11,
    fontWeight: '600',
  },
});

const useThemedStyles = createThemedStyles((theme) => ({
  card: { backgroundColor: theme.colors.surface },
  title: { color: theme.colors.fg },
  subtitle: { color: theme.colors.fg3 },
  warningDot: { backgroundColor: theme.colors.live },
  warningText: { color: theme.colors.fg2 },
}));
