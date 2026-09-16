/**
 * 제보 운영 패널(OPS1) — 관리자 배너를 누르면 연다. 탭 둘.
 *   숨긴 제보  `GET /api/admin/reports?includeHidden=1` 에서 hidden=true 만 골라 복구 버튼.
 *   신고 목록  `GET /api/admin/flags` — 제보별로 묶인 신고, 숨김/복구 토글.
 *
 * 목록 화면 카드(`ReportCard`)를 그대로 쓰지 않는다 — 여기 데이터는 `Report` 도메인이
 * 아니라 관리자 전용 DTO(hidden·신고 집계를 함께 실은)라 모양이 다르고, 관리자가 보려는
 * 정보(신고 횟수·최근 시각·hidden 여부)도 다르다. 리듬만 카드와 맞춘다(표면·패딩·라운드).
 */
import {
  type ApiAdminFlagSummary,
  type ApiAdminReport,
  ConsoleLogger,
  type Logger,
  reportTypeLabel,
} from '@modu-valley/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { createApiClient } from '@/api/createApiClient';
import { CloseIcon } from '@/icons';
import { showNotice } from '@/platform/notify';
import { ADMIN_COPY } from '@/theme/copy';
import { createThemedStyles } from '@/theme/ThemeProvider';
import { FONT_FAMILY } from '@/theme/theme';
import { CARD, RADII } from '@/theme/tokens';
import { useAdminMode } from './AdminModeContext';

const logger: Logger = new ConsoleLogger('valley').child('admin-panel');

export type AdminPanelModalProps = {
  readonly visible: boolean;
  readonly onClose: () => void;
};

type Tab = 'hidden' | 'flags';
type LoadState = 'idle' | 'loading' | 'error';

