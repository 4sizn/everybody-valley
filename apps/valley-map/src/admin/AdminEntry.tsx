/**
 * 좌상단 10탭 → 관리자 모드 진입(OPS1, 사용자 결정 2026-09-08). `MapScreen`(Chrome) 이
 * `scene === 'valley'` 일 때만 이 컴포넌트를 하나 얹는다 — `TopBar` 자신은 고치지 않는다
 * (`/firework` 와 공유하는 셸, 파리티).
 *
 * **제스처는 입구일 뿐이다.** 10번째 탭은 토큰 입력 모달을 여는 신호일 뿐, 그 모달이
 * 서버에 토큰을 확인받은 뒤에야 관리자 UI 가 켜진다(`AdminModeContext`, `AdminTokenModal`).
 *
 * 탭 카운트는 core `registerAdminGestureTap` 순수 함수가 정한다 — 3초 창을 넘기면
 * 리셋된다. 히트 영역은 상단바와 같은 자리(좌상단)에 겹쳐 얹되 보이지 않는다
 * (`backgroundColor: transparent`) — 상단바 위 층(zIndex 더 높음)이라 탭을 가로챈다.
 *
 * 관리자 모드가 켜지면 상단바 아래에 배너(평소와 구별되는 표시)가 뜬다 — 누르면 운영
 * 패널이 열린다. 이것이 "실수로 켠 채 두는 것을 막는" 표시다.
 */
import { registerAdminGestureTap } from '@modu-valley/core';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ADMIN_COPY } from '@/theme/copy';
import { useSafeAreaGutters } from '@/theme/safeArea';
import { createThemedStyles } from '@/theme/ThemeProvider';
import { FONT_FAMILY } from '@/theme/theme';
import { RADII, SIZES } from '@/theme/tokens';
import { useAdminMode } from './AdminModeContext';
import { AdminPanelModal } from './AdminPanelModal';
import { AdminTokenModal } from './AdminTokenModal';

/** 상단바 아래 간격(`ShellBanner` 와 같은 리듬). */
const BANNER_GAP = 8;
/** 상단바와 겹치는 보이지 않는 히트 영역 크기 — 브랜드 글자 자리를 넉넉히 덮는다. */
const TAP_ZONE_SIZE = { width: 88, height: SIZES.topbarHeight };

export function AdminEntry() {
  const admin = useAdminMode();
  const insets = useSafeAreaGutters();
  const themed = useThemedStyles();
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const gestureRef = useRef({ count: 0, firstTapAt: null as number | null });

  const onTap = useCallback(() => {
    const result = registerAdminGestureTap(gestureRef.current, Date.now());
    gestureRef.current = result.state;
    if (result.triggered) setTokenModalOpen(true);
  }, []);

  if (admin.loading) return null;

  const bannerTop = insets.top + SIZES.gutter + SIZES.topbarHeight + BANNER_GAP;

  return (
    <>
      <Pressable
        style={[styles.tapZone, { top: insets.top + SIZES.gutter, left: SIZES.gutter }]}
        dataSet={{ mv: 'admin-tap-zone' }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onPress={onTap}
      />

      {admin.token === null ? null : (
        <Pressable
          style={[styles.banner, themed.banner, { top: bannerTop }]}
          dataSet={{ mv: 'admin-banner' }}
          accessibilityRole="button"
          accessibilityLabel={ADMIN_COPY.bannerLabel}
          onPress={() => setPanelOpen(true)}
        >
          <View style={[styles.dot, themed.dot]} />
          <Text style={[styles.bannerText, themed.bannerText]}>{ADMIN_COPY.bannerLabel}</Text>
        </Pressable>
      )}

      <AdminTokenModal visible={tokenModalOpen} onClose={() => setTokenModalOpen(false)} />
      <AdminPanelModal visible={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  tapZone: {
    position: 'absolute',
    zIndex: 7,
    width: TAP_ZONE_SIZE.width,
    height: TAP_ZONE_SIZE.height,
    backgroundColor: 'transparent',
  },
  banner: {
    position: 'absolute',
    right: SIZES.gutter,
    zIndex: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: RADII.pill,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bannerText: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fontWeight: '700',
  },
});

const useThemedStyles = createThemedStyles((theme) => ({
  banner: { backgroundColor: theme.colors.surface, borderColor: theme.colors.live },
  dot: { backgroundColor: theme.colors.live },
  bannerText: { color: theme.colors.live },
}));
