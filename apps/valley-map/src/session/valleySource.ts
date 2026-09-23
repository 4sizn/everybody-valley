/**
 * 계곡 화면의 데이터 출처 — 번들된 계곡 합본 GeoJSON → 저장소.
 *
 * 코어는 파일을 읽지 못하므로(플랫폼 무관) 원시 JSON 을 여기서 들여와
 * `loadValleyBundle` 로 검증·변환한 뒤 `InMemoryValleyRepository` 에 담는다.
 *
 * `assets/valley/*-bundle.json` 은 `scripts/sync-valley-data.mjs` 가 저장소 루트
 * `data/valleys/*.geojson`·`data/facilities/*.geojson`(SD1, 계곡별 파일 30장)을 합본한
 * 산출물이다(gitignore). Metro 는 `.geojson` 확장자를 모르고 정적 import 만 받으므로
 * 계곡 수만큼 파일을 import 할 수 없어 한 장으로 합친다. 시딩 전 체크아웃에서는 같은
 * 스크립트가 `data/examples/` 의 샘플을 대신 합본한다.
 * 그늘(F4)은 같은 스크립트가 `data/shade/**` 를 `shade-bundle.json` 한 파일로 합친다 —
 * 산출물이 없는 체크아웃에서는 빈 합본이라 import 는 항상 성립하고 그늘 맵만 빈다.
 * 봉우리(`data/peaks/`, OSM)도 같은 스크립트가 `peaks-bundle.json` 으로 합친다 — 없으면 빈 합본.
 *
 * 합본이 스키마를 어기면 앱을 죽이지 않고 세션을 `failed` 로 보낸다 —
 * `/firework` 는 이 모듈과 무관하게 살아 있어야 한다.
 */

import type { AppError, CancellationToken, Err, Result } from '@modu-valley/core';
import {
  InMemoryValleyRepository,
  LAUNCH_SITE,
  type LngLat,
  loadValleyBundle,
  type SceneSource,
  type ValleyDataset,
  ValleyRepositoryPort,
} from '@modu-valley/core';
import facilitiesBundleRaw from '../../assets/valley/facilities-bundle.json';
import peaksBundleRaw from '../../assets/valley/peaks-bundle.json';
import shadeBundleRaw from '../../assets/valley/shade-bundle.json';
import valleysBundleRaw from '../../assets/valley/valleys-bundle.json';

export const PARSED: Result<ValleyDataset, AppError> = loadValleyBundle(
  valleysBundleRaw,
  facilitiesBundleRaw,
  shadeBundleRaw,
  peaksBundleRaw,
);

/** 번들된 합본이 검증에 실패했을 때 — 그 실패를 그대로 세션에 넘긴다. */
class InvalidBundledValleyRepository extends ValleyRepositoryPort {
  readonly #failure: Err<AppError>;

  constructor(failure: Err<AppError>) {
    super();
    this.#failure = failure;
  }

  override load(token: CancellationToken): Promise<Result<ValleyDataset>> {
    const guard = token.checkpoint('valley-load');
    return Promise.resolve(guard.ok ? this.#failure : guard);
  }
}

/** 모듈 상수 — 참조가 바뀌면 세션이 다시 만들어진다. */
export const VALLEY_SOURCE: SceneSource = {
  scene: 'valley',
  valleyRepository: PARSED.ok
    ? new InMemoryValleyRepository(PARSED.value)
    : new InvalidBundledValleyRepository(PARSED),
};

/**
 * 지도 최초 중심. 첫 계곡의 중심에서 시작하고(시점은 `VALLEY_INITIAL_VIEW`), 첫
 * `focusValley` 는 offset 만 더한다 — 발사 지점(여의도)에서 계곡까지 날아오는 긴
 * 비행도, pitch 62 → 0 비행에서 offset 이 어긋나는 문제도 피한다.
 */
export const VALLEY_INITIAL_CENTER: LngLat = PARSED.ok
  ? (PARSED.value.valleys[0]?.center() ?? LAUNCH_SITE)
  : LAUNCH_SITE;
