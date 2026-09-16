import { Logger, NoopLogger } from '@modu-valley/core';
import { facilityIconSvgById, MARKER_ICON_PIXEL_RATIO } from '@modu-valley/map-style';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MarkerIconRegistry } from '../src/map/MarkerIconRegistry';

type Resolver = ((id: string) => void | Promise<void>) | null;

/** maplibre `Map` 중 레지스트리가 만지는 네 조각. */
function fakeMap() {
  const images = new Map<string, { image: unknown; options: unknown }>();
  const state = { resolver: null as Resolver, style: {} as unknown };
  const map = {
    get style() {
      return state.style;
    },
    setMissingStyleImageResolver: vi.fn((resolver: Resolver) => {
      state.resolver = resolver;
      return map;
    }),
    hasImage: vi.fn((id: string) => images.has(id)),
    addImage: vi.fn((id: string, image: unknown, options?: unknown) => {
      images.set(id, { image, options });
      return map;
    }),
  };
  return { map: map as unknown as MapLibreMap, images, state };
}

/** `new Image()` 대역 — `src` 를 기록하고 `decode()` 는 `decodeImpl` 의 결과를 따른다. */
class FakeImage {
  static instances: FakeImage[] = [];
  static decodeImpl: () => Promise<void> = async () => {};
  src = '';
  constructor() {
    FakeImage.instances.push(this);
  }
  decode(): Promise<void> {
    return FakeImage.decodeImpl();
  }
}

/** data URL 에서 SVG 문자열을 되읽는다. */
function svgOf(image: FakeImage | undefined): string | undefined {
  const prefix = 'data:image/svg+xml;charset=utf-8,';
  if (image === undefined || !image.src.startsWith(prefix)) return undefined;
  return decodeURIComponent(image.src.slice(prefix.length));
}

/** `error` 호출만 기록하는 로거. `child` 가 자기 자신을 돌려줘 하위 스코프 기록도 여기 모인다. */
class RecordingLogger extends Logger {
  readonly scope = 'recording';
  readonly errors: Array<{ message: string; error: unknown }> = [];
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(message: string, error?: unknown): void {
    this.errors.push({ message, error });
  }
  child(): Logger {
    return this;
  }
}

describe('MarkerIconRegistry', () => {
  beforeEach(() => {
    FakeImage.instances = [];
    FakeImage.decodeImpl = async () => {};
    vi.stubGlobal('Image', FakeImage);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('생성 시 resolver 를 걸고, 시설 ID 는 SVG → <img> 디코드 → addImage(pixelRatio 2)', async () => {
    const { map, images, state } = fakeMap();
    const registry = new MarkerIconRegistry(map, new NoopLogger());
    registry.register(facilityIconSvgById);
    expect(state.resolver).not.toBeNull();

    const result = state.resolver?.('facility/parking');
    expect(result).toBeInstanceOf(Promise);
    expect(registry.pendingCount).toBe(1);
    await result;

    expect(FakeImage.instances).toHaveLength(1);
    expect(svgOf(FakeImage.instances[0])).toBe(facilityIconSvgById('facility/parking'));
    expect(images.get('facility/parking')).toEqual({
      image: FakeImage.instances[0],
      options: { pixelRatio: MARKER_ICON_PIXEL_RATIO },
    });
    expect(registry.pendingCount).toBe(0);
  });

  it('같은 ID 의 동시 요청은 한 번만 굽고, 이미 있는 이미지는 건너뛴다', async () => {
    const { map, state } = fakeMap();
    const registry = new MarkerIconRegistry(map, new NoopLogger());
    registry.register(facilityIconSvgById);

    const first = state.resolver?.('facility/cafe/selected');
    const second = state.resolver?.('facility/cafe/selected');
    expect(second).toBe(first);
    await Promise.all([first, second]);
    expect(FakeImage.instances).toHaveLength(1);
    expect(map.addImage).toHaveBeenCalledTimes(1);

    // 이미 들어간 뒤의 요청은 아무 일도 하지 않는다.
    expect(state.resolver?.('facility/cafe/selected')).toBeUndefined();
    expect(FakeImage.instances).toHaveLength(1);
  });

  it('어느 팩토리도 모르는 ID 는 투명 1px 로 즉시 채운다(스프라이트 경고 억제, C4 동작)', () => {
    const { map, images, state } = fakeMap();
    const registry = new MarkerIconRegistry(map, new NoopLogger());
    registry.register(facilityIconSvgById);

    expect(state.resolver?.('poi_bus')).toBeUndefined();
    expect(FakeImage.instances).toHaveLength(0);
    expect(images.get('poi_bus')).toEqual({
      image: { width: 1, height: 1, data: new Uint8Array(4) },
      options: undefined,
    });
  });

  it('래스터화 실패는 Logger 로 남기고 addImage 하지 않는다 — 지도는 계속 산다', async () => {
    FakeImage.decodeImpl = () => Promise.reject(new Error('decode failed'));
    const { map, state } = fakeMap();
    const logger = new RecordingLogger();
    const registry = new MarkerIconRegistry(map, logger);
    registry.register(facilityIconSvgById);

    await state.resolver?.('facility/food');
    expect(map.addImage).not.toHaveBeenCalled();
    expect(registry.pendingCount).toBe(0);
    expect(logger.errors).toHaveLength(1);
    expect(logger.errors[0]?.message).toContain('마커 아이콘');
    expect(logger.errors[0]?.error).toEqual(new Error('decode failed'));
  });

  it('dispose — resolver 해제, 진행 중인 결과는 버리고, 뗀 팩토리는 더 부르지 않는다', async () => {
    const { map, state } = fakeMap();
    const registry = new MarkerIconRegistry(map, new NoopLogger());
    const handle = registry.register(facilityIconSvgById);

    const inflight = state.resolver?.('facility/store');
    registry.dispose();
    await inflight;
    // 이미지는 디코드됐지만 dispose 뒤라 지도에 넣지 않는다.
    expect(map.addImage).not.toHaveBeenCalled();
    expect(map.setMissingStyleImageResolver).toHaveBeenLastCalledWith(null);
    expect(state.resolver).toBeNull();

    handle.dispose();
    registry.dispose(); // 멱등
  });

  it('스타일이 사라진 지도(map.remove 이후)에는 addImage 하지 않는다', async () => {
    const { map, state } = fakeMap();
    const registry = new MarkerIconRegistry(map, new NoopLogger());
    registry.register(facilityIconSvgById);

    const inflight = state.resolver?.('facility/safety');
    state.style = undefined;
    await inflight;
    expect(map.addImage).not.toHaveBeenCalled();
    // 죽은 지도에는 resolver 해제도 시도하지 않는다(던진다).
    registry.dispose();
    expect(map.setMissingStyleImageResolver).toHaveBeenCalledTimes(1);
  });
});
