/**
 * 하단 시트. 데모의 `.sheet` + `.grab` + `.flip`.
 *
 * 구조
 *   Animated.View (접힘 이동, 라운드, 배경, 폭·높이)
 *     └ ScrollView (데모에서는 시트 자체가 스크롤 컨테이너였다)
 *         ├ 손잡이  (`position:sticky` — web 전역 스타일시트가 얹는다)
 *         └ 플립 면 (Animated 회전 + 두 면 중 하나)
 *
 * 면의 내용은 장면이 정한다 — festival 은 명당 목록/상세, valley 는 구간 카드/상세
 * (`renderFace`). 셸은 둘을 구분하지 않는다. 설정 면(C9)은 장면과 무관한 셸의 면이라
 * 두 장면이 같은 컴포넌트를 쓴다.
 *
 * 접힘 이동과 플립은 RN `Animated` 로 옮겼다. `Easing.bezier` 가 CSS 의
 * `cubic-bezier()` 와 같은 곡선을 만들어 감각이 유지되고, 같은 코드가
 * 네이티브에서도 돈다.
 *
 * 손잡이의 상호작용(C8, 결정 (e)) — 드래그 + 탭을 `createSheetPanResponder`
 * 하나가 가른다(탭/드래그 판정은 그 모듈 주석 참고). 데모는 `onclick` 토글과
 * pointerdown/up 드래그 판정을 동시에 걸어 둘이 서로 상쇄됐지만("손잡이를 누르면
 * 토글" 만 보였다), 스냅이 셋으로 늘면서 그 우연에 기댈 수 없어 명시적으로 나눴다.
 */

import { type Scene, type SheetFace, selectedFeatureKind } from '@modu-valley/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { createSheetPanResponder } from '@/animation/sheetPanResponder';
import { useFlipTransform } from '@/animation/useFlipTransform';
import { useSheetTranslate } from '@/animation/useSheetTranslate';
import { useDismissRequest } from '@/platform/useDismissRequest';
import { useAppState, useSession } from '@/session';
import { useSafeAreaGutters } from '@/theme/safeArea';
import { createThemedStyles } from '@/theme/ThemeProvider';
import { RADII, SIZES } from '@/theme/tokens';
import { SpotDetailFace } from '../festival/SpotDetailFace';
import { SpotListFace } from '../festival/SpotListFace';
import { FilterChipRow } from '../valley/FilterChipRow';
import { ReportDetailFace } from '../valley/report/ReportDetailFace';
import { ValleyDetailFace } from '../valley/ValleyDetailFace';
import { ValleyListFace } from '../valley/ValleyListFace';
import { useSheetSnapMetrics } from './CenterColumn';
import { SettingsFace } from './SettingsFace';

/** 데모 `.sheet{padding:0 16px 84px}` — 좌우 여백만 데모 값 그대로. */
const SHEET_PADDING_X = 16;
/**
 * 목록 끝 뒤에 남기는 여백(시각적 여유일 뿐, 내비 회피용이 아니다) — X3.
 *
 * 예전엔 이 값(데모의 84) 하나로 `FloatingNav` 회피까지 겸했다. 하지만 내비는
 * 시트보다 위 z-index(z7>z5)로 **항상** 시트 위에 뜨는데, 그 회피는 "맨 끝까지
 * 스크롤했을 때"만 지켜지고 그 전(좁고 짧은 화면일수록 흔하다)에는 카드가
 * 그대로 내비 뒤에 깔려 탭까지 먹혔다(실측: 360×740, 첫 구간 카드 `top:649,
 * bottom:740` — 내비 `top:674,bottom:724` 와 그대로 겹쳤다). 내비 회피는 아래
 * `navSafeBottom`(스크롤 가능 영역 자체를 줄인다)이 맡고, 이 값은 순수하게
 * "끝까지 스크롤했을 때 마지막 줄과 그 경계 사이"의 여유다.
 */
const SHEET_CONTENT_END_GAP = 16;

export type BottomSheetProps = {
  readonly width: number;
};

