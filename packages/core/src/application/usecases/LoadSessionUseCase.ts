/**
 * 세션 준비 — 장면(scene)에 맞는 데이터를 싣고 지도에 반영한다.
 *
 * 데모는 이 일을 세 군데서 각자 한다: 스크립트 최상단의 `innerHTML` 주입,
 * `style.load` 안의 GeoJSON 소스 추가, 파일 끝의 `localStorage` 복원.
 * 순서 의존이 숨어 있어 한 곳이 늦으면 빈 목록이 그려진다.
 * 하나의 취소 가능한 절차로 모았다.
 *
 * 장면별로 갈리는 것은 **어디서 무엇을 싣는가**뿐이다.
 *   festival — 축제 저장소 → 저장된 배치 복원 → 명당·발사 지점 렌더
 *   valley   — 계곡 저장소 → 저장된 그늘 토글 복원 → 구간·시설(+그늘) 렌더(혼잡은 전부
 *              미확인) → 첫 계곡으로 카메라
 * 상태 전이(initializing → ready | failed)와 실패 처리는 같다. 두 장면에 공통인 것은
 * 테마 선택 복원(C9) — 셸 설정이라 장면 앞에서 한 번 읽는다.
 */
import { focusValley } from '../../domain/camera/CameraPresets';
import type { Valley } from '../../domain/valley/Valley';
import type { CancellationToken } from '../../shared/async/cancellation';
import type { SerialTaskQueue } from '../../shared/async/SerialTaskQueue';
import type { AppError } from '../../shared/errors';
import type { Logger } from '../../shared/logger/Logger';
import { type Err, ok, type VoidResult } from '../../shared/result';
import type { MapContentComposer } from '../MapContentComposer';
import type { FestivalRepositoryPort } from '../ports/FestivalRepositoryPort';
import { EMPTY_MAP_CONTENT } from '../ports/MapContent';
import type { MapEnginePort } from '../ports/MapEnginePort';
import { STORAGE_KEYS, type StoragePort } from '../ports/StoragePort';
import type { ValleyRepositoryPort } from '../ports/ValleyRepositoryPort';
import { isThemeMode, mapContentFilterOf, SPOT_LAYOUTS, type SpotLayout } from '../state/AppState';
import type { SessionStore } from '../state/SessionStore';

/**
 * 장면과 그 장면의 데이터 출처. 유니온이라 "valley 인데 계곡 저장소가 없다"는
 * 조합이 타입에서 막힌다 — 런타임에 빈 화면으로 드러나는 대신.
 */
export type SceneSource =
  | { readonly scene: 'festival'; readonly repository: FestivalRepositoryPort }
  | { readonly scene: 'valley'; readonly valleyRepository: ValleyRepositoryPort };

export type LoadSessionDeps = {
  readonly source: SceneSource;
  readonly storage: StoragePort;
  readonly engine: MapEnginePort;
  readonly store: SessionStore;
  readonly cameraQueue: SerialTaskQueue;
  /** 계곡 장면의 지도 내용 바탕. 그늘 유즈케이스들과 같은 인스턴스를 본다. */
  readonly composer: MapContentComposer;
  readonly logger: Logger;
};

export class LoadSessionUseCase {
  readonly #deps: LoadSessionDeps;
  readonly #logger: Logger;

  constructor(deps: LoadSessionDeps) {
    this.#deps = deps;
    this.#logger = deps.logger.child('load-session');
  }

  async execute(token: CancellationToken): Promise<VoidResult> {
    this.#deps.store.setStatus('initializing');
    await this.#restoreThemeMode(token);
    const source = this.#deps.source;
    return source.scene === 'festival'
      ? this.#loadFestival(source.repository, token)
      : this.#loadValley(source.valleyRepository, token);
  }

