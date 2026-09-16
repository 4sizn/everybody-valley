/**
 * 지도 화면 셸 — 두 라우트(`/` 계곡, `/firework` 데모)가 공유하는 뼈대.
 *
 * 데모 HTML 의 body 자식 순서·z-index 를 그대로 따른다.
 *   #map-root (배경)  →  .credit(z4)  →  .col(z5)  →  .sheet(z5)
 *   →  .topbar(z6)  →  .nav(z7)
 *
 * 라우트가 정하는 것은 **장면**(어느 저장소, 어느 초기 중심)뿐이다. 상단바·
 * 컨트롤·시트·내비는 세션의 `scene` 을 읽어 문구·버튼·시트 면을 고른다 —
 * valley-ds §6 "같은 셸, 계절별 콘텐츠"의 첫 실증.
 *
 * 이 파일에는 상태도 로직도 없다. 사용자 의도는 모두 `MapSession` 파사드로
 * 들어가고, 화면은 스냅샷을 그린다.
 */
import {
  computeViewportInsets,
  type InitialCameraView,
  type LngLat,
  type SceneSource,
} from '@modu-valley/core';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { AdminEntry } from '@/admin/AdminEntry';
import { AdminModeProvider } from '@/admin/AdminModeContext';
import { Ticker } from '@/components/festival/Ticker';
import { ShadeHourTrack } from '@/components/valley/ShadeHourTrack';
import { ValleyTicker } from '@/components/valley/ValleyTicker';
import { SessionProvider, useAppState, useSession, useSheetSnapUrlSync } from '@/session';
import { VALLEY_COPY } from '@/theme/copy';
import { ABSOLUTE_FILL } from '@/theme/layout';
import { useSafeAreaGutters } from '@/theme/safeArea';
import { createThemedStyles } from '@/theme/ThemeProvider';
import { SIZES } from '@/theme/tokens';
import { BottomSheet } from './BottomSheet';
import { CenterColumn, useColumnWidth, useSheetVisibleHeight } from './CenterColumn';
import { Credit } from './Credit';
import { FloatingNav } from './FloatingNav';
import { MapControls } from './MapControls';
import { narrowOverlayStack } from './overlayStack';
import { RetryState } from './RetryState';
import { ShellBanner } from './ShellBanner';
import { TopBar, type TopBarSearchProps } from './TopBar';

export type MapScreenProps = {
  /** 장면과 그 데이터 출처. 모듈 상수여야 한다 — 참조가 바뀌면 세션이 다시 만들어진다. */
  readonly source: SceneSource;
  /** 지도 최초 중심. festival 은 발사 지점, valley 는 첫 계곡의 중심. */
  readonly initialCenter: LngLat;
  /** 지도 최초 시점. festival 은 데모의 `INITIAL_VIEW`, valley 는 `VALLEY_INITIAL_VIEW`. */
  readonly initialView: InitialCameraView;
};

export function MapScreen({ source, initialCenter, initialView }: MapScreenProps) {
  const themed = useThemedStyles();
  return (
    <View style={[styles.root, themed.root]}>
      <SessionProvider source={source} initialCenter={initialCenter} initialView={initialView}>
        <AdminModeProvider>
          <Chrome />
        </AdminModeProvider>
      </SessionProvider>
    </View>
  );
}