export function BottomSheet({ width }: BottomSheetProps) {
  const session = useSession();
  const snap = useAppState((state) => state.sheetSnap);
  const face = useAppState((state) => state.sheetFace);
  const phase = useAppState((state) => state.flipPhase);
  const selectedReportId = useAppState((state) => state.selectedReportId);

  // 어떤 종류의 선택이든(명당·구간·시설·제보) Esc/뒤로가기로 닫힌다.
  const hasSelection = useAppState(
    (state) => selectedFeatureKind(state) !== null || state.selectedReportId !== null,
  );

  const { height: windowHeight } = useWindowDimensions();
  const metrics = useSheetSnapMetrics();
  const { containerHeight, translateY, beginDrag, endDrag } = useSheetTranslate(
    snap,
    windowHeight,
    metrics,
  );
  const panResponder = useMemo(
    () =>
      createSheetPanResponder({ session, translateY, windowHeight, metrics, beginDrag, endDrag }),
    [session, translateY, windowHeight, metrics, beginDrag, endDrag],
  );
  const flipStyle = useFlipTransform(phase);
  const scrollRef = useRef<ScrollView | null>(null);
  const [generation, setGeneration] = useState(0);
  const insets = useSafeAreaGutters();
  const themed = useThemedStyles();

  // 면이 바뀌면 스크롤을 처음으로 되돌리고 스태거를 다시 재생한다.
  // 데모의 `sheetEl.scrollTop = 0` 과 `stagger(...)` 호출 지점이다.
  // face 는 값이 아니라 트리거로 쓰인다 — 면이 바뀐 '사건' 이 필요하다.
  // biome-ignore lint/correctness/useExhaustiveDependencies: 위 설명 참고
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    setGeneration((current) => current + 1);
  }, [face]);

  const isSettings = face === 'settings';
  const dismiss = useCallback(() => {
    if (isSettings) {
      void session.closeSettings();
      return;
    }
    if (selectedReportId !== null) {
      void session.closeReport();
      return;
    }
    void session.clearSelection();
  }, [session, isSettings, selectedReportId]);
  // Esc(web)와 안드로이드 뒤로가기가 같은 일을 한다 — 설정 면이면 설정을, 아니면 상세를 닫는다.
  // 닫을 것이 없으면 뒤로가기를 OS 에 넘겨 앱 종료 기본 동작이 유지된다.
  useDismissRequest({ active: hasSelection || isSettings, onDismiss: dismiss });

  const innerWidth = width - SHEET_PADDING_X * 2;
  /**
   * `FloatingNav` 안전 지대(X3) — 내비 자신이 쓰는 값(높이 + 그 bottom 패딩)을
   * 그대로 다시 계산해, 스크롤 가능한 시야 자체를 그만큼 줄인다. 컨텐츠 끝
   * 패딩과 달리 이건 스크롤 위치와 무관하게 항상 적용된다 — 내비가 있는 줄에는
   * 애초에 아무 것도 스크롤되어 들어오지 않는다.
   *
   * **valley 에만 적용한다.** festival 은 이 안전 지대가 생기면 목록이 한 칸
   * 짧아져 보인다 — `/firework` 다크 1440×757 픽셀 diff 로 실측했다(내비 pill
   * 옆으로 삐져나와 있던 두 번째 카드가 사라져 diff 2408px, y 709~756·x
   * 469~970 — 정확히 내비 자리). `/firework` 는 이 겹침을 포함해 결과물 보존
   * 대상이라(CLAUDE.md) X3 를 festival 까지 넓히지 않는다 — 계곡만 고친다.
   */
  const navSafeBottom =
    session.scene === 'valley' ? SIZES.navHeight + SIZES.gutter + insets.bottom : 0;

  return (
    <Animated.View
      style={[
        styles.sheet,
        themed.sheet,
        { width, height: containerHeight, transform: [{ translateY }] },
      ]}
      dataSet={{ mv: 'sheet' }}
    >
      {/* N1 — 계곡 화면의 조건 필터 칩. `ScrollView` 밖에 두어 스크롤·면 전환과 무관하게
          남는다(결정 (d)). festival 장면은 이 분기를 절대 타지 않는다 — `/firework` 무변경. */}
      {session.scene === 'valley' && face !== 'settings' ? <FilterChipRow /> : null}
      {/*
        X3 — `marginBottom`(패딩이 아니라)으로 시야 자체를 줄인다. `ScrollView` 자신의
        `style` 에 **패딩**을 주면(web) 스크롤 컨테이너 **안쪽** 여백이 되어 스크롤해야만
        닿는 공간일 뿐 보이는 높이(clientHeight)는 그대로다 — 내비가 여전히 카드를
        덮고 탭도 먹는다. `flex:1` 인 `ScrollView` 에 **마진**을 주면 부모(`sheet`)가
        그 여백만큼을 flex 배분에서 미리 빼, `ScrollView` 의 렌더 높이(=클리핑 경계)
        자체가 줄어든다 — 내비가 있는 줄에는 스크롤해도 아무 것도 들어오지 않는다
        (`navSafeBottom` 계산은 위 참고). 그 여백은 `sheet` 의 배경색이 그대로
        비쳐 보인다(별도 View 를 더 두지 않는다).
      */}
      <ScrollView
        ref={scrollRef}
        style={[styles.scroll, { marginBottom: navSafeBottom }]}
        contentContainerStyle={[styles.content, { paddingBottom: SHEET_CONTENT_END_GAP }]}
        showsVerticalScrollIndicator={false}
        dataSet={{ mv: 'sheet-scroll' }}
      >
        <View
          style={[styles.grab, themed.grab]}
          dataSet={{ mv: 'grab' }}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="시트 스냅 — 탭하면 다음 칸, 끌면 원하는 칸으로"
          {...panResponder.panHandlers}
        >
          <View style={[styles.grabBar, themed.grabBar]} />
        </View>

        <Animated.View
          style={[{ opacity: flipStyle.opacity, transform: flipStyle.transform }, styles.flip]}
          dataSet={{ mv: 'flip' }}
        >
          {renderFace(session.scene, face, generation, innerWidth, selectedReportId)}
        </Animated.View>
      </ScrollView>
    </Animated.View>
  );
}