export function AdminPanelModal({ visible, onClose }: AdminPanelModalProps) {
  const admin = useAdminMode();
  const themed = useThemedStyles();
  const [tab, setTab] = useState<Tab>('hidden');
  const [hiddenReports, setHiddenReports] = useState<readonly ApiAdminReport[]>([]);
  const [flags, setFlags] = useState<readonly ApiAdminFlagSummary[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [busyId, setBusyId] = useState<string | null>(null);

  const apiClient = useMemo(() => createApiClient({ logger }), []);
  const token = admin.token;

  const reload = useCallback(async () => {
    if (token === null) return;
    setLoadState('loading');
    const [reportsResult, flagsResult] = await Promise.all([
      apiClient.adminReports(token, { limit: 50, includeHidden: true }),
      apiClient.adminFlags(token),
    ]);
    if (!reportsResult.ok || !flagsResult.ok) {
      setLoadState('error');
      return;
    }
    setHiddenReports(reportsResult.value.reports.filter((r) => r.hidden));
    setFlags(flagsResult.value);
    setLoadState('idle');
  }, [token, apiClient]);

  useEffect(() => {
    if (visible) void reload();
  }, [visible, reload]);

  const setHidden = useCallback(
    async (id: string, hidden: boolean) => {
      if (token === null) return;
      setBusyId(id);
      const result = await apiClient.setReportHidden(token, id, hidden);
      setBusyId(null);
      if (!result.ok) {
        showNotice(ADMIN_COPY.actionFailed);
        return;
      }
      showNotice(hidden ? ADMIN_COPY.hideSuccess : ADMIN_COPY.restoreSuccess);
      await reload();
    },
    [token, apiClient, reload],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel={ADMIN_COPY.closeButton}
          onPress={onClose}
        />
        <View style={[styles.card, themed.card]} dataSet={{ mv: 'admin-panel' }}>
          <View style={styles.header}>
            <Text style={[styles.title, themed.title]}>{ADMIN_COPY.panelTitle}</Text>
            <Pressable
              style={[styles.closeButton, themed.closeButton]}
              accessibilityLabel={ADMIN_COPY.closeButton}
              onPress={onClose}
            >
              <CloseIcon size={16} />
            </Pressable>
          </View>

          <View style={styles.tabRow}>
            <TabButton
              label={ADMIN_COPY.tabHidden}
              active={tab === 'hidden'}
              onPress={() => setTab('hidden')}
            />
            <TabButton
              label={ADMIN_COPY.tabFlags}
              active={tab === 'flags'}
              onPress={() => setTab('flags')}
            />
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {loadState === 'loading' ? (
              <Text style={[styles.emptyText, themed.emptyText]}>{ADMIN_COPY.loading}</Text>
            ) : loadState === 'error' ? (
              <Text style={[styles.emptyText, themed.emptyText]}>{ADMIN_COPY.actionFailed}</Text>
            ) : tab === 'hidden' ? (
              <HiddenList
                reports={hiddenReports}
                busyId={busyId}
                onRestore={(id) => void setHidden(id, false)}
              />
            ) : (
              <FlagsList
                flags={flags}
                busyId={busyId}
                onToggleHidden={(id, hidden) => void setHidden(id, hidden)}
              />
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  readonly label: string;
  readonly active: boolean;
  readonly onPress: () => void;
}) {
  const themed = useThemedStyles();
  return (
    <Pressable
      style={[styles.tabButton, active ? [styles.tabButtonActive, themed.tabButtonActive] : null]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
    >
      <Text style={[styles.tabLabel, themed.tabLabel, active ? themed.tabLabelActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function HiddenList({
  reports,
  busyId,
  onRestore,
}: {
  readonly reports: readonly ApiAdminReport[];
  readonly busyId: string | null;
  readonly onRestore: (id: string) => void;
}) {
  const themed = useThemedStyles();
  if (reports.length === 0) {
    return <Text style={[styles.emptyText, themed.emptyText]}>{ADMIN_COPY.hiddenEmpty}</Text>;
  }
  return (
    <>
      {reports.map((report) => (
        <View key={report.id} style={[styles.row, themed.row]} dataSet={{ mv: 'admin-hidden-row' }}>
          <View style={styles.rowBody}>
            <Text style={[styles.rowMeta, themed.rowMeta]}>{reportTypeLabel(report.type)}</Text>
            <Text style={[styles.rowText, themed.rowText]} numberOfLines={2}>
              {report.body}
            </Text>
            <Text style={[styles.rowSub, themed.rowSub]}>{report.nickname}</Text>
          </View>
          <ActionButton
            label={ADMIN_COPY.restoreButton}
            busy={busyId === report.id}
            onPress={() => onRestore(report.id)}
          />
        </View>
      ))}
    </>
  );
}

function FlagsList({
  flags,
  busyId,
  onToggleHidden,
}: {
  readonly flags: readonly ApiAdminFlagSummary[];
  readonly busyId: string | null;
  readonly onToggleHidden: (id: string, hidden: boolean) => void;
}) {
  const themed = useThemedStyles();
  if (flags.length === 0) {
    return <Text style={[styles.emptyText, themed.emptyText]}>{ADMIN_COPY.flagsEmpty}</Text>;
  }
  return (
    <>
      {flags.map((flag) => (
        <View
          key={flag.reportId}
          style={[styles.row, themed.row]}
          dataSet={{ mv: 'admin-flag-row' }}
        >
          <View style={styles.rowBody}>
            <View style={styles.rowMetaRow}>
              <Text style={[styles.rowMeta, themed.rowMeta]}>{reportTypeLabel(flag.type)}</Text>
              <Text style={[styles.flagCount, themed.flagCount]}>
                {ADMIN_COPY.flagCount(flag.count)}
              </Text>
              {flag.hidden ? (
                <Text style={[styles.hiddenTag, themed.hiddenTag]}>{ADMIN_COPY.tabHidden}</Text>
              ) : null}
            </View>
            <Text style={[styles.rowText, themed.rowText]} numberOfLines={2}>
              {flag.body}
            </Text>
            <Text style={[styles.rowSub, themed.rowSub]}>{flag.nickname}</Text>
          </View>
          <ActionButton
            label={flag.hidden ? ADMIN_COPY.restoreButton : ADMIN_COPY.hideButton}
            busy={busyId === flag.reportId}
            onPress={() => onToggleHidden(flag.reportId, !flag.hidden)}
          />
        </View>
      ))}
    </>
  );
}

function ActionButton({
  label,
  busy,
  onPress,
}: {
  readonly label: string;
  readonly busy: boolean;
  readonly onPress: () => void;
}) {
  const themed = useThemedStyles();
  return (
    <Pressable
      style={[styles.actionButton, themed.actionButton, busy ? styles.actionButtonBusy : null]}
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
    >
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '100%',
    borderRadius: RADII.sheet,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: 17,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    height: 36,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {},
  tabLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    fontWeight: '600',
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    gap: 8,
    paddingBottom: 4,
  },
  emptyText: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 24,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: RADII.card,
    padding: CARD.padding,
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  rowMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowMeta: {
    fontFamily: FONT_FAMILY,
    fontSize: 11,
    fontWeight: '600',
  },
  flagCount: {
    fontFamily: FONT_FAMILY,
    fontSize: 11,
    fontWeight: '700',
  },
  hiddenTag: {
    fontFamily: FONT_FAMILY,
    fontSize: 10,
    fontWeight: '700',
  },
  rowText: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    lineHeight: 18,
  },
  rowSub: {
    fontFamily: FONT_FAMILY,
    fontSize: 11,
  },
  actionButton: {
    alignSelf: 'center',
    height: 32,
    paddingHorizontal: 12,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonBusy: {
    opacity: 0.6,
  },
  actionLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
});

const useThemedStyles = createThemedStyles((theme) => ({
  card: { backgroundColor: theme.colors.surface },
  title: { color: theme.colors.fg },
  closeButton: { backgroundColor: theme.colors.bg },
  tabButtonActive: { backgroundColor: theme.colors.accent },
  tabLabel: { color: theme.colors.fg2 },
  tabLabelActive: { color: '#ffffff' },
  emptyText: { color: theme.colors.fg3 },
  row: { backgroundColor: theme.colors.bg },
  rowMeta: { color: theme.colors.fg3 },
  flagCount: { color: theme.colors.live },
  hiddenTag: { color: theme.colors.fg3 },
  rowText: { color: theme.colors.fg },
  rowSub: { color: theme.colors.fg3 },
  actionButton: { backgroundColor: theme.colors.accent },
}));
