/**
 * 제보 피드 카드 — 목록 면 "실시간 정보" 섹션의 한 장(F5c, 화면 결정 (d)).
 *
 * 좌측 정사각 썸네일 56px + 본문 2줄. 사진이 없는 제보도 같은 높이를 지킨다 — 빈 자리에
 * 연필 글리프(`PenIcon`)를 놓아 "쓰인 글"임을 알린다. 카드 표면은 구간 카드(`SegmentCard`)와
 * 같다(`surface`, `RADII.card`, 패딩 13) — 시트 안에서 카드 종류가 섞여도 리듬이 같다.
 *
 * 메타 줄 = 유형 칩(`REPORT_TYPE_COLORS`, 테마별 — 화면 결정 (a)) + **상대 시각을 크게**.
 * 상대 시각은 결정 (h) 의 완화다: 자동 만료가 없는 대신, 오래된 제보인지 카드에서 항상
 * 드러낸다. 만료 표시는 없다(결정 (g)).
 *
 * **관리자 모드(OPS1)** 에서는 우상단에 "숨김" 버튼이 겹쳐 뜬다. 카드 전체를 감싸던
 * `Pressable` 을 그대로 두고 그 안에 또 `Pressable` 을 넣으면 web 에서 `<button>` 중첩이
 * 되어(react-native-web) 클릭이 뒤엉킨다(`ReportLocationField` 의 같은 함정 참고) — 그래서
 * 바깥은 `View`, "상세 열기"와 "숨김" 을 나란한 두 `Pressable` 로 쪼갠다.
 */
import {
  ConsoleLogger,
  type Logger,
  type Report,
  reportRelativeTimeLabel,
  reportTypeLabel,
} from '@modu-valley/core';
import { REPORT_TYPE_COLORS } from '@modu-valley/map-style';
import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAdminMode } from '@/admin/AdminModeContext';
import { refreshValleyReports } from '@/admin/refreshValleyReports';
import { createApiClient, reportPhotoUrl } from '@/api/createApiClient';
import { PenIcon } from '@/icons';
import { ReportTypeGlyph } from '@/icons/ReportTypeGlyph';
import { showNotice } from '@/platform/notify';
import { useSession } from '@/session';
import { ADMIN_COPY, REPORT_FEED_COPY } from '@/theme/copy';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { FONT_FAMILY } from '@/theme/theme';
import { CARD, RADII } from '@/theme/tokens';
import { Badge } from '../Pill';

const logger: Logger = new ConsoleLogger('valley').child('report-card-admin');

/** 카드·상세에서 같은 값(DS3) — 제보 유형은 배지(읽는 것)라 아이콘도 하나로 고정한다. */
const TYPE_ICON_SIZE = 12;

const THUMB_SIZE = 56;

export type ReportCardProps = {
  readonly report: Report;
  /** 카드를 그리는 시각 — 상대 시각 계산 기준. 호출부가 한 번 고정해 목록 전체가 같은 값을 쓴다. */
  readonly now: Date;
  readonly onPress: (report: Report) => void;
};

export function ReportCard({ report, now, onPress }: ReportCardProps) {
  const theme = useTheme();
  const themed = useThemedStyles();
  const session = useSession();
  const admin = useAdminMode();
  const [hiding, setHiding] = useState(false);
  const typeColor = REPORT_TYPE_COLORS[theme.mode][report.type];
  const photo = report.photos[0];
  const relativeTime = reportRelativeTimeLabel(report.createdAt, now);
  const typeLabel = reportTypeLabel(report.type);

  const onHide = useCallback(async () => {
    if (admin.token === null || hiding) return;
    setHiding(true);
    const apiClient = createApiClient({ logger });
    const result = await apiClient.setReportHidden(admin.token, report.id, true);
    setHiding(false);
    if (!result.ok) {
      showNotice(ADMIN_COPY.actionFailed);
      return;
    }
    showNotice(ADMIN_COPY.hideSuccess);
    await refreshValleyReports(session, apiClient);
  }, [admin.token, hiding, report.id, session]);

  return (
    <View style={[styles.card, themed.card]} dataSet={{ mv: 'report-card' }}>
      <Pressable
        style={styles.cardPressable}
        accessibilityRole="button"
        accessibilityLabel={`${typeLabel} · ${report.body} · ${relativeTime}`}
        onPress={() => onPress(report)}
      >
        {photo === undefined ? (
          <View
            style={[styles.thumb, styles.thumbEmpty, themed.thumbEmpty]}
            accessibilityLabel={REPORT_FEED_COPY.cardNoPhotoLabel}
          >
            <PenIcon size={22} />
          </View>
        ) : (
          <Image
            source={{ uri: reportPhotoUrl(photo.url) }}
            style={styles.thumb}
            accessibilityIgnoresInvertColors
          />
        )}

        <View style={styles.body}>
          <Text style={[styles.text, themed.text]} numberOfLines={2}>
            {report.body}
          </Text>
          <View style={styles.metaRow}>
            <Badge
              label={typeLabel}
              icon={<ReportTypeGlyph type={report.type} size={TYPE_ICON_SIZE} color={typeColor} />}
              textColor={typeColor}
              borderColor={typeColor}
            />
            <Text style={[styles.time, themed.time]}>{relativeTime}</Text>
          </View>
        </View>
      </Pressable>

      {admin.token === null ? null : (
        <Pressable
          style={[styles.adminHideButton, themed.adminHideButton]}
          dataSet={{ mv: 'report-card-hide' }}
          accessibilityRole="button"
          accessibilityLabel={ADMIN_COPY.hideButton}
          disabled={hiding}
          hitSlop={8}
          onPress={() => void onHide()}
        >
          <Text style={styles.adminHideButtonLabel}>{ADMIN_COPY.hideButton}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADII.card,
    padding: CARD.padding,
  },
  cardPressable: {
    flexDirection: 'row',
    gap: 12,
  },
  /** OPS1 — 관리자 모드에서만. 카드 레이아웃을 밀지 않게 겹쳐 올린다. */
  adminHideButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminHideButtonLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: RADII.info,
  },
  thumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  text: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  /** 상대 시각을 항상 크게(결정 (h) 완화) — 유형 칩보다 굵고 크다. */
  time: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    fontWeight: '700',
  },
});

const useThemedStyles = createThemedStyles((theme) => ({
  card: { backgroundColor: theme.colors.surface },
  thumbEmpty: { backgroundColor: theme.colors.bg },
  text: { color: theme.colors.fg },
  time: { color: theme.colors.fg2 },
  adminHideButton: { backgroundColor: theme.colors.live },
}));
