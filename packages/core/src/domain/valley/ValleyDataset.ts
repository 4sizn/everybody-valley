/**
 * 계곡 데이터셋 — 파일 머리말 + 계곡들. 저장소 포트가 돌려주는 값이다.
 *
 * 타입이 `data/` 가 아니라 여기 있는 이유: `ValleyRepositoryPort`(application)와
 * `AppState` 가 이 모양을 참조해야 하는데, application 이 data 를 import 하면
 * 의존 방향(표현 → application → domain ← data)이 뒤집힌다. 파서(`parseDatasetMetadata`,
 * `loadValleyDataset`)는 여전히 `data/valley` 에 있고, 여기에는 **값의 모양**만 둔다.
 *
 * 필드 출처: `data/.schema/valleys.schema.json` `$defs.metadata`.
 */
import type { ValleyId } from './ids';
import type { ValleyShade } from './Shade';
import type { Valley } from './Valley';

/** GeoJSON 규약. 스키마 `coordinateOrder` const. */
export const COORDINATE_ORDER = '[longitude, latitude]' as const;
/** 저장 시점에 전부 이 좌표계로 정규화한다. 런타임 변환은 두지 않는다. */
export const DATASET_CRS = 'EPSG:4326' as const;

/**
 * 검수 수준 (SD1 (g)). `desk` 는 자료·위성·공개 데이터로만 만든 데스크 검수 — 앱은
 * "현장 미확인" 배지를 붙인다. `field` 는 현장에서 확인한 것.
 */
export const VERIFICATION_LEVELS = ['desk', 'field'] as const;
export type Verification = (typeof VERIFICATION_LEVELS)[number];

const VERIFICATION_LABELS: Readonly<Record<Verification, string>> = {
  desk: '현장 미확인',
  field: '현장 확인',
};

export function verificationLabel(level: Verification): string {
  return VERIFICATION_LABELS[level];
}

export type DatasetMetadata = {
  readonly description: string;
  /** 사람이 읽는 출처 문장. 예: 'VWorld 하천망 + 현장 검수' */
  readonly source: string;
  /** 원본 파일 경로. 재생성 추적용. */
  readonly sourceFile: string | undefined;
  readonly datasetVersion: string;
  /** 'YYYY-MM-DD' */
  readonly collectedAt: string;
  readonly coordinateOrder: typeof COORDINATE_ORDER;
  readonly crs: typeof DATASET_CRS;
  /** 이 파일에 포함/제외한 기준. */
  readonly filter: string | undefined;
  /** 검수 수준(SD1 (g)). 샘플·옛 파일에는 없다. */
  readonly verified: Verification | undefined;
  /** 기계가 읽는 출처 목록(URL·데이터셋 이름). `source` 는 사람용 문장. */
  readonly sources: readonly string[] | undefined;
};

/** 로드 결과 — 파일 머리말 + `valleyId` 로 묶여 `order` 순으로 정렬된 계곡들. */
export type ValleyDataset = {
  readonly metadata: DatasetMetadata;
  readonly valleys: readonly Valley[];
  /**
   * 계곡별 그늘 폴리곤(F4). 합본이 없는 체크아웃(그늘 미산출)에서는 빈 맵 — 그늘은
   * 사용자가 켜는 렌즈라 없어도 데이터셋은 온전하다.
   */
  readonly shade: ReadonlyMap<ValleyId, ValleyShade>;
};
