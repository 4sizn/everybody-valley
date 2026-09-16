/**
 * 시트 상세 면 — 제보 상세(F5c, 화면 결정 (e)). `ValleyDetailFace`(구간 상세)와 같은
 * 플립을 쓰는 세 번째 상세 콘텐츠다(`BottomSheet` 가 `selectedReportId` 로 고른다).
 *
 * 구조 — eyebrow("제보") + 닫기 → 가로 캐러셀(사진, 한 장씩 + 점 표시. 사진이 없으면
 * 빈 자리에 연필 글리프) → 유형 칩 + **작성 시각**(카드와 같은 상대 시각, 결정 (h) 완화) +
 * 닉네임 → 본문 → 119·112 고지(결정 (i), 조건 없이 항상) → 신고하기(결정 (h) — 접수만,
 * 누적·자동 숨김 없음. 누른 뒤 "접수되었습니다" 토스트만 보여주고 카드는 그대로 남는다).
 *
 * "만료" 표시는 두지 않는다(결정 (g) — 자동 만료가 없다).
 */
import {
  ConsoleLogger,
  formatReportCoordinate,
  type Logger,
  reportRelativeTimeLabel,
  reportTypeLabel,
} from '@modu-valley/core';
import { REPORT_TYPE_COLORS } from '@modu-valley/map-style';
import { useCallback, useMemo, useState } from 'react';
import {
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAdminMode } from '@/admin/AdminModeContext';
import { refreshValleyReports } from '@/admin/refreshValleyReports';
import { createApiClient, reportPhotoUrl } from '@/api/createApiClient';
import { CloseIcon, PenIcon } from '@/icons';
import { ReportTypeGlyph } from '@/icons/ReportTypeGlyph';
import { showNotice } from '@/platform/notify';
import { copyReportCoordinate, REPORT_CLIPBOARD_SUPPORTED } from '@/platform/reportClipboard';
import { useAppState, useSession } from '@/session';
import { ADMIN_COPY, REPORT_FEED_COPY, REPORT_FORM_COPY } from '@/theme/copy';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { FONT_FAMILY } from '@/theme/theme';
import { RADII } from '@/theme/tokens';
import { InfoCardPlaceholder } from '../../shell/InfoCardPlaceholder';
import { sheetStyles, useSheetThemedStyles } from '../../shell/sheetStyles';
import { Badge } from '../Pill';
import {
  reportCopyResultMessage,
  reportDetailCopyText,
  reportFlagResultMessage,
} from './reportDetailLogic';

/** 카드(`ReportCard`)와 같은 값(DS3) — 제보 유형은 배지(읽는 것). */
const TYPE_ICON_SIZE = 12;

const logger: Logger = new ConsoleLogger('valley').child('report-detail');

export type ReportDetailFaceProps = {
  readonly generation: number;
  readonly innerWidth: number;
};

type FlagStatus = 'idle' | 'sending';
type HideStatus = 'idle' | 'sending';