  async #loadFestival(
    repository: FestivalRepositoryPort,
    token: CancellationToken,
  ): Promise<VoidResult> {
    const { engine, store } = this.#deps;

    const loaded = await repository.load(token);
    if (!loaded.ok) return this.#fail(loaded);

    const guard = token.checkpoint('load-session');
    if (!guard.ok) return guard;

    const festival = loaded.value;
    store.setFestival(festival);

    // 배치 복원 실패는 화면을 막지 않는다 — 기본 배치로 계속 간다.
    const layout = await this.#restoreLayout(token);
    store.setSpotLayout(layout);

    // 이 장면은 festival 만 싣는다. 계곡 필드는 비워 둔 채 같은 계약을 쓴다.
    const rendered = engine.renderContent({
      ...EMPTY_MAP_CONTENT,
      spots: festival.spots,
      launchSite: festival.launchSite,
    });
    if (!rendered.ok) return this.#fail(rendered);

    store.setStatus('ready');
    this.#logger.info('세션 준비 완료', {
      scene: 'festival',
      spots: festival.spots.length,
      layout,
    });
    return ok();
  }

  async #loadValley(
    repository: ValleyRepositoryPort,
    token: CancellationToken,
  ): Promise<VoidResult> {
    const { engine, store, cameraQueue, composer } = this.#deps;

    const loaded = await repository.load(token);
    if (!loaded.ok) return this.#fail(loaded);

    const guard = token.checkpoint('load-session');
    if (!guard.ok) return guard;

    const dataset = loaded.value;
    store.setValleys(dataset);
    composer.loadValley(dataset);

    // 그늘 토글 복원 실패는 화면을 막지 않는다 — 꺼진 채로 간다(기본값).
    const shadeVisible = await this.#restoreShadeVisible(token);
    store.setShadeVisible(shadeVisible);

    /* 계곡 화면에 불꽃 연출은 없다. 엔진이 불꽃을 모르면(네이티브) 실패로
       돌아오지만 그건 "이미 꺼져 있다"는 뜻이므로 경고조차 필요 없다. */
    const fireworks = engine.setFireworksEnabled(false);
    if (!fireworks.ok) this.#logger.debug('불꽃 끄기를 건너뛴다', { code: fireworks.error.code });

    /* 첫 렌더에 저장된 토글을 반영한다. 바탕(구간·시설)은 composer 가 한 번 굳혀
       두었으므로 이후 그늘 토글·시각 변경은 그늘 소스만 다시 쓴다. */
    const rendered = engine.renderContent(
      composer.content(shadeVisible, store.state.shadeHourIndex, mapContentFilterOf(store.state)),
    );
    if (!rendered.ok) return this.#fail(rendered);

    store.setStatus('ready');
    this.#logger.info('세션 준비 완료', {
      scene: 'valley',
      valleys: dataset.valleys.length,
      segments: dataset.valleys.reduce((sum, valley) => sum + valley.segments.length, 0),
      shadeValleys: dataset.shade.size,
      shadeVisible,
    });

    /* 첫 계곡으로 시점 이동. 상태는 이미 ready 다 — 카메라 비행은 연출이지
       준비 조건이 아니다. 취소(사용자가 먼저 지도를 만짐)는 정상 흐름. */
    const first: Valley | undefined = dataset.valleys[0];
    if (first !== undefined) {
      const flown = await cameraQueue.run(
        'camera:focus-valley',
        (cameraToken) =>
          engine.moveCamera(focusValley(first.center(), store.state.viewportInsets), cameraToken),
        'preempt',
      );
      if (!flown.ok) this.#logger.debug('첫 계곡 비행이 중단됐다', { code: flown.error.code });
    }
    return ok();
  }

  /** 실패를 상태에 남기고 그대로 되돌린다 — 호출부가 `return this.#fail(x)` 한 줄로 끝나게. */
  #fail<T extends Err<AppError>>(failure: T): T {
    this.#deps.store.setStatus('failed');
    this.#deps.store.setError(failure.error);
    return failure;
  }

  async #restoreLayout(token: CancellationToken): Promise<SpotLayout> {
    const read = await this.#deps.storage.read(STORAGE_KEYS.spotLayout, token);
    if (!read.ok) {
      this.#logger.warn('저장된 배치를 읽지 못해 기본값을 쓴다', {
        code: read.error.code,
      });
      return 'rows';
    }
    const saved = read.value;
    return isSpotLayout(saved) ? saved : 'rows';
  }

  /**
   * 저장된 테마 선택이 있으면 그것이 이긴다(C9 해석 순서: 저장값 → 앱 기본). 없거나 모르는
   * 값·읽기 실패면 세션이 시작할 때 받은 값(`AppStateSeed.themeMode`, 없으면 `system`)을
   * 그대로 둔다 — 앱은 자기 기본(D1 라이트, 개발용 강제 env)을 씨앗으로 넘긴다.
   */
  async #restoreThemeMode(token: CancellationToken): Promise<void> {
    const read = await this.#deps.storage.read(STORAGE_KEYS.themeMode, token);
    if (!read.ok) {
      this.#logger.warn('저장된 테마 선택을 읽지 못해 현재 값을 쓴다', { code: read.error.code });
      return;
    }
    if (read.value === null) {
      this.#logger.debug('저장된 테마 선택 없음 — 현재 값을 쓴다', {
        current: this.#deps.store.state.themeMode,
      });
      return;
    }
    if (!isThemeMode(read.value)) {
      this.#logger.warn('저장된 테마 선택을 알 수 없어 현재 값을 쓴다', { saved: read.value });
      return;
    }
    this.#logger.debug('저장된 테마 선택 복원', {
      saved: read.value,
      current: this.#deps.store.state.themeMode,
    });
    this.#deps.store.setThemeMode(read.value);
  }

  /** 저장 값은 `'true' | 'false'`. 없거나 읽기 실패면 기본 꺼짐(결정 (g)). */
  async #restoreShadeVisible(token: CancellationToken): Promise<boolean> {
    const read = await this.#deps.storage.read(STORAGE_KEYS.shadeVisible, token);
    if (!read.ok) {
      this.#logger.warn('저장된 그늘 보기 설정을 읽지 못해 기본값을 쓴다', {
        code: read.error.code,
      });
      return false;
    }
    return read.value === 'true';
  }
}

function isSpotLayout(value: string | null): value is SpotLayout {
  return value !== null && (SPOT_LAYOUTS as readonly string[]).includes(value);
}
