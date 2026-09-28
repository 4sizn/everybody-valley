/**
 * 카메라 명령이 이 화면에서 어떻게 실행되는지 — 건너뛰기와 짧은 이동 낮추기.
 * maplibre `Map` 은 이 컨트롤러가 실제로 쓰는 메서드만 가짜로 세운다.
 */
import { cameraCommand, LngLat, NONE_CANCELLATION_TOKEN, NoopLogger } from '@modu-valley/core';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { expect, it, vi } from 'vitest';
import { CameraController } from '../src/map/CameraController';

const CENTER = (() => {
  const made = LngLat.create(127, 35);
  if (!made.ok) throw made.error;
  return made.value;
})();

/** 화면 400×800. `project` 는 넘긴 픽셀 자리를 그대로 돌려주게 테스트가 정한다. */
function fakeMap(pose: { zoom: number; pitch: number; bearing: number }, screen: [number, number]) {
  const listeners = new Map<string, (payload?: unknown) => void>();
  const map = {
    getZoom: () => pose.zoom,
    getPitch: () => pose.pitch,
    getBearing: () => pose.bearing,
    isMoving: () => false,
    project: () => ({ x: screen[0], y: screen[1] }),
    getContainer: () => ({ clientWidth: 400, clientHeight: 800 }),
    flyTo: vi.fn(),
    easeTo: vi.fn(),
    stop: vi.fn(),
    once: (event: string, handler: (payload?: unknown) => void) => listeners.set(event, handler),
    off: vi.fn(),
  };
  return {
    map: map as unknown as MapLibreMap,
    spy: map,
    settle: (payload?: unknown) => listeners.get('moveend')?.(payload),
  };
}

it('이미 같은 구도면 지도를 건드리지 않는다', async () => {
  // 목표 중심이 화면 중심에서 2px — 허용 오차(10px) 안.
  const { map, spy } = fakeMap({ zoom: 14.2, pitch: 0, bearing: 0 }, [202, 400]);
  const camera = new CameraController(map, new NoopLogger(), { shortHopEase: true });

  const result = await camera.move(
    cameraCommand(
      { center: CENTER, zoom: 14.2, pitch: 0, bearing: 0 },
      { motion: 'fly', durationMs: 1400 },
    ),
    NONE_CANCELLATION_TOKEN,
  );

  expect(result.ok).toBe(true);
  expect(spy.flyTo).not.toHaveBeenCalled();
  expect(spy.easeTo).not.toHaveBeenCalled();
});

it('화면 안의 가까운 목표로 가는 비행은 직선·짧은 시간으로 낮춘다', async () => {
  // 화면 중심에서 100px 아래 — 반높이(400)의 75% 안.
  const { map, spy, settle } = fakeMap({ zoom: 14.2, pitch: 0, bearing: 0 }, [200, 500]);
  const camera = new CameraController(map, new NoopLogger(), { shortHopEase: true });

  const moved = camera.move(
    cameraCommand({ center: CENTER, zoom: 14.2 }, { motion: 'fly', durationMs: 1400, curve: 1.5 }),
    NONE_CANCELLATION_TOKEN,
  );
  settle();

  expect((await moved).ok).toBe(true);
  expect(spy.flyTo).not.toHaveBeenCalled();
  const options = spy.easeTo.mock.calls[0]?.[0];
  expect(options.duration).toBe(320 + 100 * 0.9);
  // `curve` 는 포물선 비행 전용 — 직선으로 낮춘 명령에는 넘기지 않는다.
  expect(options.curve).toBeUndefined();
});

it('먼 목표는 프리셋대로 포물선 비행 그대로 둔다', async () => {
  // 화면 밖(중심에서 700px 아래).
  const { map, spy, settle } = fakeMap({ zoom: 14.2, pitch: 0, bearing: 0 }, [200, 1100]);
  const camera = new CameraController(map, new NoopLogger(), { shortHopEase: true });

  const moved = camera.move(
    cameraCommand({ center: CENTER, zoom: 14.2 }, { motion: 'fly', durationMs: 1400 }),
    NONE_CANCELLATION_TOKEN,
  );
  settle();

  expect((await moved).ok).toBe(true);
  expect(spy.easeTo).not.toHaveBeenCalled();
  expect(spy.flyTo.mock.calls[0]?.[0].duration).toBe(1400);
});

