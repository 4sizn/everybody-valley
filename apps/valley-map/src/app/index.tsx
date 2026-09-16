/**
 * `/` — 계곡 화면 (기본). F1 MVP-1.
 *
 * 지도에 구간(선)·시설(점)이 그려지고, 시트에 구간 카드가 나오며, 카드 ↔ 지도
 * 선택이 양방향으로 이어진다. 데이터는 서버 없이 정적 GeoJSON —
 * `session/valleySource.ts` 가 번들된 계곡 합본(SD1, 시딩 전엔 샘플)을 읽어 저장소로 만든다.
 */
import { VALLEY_INITIAL_VIEW } from '@modu-valley/core';
import { MapScreen } from '@/components/shell/MapScreen';
import { VALLEY_INITIAL_CENTER, VALLEY_SOURCE } from '@/session/valleySource';

export default function ValleyScreen() {
  return (
    <MapScreen
      source={VALLEY_SOURCE}
      initialCenter={VALLEY_INITIAL_CENTER}
      initialView={VALLEY_INITIAL_VIEW}
    />
  );
}
