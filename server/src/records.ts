/**
 * DB 행과 API 응답이 공유하는 레코드 모양. 소스 파서(sources/)가 만들고 저장소(db/repos)가 넣고 라우트가 낸다.
 */
export const STATION_KINDS = ['hrfco-waterlevel', 'hrfco-rainfall', 'aws'] as const;
export type StationKind = (typeof STATION_KINDS)[number];

export interface StationRecord {
  readonly kind: StationKind;
  readonly code: string;
  readonly name: string;
  readonly agency: string | null;
  /** 십진도. 제원에 좌표가 없으면 null. */
  readonly lng: number | null;
  readonly lat: number | null;
  readonly elevationM: number | null;
  /** 원 속성(수위 4단계 attwl/wrnwl/almwl/srswl 등). */
  readonly attrs: Readonly<Record<string, unknown>> | null;
  /** 도분초 표기가 의심스러움(초 ≥ 60 등). */
  readonly suspicious: boolean;
}

export interface ObservationRecord {
  readonly kind: StationKind;
  readonly code: string;
  /** ISO 8601 UTC. */
  readonly observedAt: string;
  /** kind 별 뜻은 migrations/0002 주석. 결측은 null. */
  readonly value: number | null;
  readonly extra: Readonly<Record<string, unknown>> | null;
}

export interface BasinRecord {
  readonly sbsncd: string;
  readonly sbsnnm: string | null;
  readonly mbsncd: string | null;
  readonly bbsncd: string | null;
  /** GeoJSON Geometry(Polygon | MultiPolygon). */
  readonly geometry: unknown;
  readonly source: string;
  readonly collectedAt: string;
}

/**
 * 계곡별 경보 상태 1행(F3b). core `UpstreamAlert` 를 DB 행으로 옮긴 것 — `level`·`source`·
 * `confidence`·`waterLevelStage` 는 core 의 enum 문자열을 그대로 쓴다(재검증은 로더가 한다).
 */
export interface AlertRecord {
  readonly valleyId: string;
  readonly level: string;
  readonly source: string;
  readonly confidence: string;
  /** ISO 8601 UTC. */
  readonly observedAt: string;
  readonly issuedAt: string;
  readonly stationCode: string | null;
  readonly rainfall10mMm: number | null;
  readonly rainfall1hMm: number | null;
  readonly rainfall3hMm: number | null;
  readonly basinRainMmPerH: number | null;
  readonly waterLevelStage: string | null;
  readonly waterLevelDeltaM: number | null;
  readonly leadTimeMin: number | null;
  /** `null` 이면 아직 유효. */
  readonly clearedAt: string | null;
  readonly verified: boolean | null;
}

/**
 * 제보 1건(F5a). 계정이 없다 — `nickname` 은 표시용, `passwordHash` 는 그 제보의 수정·삭제
 * 인증에만 쓰인다(argon2id 또는 bcrypt, 평문은 어디에도 남기지 않는다). `hidden` 은 지금은
 * 세우지 않는다(자동 숨김을 만들지 않기로 한 결정 (h)) — 스키마 자리만 남긴다.
 */
export interface ReportRecord {
  readonly id: string;
  readonly valleyId: string;
  readonly segmentId: string | null;
  readonly type: string;
  readonly body: string;
  readonly nickname: string;
  readonly passwordHash: string;
  /** ISO 8601 UTC. */
  readonly createdAt: string;
  readonly ip: string;
  readonly hidden: boolean;
  /** 제보 지점(F5d) — 선택 사항, 함께 있거나 함께 없다(라우트가 검증). */
  readonly lat: number | null;
  readonly lng: number | null;
}

/** 서버가 리사이즈해 저장한 사진 1장. `filename` 은 `server/data/uploads/` 안의 실제 파일 이름(`<id>.jpg`). */
export interface ReportPhotoRecord {
  readonly id: string;
  readonly reportId: string;
  readonly filename: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  /** 표시 순서(0부터). */
  readonly order: number;
}

/** `신고하기` 접수 1건 — 누적 집계·자동 처리는 하지 않는다(결정 (h)). */
export interface ReportFlagRecord {
  readonly id: number;
  readonly reportId: string;
  readonly reason: string | null;
  readonly createdAt: string;
  readonly ip: string;
}

/**
 * 신고 접수를 제보별로 묶은 요약(OPS1) — `GET /api/admin/flags`. 제보 본문·유형·닉네임까지
 * 함께 주는 이유는 관리자가 이 목록만 보고 무엇을 숨길지 판단해야 해서다(제보 상세를
 * 따로 열어보게 만들지 않는다).
 */
export interface ReportFlagSummary {
  readonly reportId: string;
  /** 이 제보에 쌓인 신고 건수. */
  readonly count: number;
  /** ISO 8601 UTC — 가장 최근 신고 시각. */
  readonly lastCreatedAt: string;
  readonly valleyId: string;
  readonly type: string;
  readonly body: string;
  readonly nickname: string;
  readonly hidden: boolean;
}

export interface FetchLogEntry {
  readonly job: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly ok: boolean;
  readonly status: number | null;
  readonly rows: number | null;
  readonly durationMs: number;
  /** 키가 마스킹된 메시지. */
  readonly error: string | null;
}
