/**
 * 베이스맵 헬스 상태기계(C7) — valley-ds `base-map-health.ts` 의 규칙을 경계 시각까지 고정한다.
 *   첫 실패 arm → 8초 지속이면 장애 → 타일 하나라도 오면 회복 → 재arm 은 새 시각.
 */
import { describe, expect, it } from 'vitest';
import {
  evaluate,
  INITIAL_BASE_MAP_HEALTH,
  isBaseMapUrl,
  noteFailure,
  noteSuccess,
  OUTAGE_SUSTAIN_MS,
  sourceUrlOf,
} from '../src/domain/basemap/BaseMapHealth';
import { BaseMapHealthMonitor } from '../src/domain/basemap/BaseMapHealthMonitor';

const HOSTS = ['tiles.openfreemap.org', 's3.amazonaws.com/elevation-tiles-prod'] as const;

describe('순수 상태기계', () => {
  it('첫 실패에서 arm 하고, 다음 실패는 시각을 바꾸지 않는다', () => {
    const first = noteFailure(INITIAL_BASE_MAP_HEALTH, 1_000);
    expect(first).toEqual({ armedAt: 1_000, failures: 1, outage: false });
    const second = noteFailure(first, 5_000);
    expect(second).toEqual({ armedAt: 1_000, failures: 2, outage: false });
  });

  it('경계 시각 — 8초 직전은 정상, 정확히 8초부터 장애', () => {
    const armed = noteFailure(INITIAL_BASE_MAP_HEALTH, 1_000);
    expect(evaluate(armed, 1_000 + OUTAGE_SUSTAIN_MS - 1).outage).toBe(false);
    expect(evaluate(armed, 1_000 + OUTAGE_SUSTAIN_MS).outage).toBe(true);
    expect(evaluate(armed, 1_000 + OUTAGE_SUSTAIN_MS + 60_000).outage).toBe(true);
  });

  it('arm 되지 않은 상태는 평가해도 같은 참조', () => {
    expect(evaluate(INITIAL_BASE_MAP_HEALTH, 99_999)).toBe(INITIAL_BASE_MAP_HEALTH);
    const armed = noteFailure(INITIAL_BASE_MAP_HEALTH, 0);
    // 판정이 바뀌지 않으면 같은 참조 — 스토어가 쓸데없이 갱신되지 않게.
    expect(evaluate(armed, 10)).toBe(armed);
  });

  it('성공은 장애 중이든 arm 중이든 처음으로 되돌린다', () => {
    const outage = evaluate(noteFailure(INITIAL_BASE_MAP_HEALTH, 0), OUTAGE_SUSTAIN_MS);
    expect(outage.outage).toBe(true);
    expect(noteSuccess()).toBe(INITIAL_BASE_MAP_HEALTH);
  });

  it('회복 뒤 다시 실패하면 새 시각으로 재arm — 이전 시각이 남지 않는다', () => {
    const outage = evaluate(noteFailure(INITIAL_BASE_MAP_HEALTH, 0), OUTAGE_SUSTAIN_MS);
    const recovered = noteSuccess();
    const rearmed = noteFailure(recovered, 20_000);
    expect(rearmed).toEqual({ armedAt: 20_000, failures: 1, outage: false });
    expect(evaluate(rearmed, 20_000 + OUTAGE_SUSTAIN_MS - 1).outage).toBe(false);
    expect(evaluate(rearmed, 20_000 + OUTAGE_SUSTAIN_MS).outage).toBe(true);
    expect(outage.armedAt).toBe(0);
  });
});

describe('isBaseMapUrl', () => {
  it('스타일·타일·TileJSON — openfreemap 호스트 전부', () => {
    expect(isBaseMapUrl('https://tiles.openfreemap.org/styles/positron', HOSTS)).toBe(true);
    expect(isBaseMapUrl('https://tiles.openfreemap.org/planet', HOSTS)).toBe(true);
    expect(
      isBaseMapUrl('https://tiles.openfreemap.org/planet/20250101/12/3486/1594.pbf', HOSTS),
    ).toBe(true);
  });

  it('DEM — s3 는 elevation-tiles-prod 경로 아래만', () => {
    expect(
      isBaseMapUrl('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/12/1/2.png', HOSTS),
    ).toBe(true);
    expect(isBaseMapUrl('https://s3.amazonaws.com/elevation-tiles-prod', HOSTS)).toBe(true);
    expect(isBaseMapUrl('https://s3.amazonaws.com/elevation-tiles-production/x.png', HOSTS)).toBe(
      false,
    );
    expect(isBaseMapUrl('https://s3.amazonaws.com/other-bucket/x.png', HOSTS)).toBe(false);
  });

  it('GeoJSON·아이콘·상대 경로·잘못된 URL 은 대상이 아니다', () => {
    expect(isBaseMapUrl('https://example.com/valley.geojson', HOSTS)).toBe(false);
    expect(isBaseMapUrl('/data/valley/segments.geojson', HOSTS)).toBe(false);
    expect(isBaseMapUrl('data:image/svg+xml;base64,AAAA', HOSTS)).toBe(false);
    expect(isBaseMapUrl('not a url', HOSTS)).toBe(false);
    expect(isBaseMapUrl('https://evil.tiles.openfreemap.org.example/x', HOSTS)).toBe(false);
  });

  it('포트가 붙은 호스트(개발용 프록시)도 호스트 문자열이 같으면 매치', () => {
    expect(isBaseMapUrl('http://localhost:8099/planet', ['localhost:8099'])).toBe(true);
    expect(isBaseMapUrl('http://localhost:8098/planet', ['localhost:8099'])).toBe(false);
  });
});

