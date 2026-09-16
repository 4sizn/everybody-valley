/**
 * MapLibre 커스텀 레이어로서의 불꽃.
 *
 * 물리와 좌표변환은 코어의 `ParticleSimulation` 이, 발사 간격은
 * `BurstScheduler` 가 담당한다. 이 클래스에 남은 책임은 셋이다.
 *   1. GL 자원 생애 (프로그램·VAO·링 버퍼)
 *   2. 시뮬레이션 결과를 GPU 에 올려 그리기
 *   3. MapLibre 의 GL 상태 계약 지키기
 *
 * 원본 데모의 `fireworkLayer()` 클로저가 하던 일과 같지만, 실패가 로그에
 * 남고 자원이 반드시 회수된다.
 *
 * MapLibre 6 주의점: `defaultProjectionData.mainMatrix` 는 Float32Array 일
 * 수도 Float64Array 일 수도 있다(`ProjectionMatrix = Mat4f32 | Mat4f64`).
 * `uniformMatrix4fv` 는 64비트 배열을 받지 않으므로 매 프레임 32비트로
 * 옮겨 넣는다. v5 에서는 항상 32비트였어서 데모는 그대로 넘겼다.
 */
import {
  BurstScheduler,
  type Clock,
  type Disposable,
  DisposableStore,
  type LngLat,
  type Logger,
  type MercatorProjectionPort,
  type ParticleBuffers,
  ParticleSimulation,
  PerformanceClock,
  type RandomSource,
  WebMercatorProjection,
} from '@modu-valley/core';
import type {
  CustomLayerInterface,
  CustomRenderMethodInput,
  Map as MapLibreMap,
} from 'maplibre-gl';
import {
  FIREWORK_FRAGMENT_SHADER,
  FIREWORK_POINT_SIZE,
  FIREWORK_VERTEX_SHADER,
  GlProgram,
  VertexRing,
} from './gl/index';

export const FIREWORK_LAYER_ID = 'fireworks';

export type FireworkLayerOptions = {
  readonly launchSite: LngLat;
  readonly logger: Logger;
  readonly projection?: MercatorProjectionPort;
  readonly random?: RandomSource;
  readonly clock?: Clock;
  readonly enabled?: boolean;
};

export class FireworkLayer implements CustomLayerInterface, Disposable {
  readonly id = FIREWORK_LAYER_ID;
  readonly type = 'custom';
  readonly renderingMode = '3d';

  readonly #launchSite: LngLat;
  readonly #logger: Logger;
  readonly #clock: Clock;
  readonly #simulation: ParticleSimulation;
  readonly #buffers: ParticleBuffers;
  readonly #scheduler: BurstScheduler;
  readonly #resources: DisposableStore;
  /** mainMatrix 를 32비트로 옮기는 재사용 버퍼. 매 프레임 할당을 피한다. */
  readonly #matrix = new Float32Array(16);

  #map: MapLibreMap | undefined;
  #program: GlProgram | undefined;
  #ring: VertexRing | undefined;
  #disposed = false;

  constructor(options: FireworkLayerOptions) {
    this.#launchSite = options.launchSite;
    this.#logger = options.logger.child('fireworks');
    this.#clock = options.clock ?? new PerformanceClock();
    this.#resources = new DisposableStore(this.#logger);

    const simulationOptions = {
      projection: options.projection ?? new WebMercatorProjection(),
      ...(options.random === undefined ? {} : { random: options.random }),
    };
    this.#simulation = new ParticleSimulation(simulationOptions);
    this.#buffers = this.#simulation.allocateBuffers();

    this.#scheduler = new BurstScheduler({
      onBurst: () => this.#simulation.spawn(this.#launchSite, this.#clock.nowSeconds()),
      logger: this.#logger,
      enabled: options.enabled ?? true,
    });
    this.#resources.add(this.#scheduler);
  }

  get enabled(): boolean {
    return this.#scheduler.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.#scheduler.setEnabled(enabled);
  }

  onAdd(map: MapLibreMap, gl: WebGL2RenderingContext): void {
    if (this.#disposed) return;
    this.#map = map;

    const program = GlProgram.create(
      gl,
      FIREWORK_VERTEX_SHADER,
      FIREWORK_FRAGMENT_SHADER,
      ['u_matrix', 'u_size'],
      ['a_pos', 'a_col'],
    );
    if (!program.ok) {
      this.#logger.error('불꽃 셰이더를 준비하지 못해 레이어를 비활성화한다', program.error);
      return;
    }
    this.#program = this.#resources.add(program.value);

    const ring = VertexRing.create({
      gl,
      positionBytes: this.#buffers.positions.byteLength,
      colorBytes: this.#buffers.colors.byteLength,
      positionAttribute: program.value.attribute('a_pos'),
      colorAttribute: program.value.attribute('a_col'),
    });
    if (!ring.ok) {
      this.#logger.error('정점 버퍼 링을 만들지 못해 레이어를 비활성화한다', ring.error);
      return;
    }
    this.#ring = this.#resources.add(ring.value);

    this.#scheduler.start();
  }

  onRemove(): void {
    this.#teardown();
  }

  render(gl: WebGL2RenderingContext, options: CustomRenderMethodInput): void {
    const map = this.#map;
    const program = this.#program;
    const ring = this.#ring;
    if (this.#disposed || map === undefined || program === undefined || ring === undefined) return;

    /* globe 함정 ─────────────────────────────────────────────────
       커스텀 레이어의 정점은 메르카토르 좌표계다. 구체로 전환되면
       mainMatrix 가 구면 투영 행렬로 바뀌어 좌표가 깨지고, 그대로
       drawArrays 하면 WebGL 에러가 쏟아진다. projectionTransition 이
       0(평면) → 1(구체) 이므로 0 을 넘는 순간부터 그리지 않는다.
       어차피 그 줌에서는 불꽃이 픽셀 하나보다 작다. */
    const projectionData = options.defaultProjectionData;
    if (projectionData.projectionTransition > 0) {
      map.triggerRepaint();
      return;
    }

    const count = this.#simulation.sample(this.#clock.nowSeconds(), this.#buffers);
    if (count === 0) return;

    this.#matrix.set(projectionData.mainMatrix);
    ring.upload(this.#buffers.positions, count * 3, this.#buffers.colors, count * 4);

    program.use();
    gl.uniformMatrix4fv(program.uniform('u_matrix'), false, this.#matrix);
    gl.uniform1f(program.uniform('u_size'), FIREWORK_POINT_SIZE * devicePixelRatio());
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // 가산 합성 = 발광
    gl.depthMask(false);
    gl.drawArrays(gl.POINTS, 0, count);

    // 건드린 상태를 되돌리고 MapLibre 의 상태 캐시를 무효화한다.
    // 이걸 빠뜨리면 다음 레이어부터 렌더링이 어긋난다.
    gl.depthMask(true);
    ring.release();
    map.painter.context.setDirty();

    // 살아 있는 파티클이 있을 때만 재도색을 요청한다. 무조건 부르면 flyTo 같은
    // 카메라 전환과 겹쳐 MapLibre 의 타일 캐시 갱신과 경합한다(데모 주석).
    map.triggerRepaint();
  }

  dispose(): void {
    this.#teardown();
  }

  #teardown(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#resources.dispose();
    this.#simulation.clear();
    this.#program = undefined;
    this.#ring = undefined;
    this.#map = undefined;
  }
}

function devicePixelRatio(): number {
  return typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
}
