/**
 * `/firework` — 불꽃축제 지도 데모 화면 (D2 보존).
 *
 * F1 전까지 `app/index.tsx` 였다. 화면은 그대로이고 셸은 `MapScreen` 으로 옮겨
 * 계곡 화면과 공유한다 — 파리티 기준은 계속 이 라우트다(`docs/PARITY.md`).
 */
import {
  INITIAL_VIEW,
  LAUNCH_SITE,
  type SceneSource,
  StaticFestivalRepository,
} from '@modu-valley/core';
import { MapScreen } from '@/components/shell/MapScreen';

/** 모듈 상수 — 참조가 바뀌면 세션이 다시 만들어지므로 렌더마다 만들지 않는다. */
const FESTIVAL_SOURCE: SceneSource = {
  scene: 'festival',
  repository: new StaticFestivalRepository(),
};

export default function FireworkScreen() {
  return (
    <MapScreen source={FESTIVAL_SOURCE} initialCenter={LAUNCH_SITE} initialView={INITIAL_VIEW} />
  );
}
