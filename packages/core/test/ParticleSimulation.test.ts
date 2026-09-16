/**
 * 불꽃 시뮬레이션 테스트.
 *
 * 물리는 데모의 렌더 루프에서 그대로 옮겼다. 여기서 검증하는 것은
 *  · 버퍼 채우기 규약 (개수, xyz/rgba 배치)
 *  · 물리 (드래그, 중력, 제곱 감쇠, 남쪽 + 인 y 축)
 *  · 정원 관리 (MAX_BURSTS, 수명 지난 버스트 회수)
 *  · 시드 고정 시 결정성 — 스크린샷 파리티 비교의 전제
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_FIREWORK_CONFIG } from '../src/domain/fireworks/FireworkConfig';
import { ParticleSimulation } from '../src/domain/fireworks/ParticleSimulation';
import { SeededRandomSource } from '../src/domain/fireworks/random';
import { LngLat } from '../src/domain/geo/LngLat';
import { WebMercatorProjection } from '../src/domain/geo/MercatorProjection';

const LAUNCH = LngLat.of(126.9345, 37.5285);

function createSimulation(seed = 42): ParticleSimulation {
  return new ParticleSimulation({
    projection: new WebMercatorProjection(),
    random: new SeededRandomSource(seed),
  });
}

describe('버퍼 규약', () => {
  it('용량은 파티클 수 × 최대 버스트 수', () => {
    const simulation = createSimulation();
    const { particlesPerBurst, maxBursts } = DEFAULT_FIREWORK_CONFIG;
    expect(simulation.capacity).toBe(particlesPerBurst * maxBursts);

    const buffers = simulation.allocateBuffers();
    expect(buffers.positions.length).toBe(simulation.capacity * 3);
    expect(buffers.colors.length).toBe(simulation.capacity * 4);
  });

  it('발사 직후에는 모든 파티클이 살아 있다', () => {
    const simulation = createSimulation();
    const buffers = simulation.allocateBuffers();
    simulation.spawn(LAUNCH, 100);
    expect(simulation.sample(100, buffers)).toBe(DEFAULT_FIREWORK_CONFIG.particlesPerBurst);
  });

  it('수명이 다하면 0 이 되고 버스트가 회수된다', () => {
    const simulation = createSimulation();
    const buffers = simulation.allocateBuffers();
    simulation.spawn(LAUNCH, 100);
    const maxLife =
      DEFAULT_FIREWORK_CONFIG.minLifeSeconds + DEFAULT_FIREWORK_CONFIG.lifeSpreadSeconds;
    expect(simulation.sample(100 + maxLife + 0.1, buffers)).toBe(0);
    expect(simulation.burstCount).toBe(0);
  });

  it('정원을 넘으면 가장 오래된 버스트를 버린다', () => {
    const simulation = createSimulation();
    for (let i = 0; i < DEFAULT_FIREWORK_CONFIG.maxBursts + 3; i += 1) {
      simulation.spawn(LAUNCH, 100);
    }
    expect(simulation.burstCount).toBe(DEFAULT_FIREWORK_CONFIG.maxBursts);
  });

  it('clear() 는 모든 버스트를 지운다', () => {
    const simulation = createSimulation();
    simulation.spawn(LAUNCH, 100);
    simulation.clear();
    expect(simulation.burstCount).toBe(0);
  });
});

describe('물리', () => {
  it('t=0 에서는 발사 원점에 모여 있고 알파가 1 이다', () => {
    const simulation = createSimulation();
    const buffers = simulation.allocateBuffers();
    simulation.spawn(LAUNCH, 0);
    const count = simulation.sample(0, buffers);

    const x0 = buffers.positions[0] ?? 0;
    const y0 = buffers.positions[1] ?? 0;
    for (let i = 1; i < count; i += 1) {
      expect(buffers.positions[i * 3]).toBeCloseTo(x0, 12);
      expect(buffers.positions[i * 3 + 1]).toBeCloseTo(y0, 12);
    }
    expect(buffers.colors[3]).toBeCloseTo(1, 12);
  });

  it('시간이 지나면 퍼지고 알파가 제곱으로 감쇠한다', () => {
    const simulation = createSimulation();
    const buffers = simulation.allocateBuffers();
    simulation.spawn(LAUNCH, 0);

    simulation.sample(0, buffers);
    const originX = buffers.positions[0] ?? 0;

    simulation.sample(0.5, buffers);
    const spread = Math.abs((buffers.positions[0] ?? 0) - originX);
    expect(spread).toBeGreaterThan(0);

    const alphaAt = (t: number): number => {
      simulation.sample(t, buffers);
      return buffers.colors[3] ?? 0;
    };
    const a1 = alphaAt(0.4);
    const a2 = alphaAt(0.8);
    expect(a2).toBeLessThan(a1);
  });

  it('중력 때문에 결국 아래로 내려오고, 지면 아래로는 가지 않는다', () => {
    const simulation = createSimulation();
    const buffers = simulation.allocateBuffers();
    simulation.spawn(LAUNCH, 0);
    for (let t = 0; t <= 3; t += 0.25) {
      const count = simulation.sample(t, buffers);
      for (let i = 0; i < count; i += 1) {
        expect(buffers.positions[i * 3 + 2]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('색은 팔레트 안의 한 색으로 버스트 전체가 통일된다', () => {
    const simulation = createSimulation();
    const buffers = simulation.allocateBuffers();
    simulation.spawn(LAUNCH, 0);
    const count = simulation.sample(0, buffers);
    const [r, g, b] = [buffers.colors[0], buffers.colors[1], buffers.colors[2]];
    for (let i = 1; i < count; i += 1) {
      expect(buffers.colors[i * 4]).toBe(r);
      expect(buffers.colors[i * 4 + 1]).toBe(g);
      expect(buffers.colors[i * 4 + 2]).toBe(b);
    }
  });
});

describe('결정성', () => {
  it('같은 시드는 같은 파티클을 만든다', () => {
    const a = createSimulation(7);
    const b = createSimulation(7);
    const bufA = a.allocateBuffers();
    const bufB = b.allocateBuffers();
    a.spawn(LAUNCH, 0);
    b.spawn(LAUNCH, 0);
    const countA = a.sample(0.7, bufA);
    const countB = b.sample(0.7, bufB);
    expect(countA).toBe(countB);
    expect(Array.from(bufA.positions.slice(0, countA * 3))).toEqual(
      Array.from(bufB.positions.slice(0, countB * 3)),
    );
  });

  it('다른 시드는 다른 파티클을 만든다', () => {
    const a = createSimulation(7);
    const b = createSimulation(8);
    const bufA = a.allocateBuffers();
    const bufB = b.allocateBuffers();
    a.spawn(LAUNCH, 0);
    b.spawn(LAUNCH, 0);
    a.sample(0.7, bufA);
    b.sample(0.7, bufB);
    expect(Array.from(bufA.positions.slice(0, 30))).not.toEqual(
      Array.from(bufB.positions.slice(0, 30)),
    );
  });
});
