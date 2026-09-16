/**
 * 불꽃 파티클 시뮬레이션 — 플랫폼 무관 순수 계산.
 *
 * 원본 데모는 물리·좌표변환·WebGL 버퍼 관리·GL 상태 복구가 커스텀 레이어
 * 하나에 뒤섞여 있다. 그중 물리와 좌표변환만 떼어 여기에 두었다. 결과는
 * `Float32Array` 두 장(위치 xyz, 색 rgba)이며, 그것을 GPU 에 올리는 방법은
 * 이 클래스가 모른다. 그래서 web(WebGL 커스텀 레이어)과 네이티브(향후
 * Skia/GL 오버레이)가 같은 시뮬레이션을 공유할 수 있다.
 *
 * 좌표계는 메르카토르다 — 커스텀 레이어의 정점이 그 좌표계이기 때문이며,
 * 데모의 globe 함정 주석과 같은 이유로 구체 전환 중에는 렌더를 건너뛴다
 * (그 판단은 렌더러가 한다).
 */
import { LngLat } from '../geo/LngLat';
import type { MercatorPoint, MercatorProjectionPort } from '../geo/MercatorProjection';
import {
  DEFAULT_FIREWORK_CONFIG,
  FIREWORK_PALETTE,
  type FireworkConfig,
  type Rgb,
} from './FireworkConfig';
import { MathRandomSource, type RandomSource } from './random';

type Particle = {
  readonly vx: number;
  readonly vy: number;
  readonly vz: number;
  readonly color: Rgb;
  readonly lifeSeconds: number;
};

type Burst = {
  readonly origin: MercatorPoint;
  readonly particles: readonly Particle[];
  readonly startedAtSeconds: number;
  /**
   * 1m → 메르카토르 단위 배율. 데모는 흔들린 좌표가 아니라 발사 지점
   * 위도로 매 프레임 계산한다(`meters()` 가 상수 `LAUNCH` 를 쓴다).
   * 발사 지점이 고정이라 프레임마다 다시 구할 이유가 없어 버스트에 담았다.
   */
  readonly meterScale: number;
};

/** `sample()` 이 채워 넣는 대상 버퍼. */
export type ParticleBuffers = {
  /** 파티클당 xyz 3개. */
  readonly positions: Float32Array;
  /** 파티클당 rgba 4개. */
  readonly colors: Float32Array;
};

export type ParticleSimulationOptions = {
  readonly projection: MercatorProjectionPort;
  readonly random?: RandomSource;
  readonly config?: FireworkConfig;
  readonly palette?: readonly Rgb[];
};

export class ParticleSimulation {
  readonly config: FireworkConfig;

  readonly #projection: MercatorProjectionPort;
  readonly #random: RandomSource;
  readonly #palette: readonly Rgb[];
  readonly #bursts: Burst[] = [];

  constructor(options: ParticleSimulationOptions) {
    this.#projection = options.projection;
    this.#random = options.random ?? new MathRandomSource();
    this.config = options.config ?? DEFAULT_FIREWORK_CONFIG;
    this.#palette = options.palette ?? FIREWORK_PALETTE;
  }

  get burstCount(): number {
    return this.#bursts.length;
  }

  /** 버퍼가 담아야 하는 최대 파티클 수. */
  get capacity(): number {
    return this.config.particlesPerBurst * this.config.maxBursts;
  }

  /** 시뮬레이션 용량에 맞는 버퍼를 새로 만든다. */
  allocateBuffers(): ParticleBuffers {
    return {
      positions: new Float32Array(this.capacity * 3),
      colors: new Float32Array(this.capacity * 4),
    };
  }