/** 세션이 준비된 뒤 그려지는 2D UI 층. */
function Chrome() {
  const session = useSession();
  const scene = session.scene;
  const columnWidth = useColumnWidth();
  const snap = useAppState((state) => state.sheetSnap);
  const visibleHeight = useSheetVisibleHeight(snap);
  const safeArea = useSafeAreaGutters();
  const searchQuery = useAppState((state) => state.searchQuery);
  /* SR1 — `TopBar` 는 festival 과 공유하는 셸이라 값·핸들러를 옵셔널 props 로만
     넘긴다. festival(`scene === 'festival'`)은 이 prop 을 아예 받지 않아 입력칸이
     지금처럼 죽은 상태로 남는다(CLAUDE.md `/firework` 보존 — 클론 대신 이 방법). */
  const search: TopBarSearchProps | undefined =
    scene === 'valley'
      ? {
          value: searchQuery,
          onChangeText: (text) => session.setSearchQuery(text),
          onClear: () => session.setSearchQuery(''),
          clearLabel: VALLEY_COPY.search.clearLabel,
        }
      : undefined;

  // URL `?sheet=` 동기화(C8, 결정 (d)) — 두 라우트가 이 훅 하나를 공유한다.
  useSheetSnapUrlSync();

  /* 데모는 데스크톱 폭(컬럼 560px)을 전제로 티커와 오른쪽 컨트롤을 같은
     높이에 둔다. 휴대폰에서는 컬럼이 그보다 좁아 티커 문구와 제보·줌 버튼이
     겹친다. 컬럼이 온전한 폭을 못 쓰는 화면에서만 티커를 그 행 위로 올린다 —
     데스크톱에서는 데모와 같은 20px 그대로다. */
  const isNarrow = columnWidth < SIZES.column;
  const controlsBottom = visibleHeight + SIZES.gutter;
  // 그늘 시간 트랙(F4)이 실제로 그려지는가 — 티커와 같은 좁은 컬럼 자리를 다툰다(X4).
  const shadeVisible = useAppState((state) => state.shadeVisible);
  /* X4 — 트랙과 티커를 각자 "좁으면 한 행 위로" 로 따로 계산하면 둘 다 같은
     값이 나와 그늘 트랙이 켜졌을 때 티커를 완전히 덮었다(실측 회귀,
     `overlayStack.ts` 주석 참고). 한 함수로 몇 번째 행인지 세어 겹치지 않게 한다. */
  const { trackBottom, tickerBottom } = narrowOverlayStack({
    controlsBottom,
    visibleHeight,
    isNarrow,
    trackVisible: session.scene === 'valley' && shadeVisible,
    rowHeight: SIZES.reportHeight + CONTROL_ROW_GAP,
    tickerGap: SIZES.tickerGap,
  });

  /* 최상단 스냅(85vh)에서는 지도에 127px 남짓만 남아 티커·트랙이 갈 자리가 없다
     (C8 결정 (c)) — 그 스냅에서만 숨긴다. `peek`/`half` 의 정지 상태는 바뀌지 않는다. */
  const hideMapOverlays = snap === 'full';

  // 뷰포트 인셋(C8) — 카메라를 옮기지 않는다(결정 (f)). C6 이 이 값을 소비한다.
  // biome-ignore lint/correctness/useExhaustiveDependencies: session 은 참조가 안정적이다
  useEffect(() => {
    session.setViewportInsets(
      computeViewportInsets({
        topbarHeight: SIZES.topbarHeight,
        safeAreaTop: safeArea.top,
        sheetVisibleHeight: visibleHeight,
      }),
    );
  }, [safeArea.top, visibleHeight]);

  return (
    <>
      <Credit />

      <CenterColumn>
        {/* 소식 티커는 축제 연출 — 데모 컴포넌트를 그대로 쓴다(CLAUDE.md `/firework` 보존 규칙).
            계곡의 실시간 피드(제보, F5c)는 같은 자리를 쓰는 별도 클론(`ValleyTicker`)이다 —
            공유 컴포넌트를 고치지 않는다. */}
        {scene === 'festival' && !hideMapOverlays ? <Ticker bottom={tickerBottom} /> : null}
        {scene === 'valley' && !hideMapOverlays ? <ValleyTicker bottom={tickerBottom} /> : null}
        {scene === 'valley' && !hideMapOverlays ? (
          <ShadeHourTrack bottom={trackBottom} narrow={isNarrow} />
        ) : null}
        <MapControls bottom={controlsBottom} />
      </CenterColumn>

      <View style={styles.sheetSlot}>
        <BottomSheet width={columnWidth} />
      </View>

      <TopBar search={search} />
      {/* 좌상단 10탭 → 관리자 모드(OPS1, 임시). TopBar 는 고치지 않는다 — 그 위에 얹는다.
          계곡 화면에서만(`scene === 'valley'`) — festival 은 `/firework` 파리티 대상. */}
      {scene === 'valley' ? <AdminEntry /> : null}
      {/* 상단바 아래 띠(C7) — 경보(F3) > 베이스맵 헬스. 정상이면 렌더 없음(`/firework` 파리티). */}
      <ShellBanner />
      <FloatingNav />
      {/* 스타일 자체 실패 — 세션 `failed` 일 때만 화면 전체를 덮는다(C7). */}
      <RetryState />
    </>
  );
}

/** `MapControls` 의 세로 gap 과 같은 값 — 티커를 그 행 위로 올릴 때 쓴다. */
const CONTROL_ROW_GAP = 12;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  sheetSlot: {
    ...ABSOLUTE_FILL,
    alignItems: 'center',
    zIndex: 5,
    pointerEvents: 'box-none',
  },
});

const useThemedStyles = createThemedStyles((theme) => ({
  root: { backgroundColor: theme.colors.bg },
}));