describe('sourceUrlOf', () => {
  it('TileJSON url → tiles 첫 템플릿 → null', () => {
    expect(sourceUrlOf({ type: 'vector', url: 'https://a/planet' })).toBe('https://a/planet');
    expect(sourceUrlOf({ type: 'raster-dem', tiles: ['https://b/{z}/{x}/{y}.png'] })).toBe(
      'https://b/{z}/{x}/{y}.png',
    );
    expect(sourceUrlOf({ type: 'geojson', data: { type: 'FeatureCollection' } })).toBeNull();
    expect(sourceUrlOf(null)).toBeNull();
    expect(sourceUrlOf(undefined)).toBeNull();
  });
});

/** 가짜 시계 + 타이머 — 모니터가 잰 지연과 부른 시각을 직접 밟는다. */
function fakeClock() {
  let now = 0;
  const timers: { at: number; handler: () => void; id: number }[] = [];
  let seq = 0;
  return {
    now: () => now,
    setTimeout: (handler: () => void, delayMs: number) => {
      const id = ++seq;
      timers.push({ at: now + delayMs, handler, id });
      return id;
    },
    clearTimeout: (handle: unknown) => {
      const index = timers.findIndex((t) => t.id === handle);
      if (index !== -1) timers.splice(index, 1);
    },
    advance(ms: number) {
      now += ms;
      for (const timer of [...timers].sort((a, b) => a.at - b.at)) {
        if (timer.at > now) break;
        timers.splice(timers.indexOf(timer), 1);
        timer.handler();
      }
    },
    pending: () => timers.length,
  };
}

describe('BaseMapHealthMonitor', () => {
  it('첫 실패 → 8초 뒤 장애 한 번, 성공 → 즉시 회복, 타이머는 정리된다', () => {
    const clock = fakeClock();
    const changes: boolean[] = [];
    const monitor = new BaseMapHealthMonitor({
      onChange: (h) => changes.push(h.outage),
      ...clock,
    });

    monitor.failure();
    monitor.failure();
    expect(monitor.state.failures).toBe(2);
    expect(clock.pending()).toBe(1);
    clock.advance(OUTAGE_SUSTAIN_MS - 1);
    expect(monitor.state.outage).toBe(false);
    clock.advance(1);
    expect(monitor.state.outage).toBe(true);
    expect(changes.filter(Boolean)).toHaveLength(1);

    monitor.success();
    expect(monitor.state).toBe(INITIAL_BASE_MAP_HEALTH);
    expect(changes.at(-1)).toBe(false);
    expect(clock.pending()).toBe(0);
    monitor.dispose();
  });

  it('8초 안에 타일이 오면 타이머가 끊겨 장애가 되지 않고, 다시 실패하면 재arm', () => {
    const clock = fakeClock();
    const monitor = new BaseMapHealthMonitor({ onChange: () => {}, ...clock });
    monitor.failure();
    clock.advance(3_000);
    monitor.success();
    expect(clock.pending()).toBe(0);
    clock.advance(OUTAGE_SUSTAIN_MS);
    expect(monitor.state.outage).toBe(false);

    monitor.failure();
    expect(monitor.state.armedAt).toBe(3_000 + OUTAGE_SUSTAIN_MS);
    clock.advance(OUTAGE_SUSTAIN_MS);
    expect(monitor.state.outage).toBe(true);
    monitor.dispose();
  });

  it('처음 상태에서의 성공은 아무 알림도 내지 않는다(타일마다 스토어가 갱신되지 않게)', () => {
    const clock = fakeClock();
    let calls = 0;
    const monitor = new BaseMapHealthMonitor({ onChange: () => calls++, ...clock });
    monitor.success();
    monitor.success();
    expect(calls).toBe(0);
    monitor.dispose();
  });

  it('reset 은 재시도 — 장애 중에도 타이머를 끊고 처음으로', () => {
    const clock = fakeClock();
    const monitor = new BaseMapHealthMonitor({ onChange: () => {}, ...clock });
    monitor.failure();
    clock.advance(OUTAGE_SUSTAIN_MS);
    expect(monitor.state.outage).toBe(true);
    monitor.reset();
    expect(monitor.state).toBe(INITIAL_BASE_MAP_HEALTH);
    expect(clock.pending()).toBe(0);
    monitor.dispose();
  });

  it('성공 무시 구간(네이티브) — 실패 직후의 성공은 세지 않고, 구간이 지나면 회복', () => {
    const clock = fakeClock();
    const monitor = new BaseMapHealthMonitor({
      onChange: () => {},
      successQuietMs: 500,
      ...clock,
    });
    monitor.failure();
    clock.advance(100);
    monitor.success();
    expect(monitor.state.armedAt).toBe(0);
    clock.advance(400);
    monitor.success();
    expect(monitor.state).toBe(INITIAL_BASE_MAP_HEALTH);
    monitor.dispose();
  });

  it('dispose 뒤에는 타이머가 발화하지 않는다', () => {
    const clock = fakeClock();
    let calls = 0;
    const monitor = new BaseMapHealthMonitor({ onChange: () => calls++, ...clock });
    monitor.failure();
    monitor.dispose();
    expect(clock.pending()).toBe(0);
    clock.advance(OUTAGE_SUSTAIN_MS);
    expect(calls).toBe(1);
    monitor.failure();
    expect(calls).toBe(1);
  });
});