/**
 * 장면 × 면 → 컴포넌트. 시트 셸(접힘·플립·스크롤·스태거 재생)은 두 장면이 같고
 * 면의 내용만 다르다 — 그 갈림을 이 한 함수에 둔다. 설정 면은 장면을 가리지 않는다.
 *
 * valley 의 상세 면은 둘로 갈린다(F5c) — `selectedReportId` 가 있으면 제보 상세, 없으면
 * 구간 상세(`ValleyDetailFace`). 지도에 제보를 그리지 않으므로(결정 (j)) 이 값만으로
 * 충분히 구분된다 — 구간과 제보가 동시에 선택되는 일은 없다(`SessionStore` 가 서로를 지운다).
 */
function renderFace(
  scene: Scene,
  face: SheetFace,
  generation: number,
  innerWidth: number,
  selectedReportId: string | null,
) {
  if (face === 'settings') {
    return <SettingsFace generation={generation} innerWidth={innerWidth} />;
  }
  if (scene === 'valley') {
    if (face === 'list') return <ValleyListFace generation={generation} innerWidth={innerWidth} />;
    return selectedReportId !== null ? (
      <ReportDetailFace generation={generation} innerWidth={innerWidth} />
    ) : (
      <ValleyDetailFace generation={generation} innerWidth={innerWidth} />
    );
  }
  return face === 'list' ? (
    <SpotListFace generation={generation} innerWidth={innerWidth} />
  ) : (
    <SpotDetailFace generation={generation} innerWidth={innerWidth} />
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    zIndex: 5,
    pointerEvents: 'auto',
    borderTopLeftRadius: RADII.sheet,
    borderTopRightRadius: RADII.sheet,
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SHEET_PADDING_X,
  },
  grab: {
    // `position: sticky` 는 web 전역 스타일시트가 얹는다 — RN 에는 없는 값이다.
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  grabBar: {
    width: 44,
    height: 4,
    borderRadius: 2,
  },
  flip: {
    // 데모 `.flip{transform-origin:50% 45%}`
    transformOrigin: '50% 45%',
  },
});

const useThemedStyles = createThemedStyles((theme) => ({
  sheet: { backgroundColor: theme.colors.bg },
  grab: { backgroundColor: theme.colors.bg },
  grabBar: { backgroundColor: theme.colors.grab },
}));

/** 시트 폭은 컬럼과 같다 — 데모의 `width:min(var(--col), 100% - 32px)`. */
export const SHEET_MIN_MARGIN = SIZES.gutter;
