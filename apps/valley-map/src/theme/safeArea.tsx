/**
 * 안전 영역(노치·상태바·홈 인디케이터) 배선.
 *
 * 데모는 브라우저 창을 전제로 하므로 `top:16px` / `bottom:16px` 이면 충분하다.
 * 휴대폰에서는 그 자리에 상태바·다이내믹 아일랜드·홈 인디케이터가 있어,
 * 상단바가 노치에 물리고 하단 내비가 홈 바에 겹친다. 그래서 화면 가장자리에
 * 붙는 요소는 여백에 안전 영역을 **더한다**.
 *
 * web 에서는 인셋이 0 이므로 데모와 같은 값이 그대로 나온다
 * (iOS Safari 홈 화면 추가처럼 실제 인셋이 있는 환경에서는 그만큼 밀리는데,
 * 그게 옳은 동작이다).
 *
 * `initialMetrics` 를 반드시 넘긴다 — 넘기지 않으면 provider 가 측정 전까지
 * 자식을 렌더하지 않아 정적 렌더링(expo-router `output: 'static'`)의 HTML 이
 * 비어 나온다.
 */
import type { ReactNode } from 'react';
import {
  type EdgeInsets,
  initialWindowMetrics,
  type Metrics,
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

/** 측정값을 얻을 수 없는 환경(SSR·정적 렌더링)의 초깃값. */
const ZERO_METRICS: Metrics = {
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
  frame: { x: 0, y: 0, width: 0, height: 0 },
};

export function AppSafeAreaProvider({ children }: { readonly children: ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics ?? ZERO_METRICS}>
      {children}
    </SafeAreaProvider>
  );
}

/**
 * 화면 가장자리 여백에 더할 인셋.
 *
 * 훅을 하나로 모아 둔 이유는 "어디에 안전 영역을 더했는가"를 한 번에 볼 수
 * 있게 하려는 것이다. 값 자체는 `useSafeAreaInsets` 그대로다.
 */
export function useSafeAreaGutters(): EdgeInsets {
  return useSafeAreaInsets();
}