  /** 새 버스트를 띄운다. 정원을 넘으면 가장 오래된 버스트를 버린다. */
  spawn(launchSite: LngLat, nowSeconds: number): void {
    if (this.#bursts.length >= this.config.maxBursts) this.#bursts.shift();
    this.#bursts.push(this.#createBurst(launchSite, nowSeconds));
  }

  clear(): void {
    this.#bursts.length = 0;
  }

  /**
   * 현재 시각의 살아 있는 파티클을 버퍼에 채우고 그 개수를 돌려준다.
   * 수명이 끝난 버스트는 이 과정에서 정리된다.
   *
   * 데모와 동일한 물리:
   *   drag = exp(-k·t)
   *   dx = vx·t·drag,  dy = vy·t·drag,  dz = vz·t·drag − ½·g·t²
   *   alpha = (1 − t/life)²      (제곱 감쇠 → 잔광)
   * 메르카토르 y 축은 남쪽이 + 이므로 dy 를 뺀다.
   */
  sample(nowSeconds: number, buffers: ParticleBuffers): number {
    const { positions, colors } = buffers;
    const { dragCoefficient, gravityMps2 } = this.config;
    let count = 0;

    for (const burst of this.#bursts) {
      const elapsed = nowSeconds - burst.startedAtSeconds;
      const drag = Math.exp(-dragCoefficient * elapsed);
      const fall = 0.5 * gravityMps2 * elapsed * elapsed;
      const scale = burst.meterScale;

      for (const particle of burst.particles) {
        if (elapsed > particle.lifeSeconds) continue;
        const dx = particle.vx * elapsed * drag;
        const dy = particle.vy * elapsed * drag;
        const dz = particle.vz * elapsed * drag - fall;
        const alpha = Math.max(0, 1 - elapsed / particle.lifeSeconds);

        positions[count * 3] = burst.origin.x + dx * scale;
        positions[count * 3 + 1] = burst.origin.y - dy * scale;
        positions[count * 3 + 2] = Math.max(0, burst.origin.z + dz * scale);

        colors[count * 4] = particle.color[0];
        colors[count * 4 + 1] = particle.color[1];
        colors[count * 4 + 2] = particle.color[2];
        colors[count * 4 + 3] = alpha * alpha;
        count += 1;
      }
    }

    this.#retire(nowSeconds);
    return count;
  }

  #retire(nowSeconds: number): void {
    // 가장 오래된 것부터 들어 있으므로 앞에서부터 걷어내면 된다.
    while (this.#bursts.length > 0) {
      const oldest = this.#bursts[0];
      if (oldest === undefined) break;
      const maxLife = this.config.minLifeSeconds + this.config.lifeSpreadSeconds;
      if (nowSeconds - oldest.startedAtSeconds <= maxLife) break;
      this.#bursts.shift();
    }
  }

  #createBurst(launchSite: LngLat, nowSeconds: number): Burst {
    const config = this.config;
    const jitter = config.originJitterDegrees;
    const altitude = config.minAltitudeMeters + this.#random.next() * config.altitudeSpreadMeters;

    // 발사 지점을 살짝 흔든다. 흔든 좌표가 범위를 벗어날 수는 없지만,
    // 값 객체 규약을 우회하지 않도록 검증 경로를 통과시킨다.
    const jittered = LngLat.create(
      launchSite.lng + (this.#random.next() - 0.5) * jitter,
      launchSite.lat + (this.#random.next() - 0.5) * jitter,
    );
    const origin = jittered.ok ? jittered.value : launchSite;

    const paletteColor = this.#pickColor();
    const particles: Particle[] = [];
    for (let index = 0; index < config.particlesPerBurst; index += 1) {
      // 구면 균등 분포 — 위도각을 acos(2u−1) 로 뽑아야 극이 몰리지 않는다.
      const theta = this.#random.next() * Math.PI * 2;
      const phi = Math.acos(2 * this.#random.next() - 1);
      const speed = config.minSpeedMps + this.#random.next() * config.speedSpreadMps;
      particles.push({
        vx: Math.sin(phi) * Math.cos(theta) * speed,
        vy: Math.sin(phi) * Math.sin(theta) * speed,
        vz: Math.cos(phi) * speed,
        color: paletteColor,
        lifeSeconds: config.minLifeSeconds + this.#random.next() * config.lifeSpreadSeconds,
      });
    }

    return {
      origin: this.#projection.project(origin, altitude),
      particles,
      startedAtSeconds: nowSeconds,
      meterScale: this.#projection.meterScaleAt(launchSite),
    };
  }

  #pickColor(): Rgb {
    const index = (this.#random.next() * this.#palette.length) | 0;
    return this.#palette[index] ?? [1, 1, 1];
  }
}