export function ReportDetailFace({ innerWidth }: ReportDetailFaceProps) {
  const session = useSession();
  const theme = useTheme();
  const admin = useAdminMode();
  const reports = useAppState((state) => state.reports);
  const selectedId = useAppState((state) => state.selectedReportId);
  const valleys = useAppState((state) => state.valleys) ?? [];
  const themed = useThemedStyles();
  const sheetThemed = useSheetThemedStyles();
  const [photoIndex, setPhotoIndex] = useState(0);
  const [flagStatus, setFlagStatus] = useState<FlagStatus>('idle');
  const [hideStatus, setHideStatus] = useState<HideStatus>('idle');
  const apiClient = useMemo(() => createApiClient({ logger }), []);

  const close = useCallback(() => {
    void session.closeReport();
  }, [session]);

  const report = reports?.find((candidate) => candidate.id === selectedId);

  const onScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(event.nativeEvent.contentOffset.x / innerWidth);
      setPhotoIndex(index);
    },
    [innerWidth],
  );

  const onFlag = useCallback(async () => {
    if (report === undefined || flagStatus === 'sending') return;
    setFlagStatus('sending');
    const result = await apiClient.flagReport(report.id);
    setFlagStatus('idle');
    if (!result.ok) {
      logger.warn('신고 접수 실패', { code: result.error.code, context: result.error.context });
    }
    // 성공이든 실패든 토스트만 보여준다 — 카드·상세 상태는 건드리지 않는다(결정 (h)).
    showNotice(reportFlagResultMessage(result.ok));
  }, [report, flagStatus, apiClient]);

  /**
   * 관리자 숨김(OPS1) — 이 면에 뜬 제보는 항상 `hidden=false` 다(`state.reports` 자체가
   * 숨김을 뺀 목록이라서). 복구는 여기가 아니라 운영 패널의 "숨긴 제보" 탭에서 한다.
   * 숨긴 뒤에는 피드를 다시 채우고(`refreshValleyReports`) 상세를 닫는다 — 그대로 두면
   * 이 제보가 목록에서 빠져 `report === undefined` 가 되어 빈 자리만 보인다.
   */
  const onHide = useCallback(async () => {
    if (report === undefined || admin.token === null || hideStatus === 'sending') return;
    setHideStatus('sending');
    const result = await apiClient.setReportHidden(admin.token, report.id, true);
    setHideStatus('idle');
    if (!result.ok) {
      logger.warn('관리자 숨김 실패', { code: result.error.code, context: result.error.context });
      showNotice(ADMIN_COPY.actionFailed);
      return;
    }
    showNotice(ADMIN_COPY.hideSuccess);
    await refreshValleyReports(session, apiClient);
    void session.closeReport();
  }, [report, admin.token, hideStatus, apiClient, session]);

  const reportLat = report?.lat;
  const reportLng = report?.lng;
  const copyText =
    report !== undefined && reportLat !== undefined && reportLng !== undefined
      ? reportDetailCopyText(
          valleys,
          report.valleyId,
          report.segmentId ?? null,
          reportLat,
          reportLng,
        )
      : null;

  const onCopy = useCallback(async () => {
    if (copyText === null) return;
    const ok = await copyReportCoordinate(copyText);
    showNotice(reportCopyResultMessage(ok));
  }, [copyText]);

  if (report === undefined) return <InfoCardPlaceholder />;

  const typeColor = REPORT_TYPE_COLORS[theme.mode][report.type];
  const relativeTime = reportRelativeTimeLabel(report.createdAt, new Date());
  const photos = report.photos;

  return (
    <View>
      <View style={[sheetStyles.headerRow, styles.headerRow]}>
        <Text style={[styles.eyebrow, themed.eyebrow]}>{REPORT_FEED_COPY.detailEyebrow}</Text>
        <Pressable
          style={[sheetStyles.roundButton, sheetThemed.roundButton]}
          dataSet={{ mv: 'round-button' }}
          accessibilityLabel={REPORT_FORM_COPY.closeButton}
          onPress={close}
        >
          <CloseIcon />
        </Pressable>
      </View>

      {photos.length === 0 ? (
        <View style={[styles.emptyPhoto, themed.emptyPhoto, { width: innerWidth }]}>
          <PenIcon size={32} />
        </View>
      ) : (
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScrollEnd}
            dataSet={{ mv: 'report-carousel' }}
          >
            {photos.map((photo, index) => (
              <Image
                key={photo.id}
                source={{ uri: reportPhotoUrl(photo.url) }}
                style={[styles.photo, { width: innerWidth }]}
                accessibilityLabel={REPORT_FEED_COPY.carouselPhotoLabel(index + 1, photos.length)}
                accessibilityIgnoresInvertColors
              />
            ))}
          </ScrollView>
          {photos.length > 1 ? (
            <View style={styles.dots} dataSet={{ mv: 'report-carousel-dots' }}>
              {photos.map((photo, index) => (
                <View
                  key={photo.id}
                  style={[styles.dot, themed.dot, index === photoIndex ? themed.dotActive : null]}
                />
              ))}
            </View>
          ) : null}
        </View>
      )}

      <View style={styles.metaRow}>
        <Badge
          label={reportTypeLabel(report.type)}
          icon={<ReportTypeGlyph type={report.type} size={TYPE_ICON_SIZE} color={typeColor} />}
          textColor={typeColor}
          borderColor={typeColor}
        />
        <Text style={[styles.time, themed.time]}>{relativeTime}</Text>
        <Text style={[styles.nickname, themed.nickname]} numberOfLines={1}>
          {report.nickname}
        </Text>
      </View>

      <Text style={[styles.body, themed.body]}>{report.body}</Text>

      {report.lat === undefined || report.lng === undefined ? null : (
        <View style={styles.coordinateRow} dataSet={{ mv: 'report-coordinate' }}>
          <Text style={[styles.coordinateText, themed.coordinateText]} selectable>
            {formatReportCoordinate(report.lat, report.lng)}
          </Text>
          {REPORT_CLIPBOARD_SUPPORTED && copyText !== null ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={REPORT_FEED_COPY.copyCoordinateLabel}
              onPress={() => void onCopy()}
              hitSlop={8}
            >
              <Text style={[styles.coordinateCopyLabel, themed.coordinateCopyLabel]}>
                {REPORT_FEED_COPY.copyCoordinateLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}

      <Text style={[styles.emergencyNotice, themed.emergencyNotice]}>
        {REPORT_FORM_COPY.emergencyNotice}
      </Text>

      <Pressable
        style={[
          sheetStyles.ctaButton,
          sheetStyles.ctaGhost,
          sheetThemed.ctaGhost,
          styles.flagButton,
        ]}
        dataSet={{ mv: 'flag-report' }}
        accessibilityRole="button"
        accessibilityLabel={REPORT_FEED_COPY.flagButton}
        disabled={flagStatus === 'sending'}
        onPress={() => void onFlag()}
      >
        <Text style={[sheetStyles.ctaGhostLabel, sheetThemed.ctaGhostLabel]}>
          {REPORT_FEED_COPY.flagButton}
        </Text>
      </Pressable>

      {admin.token === null ? null : (
        <Pressable
          style={[styles.adminHideButton, themed.adminHideButton]}
          dataSet={{ mv: 'admin-hide-report' }}
          accessibilityRole="button"
          accessibilityLabel={ADMIN_COPY.hideButton}
          disabled={hideStatus === 'sending'}
          onPress={() => void onHide()}
        >
          <Text style={styles.adminHideButtonLabel}>{ADMIN_COPY.hideButton}</Text>
        </Pressable>
      )}
    </View>
  );
}

const DOT_SIZE = 6;

const styles = StyleSheet.create({
  headerRow: {
    height: 'auto',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  eyebrow: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyPhoto: {
    height: 200,
    borderRadius: RADII.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  photo: {
    height: 240,
    borderRadius: RADII.card,
  },
  dots: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  metaRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  time: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    fontWeight: '700',
  },
  nickname: {
    flex: 1,
    textAlign: 'right',
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    fontWeight: '500',
  },
  body: {
    marginTop: 12,
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    lineHeight: 22,
  },
  coordinateRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  coordinateText: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    fontWeight: '600',
  },
  coordinateCopyLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fontWeight: '600',
  },
  emergencyNotice: {
    marginTop: 16,
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    lineHeight: 17,
  },
  flagButton: {
    marginTop: 20,
  },
  adminHideButton: {
    marginTop: 10,
    height: 44,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminHideButtonLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});

const useThemedStyles = createThemedStyles((theme) => ({
  eyebrow: { color: theme.colors.eyebrow },
  emptyPhoto: { backgroundColor: theme.colors.surface },
  dot: { backgroundColor: theme.colors.line2 },
  dotActive: { backgroundColor: theme.colors.accent },
  time: { color: theme.colors.fg2 },
  nickname: { color: theme.colors.fg3 },
  body: { color: theme.colors.fg },
  adminHideButton: { backgroundColor: theme.colors.live },
  coordinateText: { color: theme.colors.fg2 },
  coordinateCopyLabel: { color: theme.colors.accent },
  emergencyNotice: { color: theme.colors.fg3 },
}));