it('데모(`/firework`)는 가까운 목표라도 포물선 비행을 유지한다', async () => {
  const { map, spy, settle } = fakeMap({ zoom: 14.2, pitch: 0, bearing: 0 }, [200, 500]);
  const camera = new CameraController(map, new NoopLogger(), { shortHopEase: false });

  const moved = camera.move(
    cameraCommand({ center: CENTER, zoom: 14.2 }, { motion: 'fly', durationMs: 1400 }),
    NONE_CANCELLATION_TOKEN,
  );
  settle();

  expect((await moved).ok).toBe(true);
  expect(spy.flyTo).toHaveBeenCalledTimes(1);
});

it('같은 중심이라도 방위가 다르면 움직인다', async () => {
  const { map, spy, settle } = fakeMap({ zoom: 14.2, pitch: 0, bearing: 0 }, [200, 400]);
  const camera = new CameraController(map, new NoopLogger(), { shortHopEase: true });

  const moved = camera.move(
    cameraCommand({ center: CENTER, zoom: 14.2, bearing: 90 }, { motion: 'ease', durationMs: 800 }),
    NONE_CANCELLATION_TOKEN,
  );
  settle();

  expect((await moved).ok).toBe(true);
  expect(spy.easeTo).toHaveBeenCalledTimes(1);
});

it('가려지지 않은 선택 지점은 시트가 커져도 그대로 둔다', async () => {
  // 화면 400×800, 시트가 아래 300px. 편한 영역은 화면 y 188.4..431.6 — 지점 y 300 은 그 안이다.
  const { map, spy } = fakeMap({ zoom: 14.2, pitch: 0, bearing: 0 }, [200, 300]);
  const camera = new CameraController(map, new NoopLogger(), { shortHopEase: true });

  const result = await camera.move(
    cameraCommand(
      { center: CENTER, zoom: 14.2, offset: [0, -70], keepVisible: { top: 120, bottom: 300 } },
      { motion: 'ease', durationMs: 320 },
    ),
    NONE_CANCELLATION_TOKEN,
  );

  expect(result.ok).toBe(true);
  expect(spy.easeTo).not.toHaveBeenCalled();
  expect(spy.flyTo).not.toHaveBeenCalled();
});

it('시트에 가려진 지점은 화면 가운데가 아니라 들어올 만큼만 민다', async () => {
  // 같은 화면, 지점은 y 700 — 시트(위 경계 500) 아래로 들어가 보이지 않는다.
  const { map, spy, settle } = fakeMap({ zoom: 14.2, pitch: 0, bearing: 0 }, [200, 700]);
  const camera = new CameraController(map, new NoopLogger(), { shortHopEase: true });

  const moved = camera.move(
    cameraCommand(
      { center: CENTER, zoom: 14.2, offset: [0, -70], keepVisible: { top: 120, bottom: 300 } },
      { motion: 'ease', durationMs: 320 },
    ),
    NONE_CANCELLATION_TOKEN,
  );
  settle();

  expect((await moved).ok).toBe(true);
  /* 남는 높이 380 · 여백 68.4 → 편한 영역의 아래 경계는 중심 기준 +31.6. 가운데로 데려오는
     옛 동작이라면 넘어온 offset -70 이 그대로 쓰여 370px 을 옮겼겠지만, 경계까지만 민다. */
  const offset = spy.easeTo.mock.calls[0]?.[0].offset;
  expect(offset[0]).toBe(0);
  expect(offset[1]).toBeCloseTo(31.6, 5);
});

it('각도가 크게 바뀌는 이동은 가까워도 프리셋 시간을 지킨다', async () => {
  // 중심은 100px 만 움직이지만 pitch 0→58, bearing 0→87 — 화면 전체가 뒤집힌다.
  const { map, spy, settle } = fakeMap({ zoom: 14.2, pitch: 0, bearing: 0 }, [200, 500]);
  const camera = new CameraController(map, new NoopLogger(), { shortHopEase: true });

  const moved = camera.move(
    cameraCommand(
      { center: CENTER, zoom: 14.2, pitch: 58, bearing: 87 },
      { motion: 'fly', durationMs: 1400 },
    ),
    NONE_CANCELLATION_TOKEN,
  );
  settle();

  expect((await moved).ok).toBe(true);
  expect(spy.easeTo).not.toHaveBeenCalled();
  expect(spy.flyTo.mock.calls[0]?.[0].duration).toBe(1400);
});
