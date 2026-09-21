/**
 * 서버 API 포트(S1 결정 (d)). 앱은 정부 API 를 직접 부르지 않고 `@modu-valley/server` 만 본다 — 이 포트가 그 계약이다.
 *
 * 응답 모양(DTO)은 서버 `server/src/records.ts` 와 라우트가 내는 JSON 을 그대로 옮긴 것이다. 여기서는 값만 들고
 * 있고 HTTP·SSE 를 모른다. 어댑터(`data/FetchApiClient`)가 fetch·EventSource 를 주입받아 채운다.
 * 실패는 `RepositoryError('repository/load-failed')` 로 돌려준다 — 원격 저장소 적재 실패와 같은 종류다.
 */
import type { LngLat } from '../../domain/geo/LngLat';
import type { ReportType } from '../../domain/report/Report';
import type { BasinCode, StationCode } from '../../domain/valley/ids';
import type { Disposable } from '../../shared/disposable';
import { RepositoryError } from '../../shared/errors';
import type { Result } from '../../shared/result';
import { err } from '../../shared/result';

/** ISO 8601 UTC 문자열. */
export type ApiIsoDateTime = string;

export const API_STATION_KINDS = ['hrfco-waterlevel', 'hrfco-rainfall', 'aws'] as const;
export type ApiStationKind = (typeof API_STATION_KINDS)[number];

export type ApiStation = {
  readonly kind: ApiStationKind;
  readonly code: StationCode;
  readonly name: string;
  readonly agency: string | null;
  /** 십진도. 제원에 좌표가 없으면 null. */
  readonly lng: number | null;
  readonly lat: number | null;
  readonly elevationM: number | null;
  /** 원 속성(수위 4단계 attwl/wrnwl/almwl/srswl 등). */
  readonly attrs: Readonly<Record<string, unknown>> | null;
  readonly suspicious: boolean;
};

/**
 * 관측값. `value` 의 뜻은 kind 별 — hrfco-waterlevel 수위 m · hrfco-rainfall 10분 강우 mm · aws RN-60m(1시간 강우 mm).
 * `extra` 는 hrfco-waterlevel `{ fw }` · aws `{ rn15, rn12h, rnDay, ta, re }`.
 */
export type ApiObservation = {
  readonly kind: ApiStationKind;
  readonly code: StationCode;
  readonly observedAt: ApiIsoDateTime;
  readonly value: number | null;
  readonly extra: Readonly<Record<string, unknown>> | null;
};

export type ApiLatest = {
  readonly observedAt: ApiIsoDateTime | null;
  readonly observations: readonly ApiObservation[];
};

export type ApiBasin = {
  readonly sbsncd: BasinCode;
  readonly sbsnnm: string | null;
  readonly mbsncd: string | null;
  readonly bbsncd: string | null;
};

/** `source: 'vworld'` 는 저장되지 않은 실시간 조회 결과다 — 클라이언트도 캐시하지 않는다. */
export type ApiBasinLookup = {
  readonly source: 'db' | 'vworld';
  readonly stored: boolean;
  readonly basin: ApiBasin;
};

export type ApiHealth = {
  readonly ok: boolean;
  readonly now: ApiIsoDateTime;
  readonly lastPoll: { readonly hydro: ApiIsoDateTime | null; readonly aws: ApiIsoDateTime | null };
};

export const API_EVENT_CHANNELS = ['hydro', 'aws', 'alert', 'report'] as const;
export type ApiEventChannel = (typeof API_EVENT_CHANNELS)[number];

/**
 * `GET /api/alerts` 의 계곡 하나 항목(F3b). `level` 이 `null` 이면 평시(활성 경보 없음).
 * `stale` 은 로스터가 있는 계곡의 마지막 관측이 15분을 넘었다는 뜻 — 로스터가 없는 계곡은
 * 늘 `false`(자료 없음 회색 타일을 영구히 그리지 않는다).
 */
export type ApiAlert = {
  readonly valleyId: string;
  readonly level: 'watch' | 'warning' | 'evacuate' | null;
  readonly source?: 'gauge' | 'adjacent-gauge' | 'grid' | 'waterlevel' | 'advisory';
  readonly confidence?: 'observed' | 'estimated' | 'regional';
  readonly observedAt?: ApiIsoDateTime;
  readonly issuedAt?: ApiIsoDateTime;
  readonly stationCode?: string | null;
  readonly rainfall10mMm?: number | null;
  readonly rainfall1hMm?: number | null;
  readonly rainfall3hMm?: number | null;
  readonly basinRainMmPerH?: number | null;
  readonly waterLevelStage?: 'attention' | 'caution' | 'alert' | 'severe' | null;
  readonly waterLevelDeltaM?: number | null;
  readonly leadTimeMin?: number | null;
  readonly stale: boolean;
  readonly lastObservedAt: ApiIsoDateTime | null;
};

/** 계곡 하나의 출입 통제 상태 — 서버 `GET /api/access`. 뜻은 core `evaluateAccess`. */
export type ApiAccessControl = {
  readonly valleyId: string;
  readonly kind: 'closed-area' | 'trail-closed' | 'trail-open';
  readonly from: string;
  readonly to: string;
  readonly basis: 'parcel' | 'ri' | 'trail';
  readonly agency: string;
  readonly sourceUrl: string;
  readonly note?: string;
};
export type ApiAccess = {
  readonly valleyId: string;
  readonly status: 'closed' | 'trail-open' | 'open' | 'unknown';
  readonly control: ApiAccessControl | null;
  readonly upcoming: ApiAccessControl | null;
};

/** 계곡 하나의 단풍 상태 — 서버 `GET /api/foliage`. 단계·날짜 뜻은 core `evaluateFoliage`. */
export type ApiFoliage = {
  readonly valleyId: string;
  readonly stage: 'green' | 'turning' | 'peak' | 'falling' | 'dormant';
  readonly confidence: 'observed' | 'estimated' | 'none';
  /** KST `YYYY-MM-DD`. */
  readonly lastDay: string | null;
  readonly coldDays: number;
  readonly turningStart: string | null;
  readonly peakStart: string | null;
  readonly fallingStart: string | null;
  readonly forecast: { readonly turning: string | null; readonly peak: string | null };
  /** 판정에 쓴 기상청 AWS 관측소. */
  readonly stations: readonly {
    readonly code: string;
    readonly name: string;
    readonly elevationM: number | null;
    readonly distanceKm: number;
  }[];
};

/**
 * 제보 하나(F5). `segmentId` 는 구간을 특정하지 않은 제보면 `null`. `passwordHash` 는 절대 담지 않는다
 * — 이 DTO 는 삭제·수정 인증 뒤가 아니라 목록·상세 응답 전부에 그대로 나간다.
 */
export type ApiReportPhoto = {
  readonly id: string;
  /** 정적 서빙 경로, 예: `/uploads/<id>.jpg`. */
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  readonly order: number;
};

export type ApiReport = {
  readonly id: string;
  readonly valleyId: string;
  readonly segmentId: string | null;
  readonly type: ReportType;
  readonly body: string;
  readonly nickname: string;
  readonly createdAt: ApiIsoDateTime;
  readonly photos: readonly ApiReportPhoto[];
  /** 제보 지점(F5d) — 선택 사항. 둘 다 있거나 둘 다 없다(서버가 검증). */
  readonly lat?: number;
  readonly lng?: number;
};

/** 업로드할 사진 1장. 코어는 DOM 을 모르므로 `File`/`Blob` 대신 바이트째로 받는다(어댑터가 채운다). */
export type ApiReportPhotoInput = {
  readonly data: Uint8Array;
  readonly filename: string;
  readonly contentType: string;
};

export type ApiReportDraft = {
  readonly valleyId: string;
  readonly segmentId?: string;
  readonly type: ReportType;
  readonly body: string;
  readonly nickname: string;
  /** 평문 — 전송 시에만 쓰고 응답엔 절대 실리지 않는다. */
  readonly password: string;
  /** 최대 3장(core `REPORT_MAX_PHOTOS`). */
  readonly photos?: readonly ApiReportPhotoInput[];
  /** 제보 지점(F5d) — 선택 사항. 한쪽만 넘기면 서버가 400 으로 거절한다. */
  readonly lat?: number;
  readonly lng?: number;
};

/**
 * 본문·유형(결정 (g)) + 좌표(F5d) 수정 — 삭제와 같은 방식, 비밀번호 대조. `lat`/`lng` 를
 * `null` 로 보내면 좌표를 지운다(둘 다 함께). 생략하면 기존 좌표를 그대로 둔다.
 */
export type ApiReportPatch = {
  readonly password: string;
  readonly type?: ReportType;
  readonly body?: string;
  readonly lat?: number | null;
  readonly lng?: number | null;
};

export type ApiReportsQuery = {
  /** 없으면 전체 계곡. */
  readonly valleyId?: string;
  readonly limit?: number;
  /** 이전 페이지의 `nextCursor`. */
  readonly cursor?: string;
};

/** 최신순 커서 페이지. `nextCursor` 가 `null` 이면 더 없음. */
export type ApiReportPage = {
  readonly reports: readonly ApiReport[];
  readonly nextCursor: string | null;
};

/** SSE `report` 채널에 실리는 요약 — 앱은 이걸로 티커·목록을 갱신하고 상세는 `report(id)` 로 다시 받는다. */
export type ApiReportEventSummary = {
  readonly id: string;
  readonly valleyId: string;
  readonly type: ReportType;
  readonly nickname: string;
  readonly createdAt: ApiIsoDateTime;
};

/** SSE 이벤트. `hello`·`heartbeat` 는 채널 이벤트가 아니라 연결 상태다. */
export type ApiEvent =
  | { readonly type: 'hello'; readonly channels: readonly ApiEventChannel[] }
  | { readonly type: 'heartbeat'; readonly at: ApiIsoDateTime }
  | {
      readonly type: 'hydro' | 'aws' | 'alert';
      readonly at: ApiIsoDateTime;
      readonly observedAt: ApiIsoDateTime | null;
    }
  | {
      readonly type: 'report';
      readonly at: ApiIsoDateTime;
      readonly report: ApiReportEventSummary;
    };

export type ApiBbox = {
  readonly minLng: number;
  readonly minLat: number;
  readonly maxLng: number;
  readonly maxLat: number;
};

export type ApiStationsQuery = {
  /** 기본 수위·강우 둘 다. */
  readonly kinds?: readonly ('waterlevel' | 'rainfall')[];
  readonly bbox?: ApiBbox;
};

/** 관리자 목록의 제보(OPS1) — 일반 `ApiReport` + `hidden`. 관리자 API 만 이 필드를 준다. */
export type ApiAdminReport = ApiReport & { readonly hidden: boolean };

export type ApiAdminReportPage = {
  readonly reports: readonly ApiAdminReport[];
  readonly nextCursor: string | null;
};

export type ApiAdminReportsQuery = ApiReportsQuery & {
  /** 참이면 숨김 제보도 포함한다. 기본(생략)은 일반 목록과 같이 숨김 제외. */
  readonly includeHidden?: boolean;
};

/** `GET /api/admin/flags` 한 행 — 신고를 제보별로 묶은 요약(OPS1). */
export type ApiAdminFlagSummary = {
  readonly reportId: string;
  readonly count: number;
  readonly lastCreatedAt: ApiIsoDateTime;
  readonly valleyId: string;
  readonly type: ReportType;
  readonly body: string;
  readonly nickname: string;
  readonly hidden: boolean;
};

export type ApiResult<T> = Promise<Result<T, RepositoryError>>;

export abstract class ApiPort {
  abstract health(): ApiResult<ApiHealth>;
  abstract hydroStations(query?: ApiStationsQuery): ApiResult<readonly ApiStation[]>;
  /** 빈 배열은 전체. */
  abstract hydroLatest(codes: readonly StationCode[]): ApiResult<ApiLatest>;
  abstract awsLatest(codes: readonly StationCode[]): ApiResult<ApiLatest>;
  /** 점을 품는 표준유역. 없으면 `null`. */
  abstract basinAt(point: LngLat): ApiResult<ApiBasinLookup | null>;
  /** 계곡 30개 전부의 현재 경보 상태(F3b). */
  abstract alerts(): ApiResult<readonly ApiAlert[]>;
  /** 계곡 전부의 단풍 진행 상태(가을). 기본 구현은 미구현 오류 — `FetchApiClient` 가 덮는다. */
  foliage(): ApiResult<readonly ApiFoliage[]> {
    return notImplemented('foliage');
  }
  /** 계곡 전부의 출입 통제 상태. 기본 구현은 미구현 오류 — `FetchApiClient` 가 덮는다. */
  access(): ApiResult<readonly ApiAccess[]> {
    return notImplemented('access');
  }
  /**
   * SSE 구독. 어댑터가 이벤트 스트림을 지원하지 않는 런타임이면 아무 이벤트도 오지 않는 `Disposable` 을 돌려준다
   * — 호출자는 `hydroLatest` 폴링으로 대신할 수 있다.
   */
  abstract subscribeEvents(
    channels: readonly ApiEventChannel[],
    handler: (event: ApiEvent) => void,
  ): Disposable;

  /**
   * 제보(F5) 읽기·쓰기. 시그니처만 여기서 고정하고 실제 fetch 구현은 F5b 의 `FetchApiClient` 가
   * 오버라이드한다 — `abstract` 로 두면 지금 있는 어댑터가 전부 깨지므로, 기본 구현은
   * `repository/load-failed` 를 돌려준다(어댑터가 이 메서드를 잊고 오버라이드하지 않아도
   * 조용히 `undefined` 를 반환하는 것보다 낫다).
   */
  reports(_query: ApiReportsQuery = {}): ApiResult<ApiReportPage> {
    return notImplemented('reports');
  }

  /** 없거나 숨김 처리된 제보는 `ok(null)`. */
  report(_id: string): ApiResult<ApiReport | null> {
    return notImplemented('report');
  }

  createReport(_draft: ApiReportDraft): ApiResult<ApiReport> {
    return notImplemented('createReport');
  }

  updateReport(_id: string, _patch: ApiReportPatch): ApiResult<ApiReport> {
    return notImplemented('updateReport');
  }

  deleteReport(_id: string, _password: string): ApiResult<void> {
    return notImplemented('deleteReport');
  }

  /** 신고하기 — 접수 기록만(누적 자동 숨김 없음, 결정 (h)). */
  flagReport(_id: string, _reason?: string): ApiResult<void> {
    return notImplemented('flagReport');
  }

  /**
   * 관리자 API(OPS1) — 시그니처만 여기서 고정한다(실제 구현은 `FetchApiClient`). `token` 은
   * `Authorization: Bearer` 로 매 호출 실린다 — 이 클래스도, 호출부도 토큰을 어딘가에
   * 저장해 재사용하지 않는다(호출자, 즉 표현 계층의 `StoragePort` 가 유일한 보관처).
   */
  adminReports(_token: string, _query: ApiAdminReportsQuery = {}): ApiResult<ApiAdminReportPage> {
    return notImplemented('adminReports');
  }

  setReportHidden(_token: string, _id: string, _hidden: boolean): ApiResult<ApiAdminReport> {
    return notImplemented('setReportHidden');
  }

  /** 신고 접수 목록(제보별로 묶임). */
  adminFlags(_token: string): ApiResult<readonly ApiAdminFlagSummary[]> {
    return notImplemented('adminFlags');
  }
}

function notImplemented<T>(method: string): ApiResult<T> {
  return Promise.resolve(
    err(new RepositoryError('repository/load-failed', `ApiPort.${method}() 미구현 — F5b 대상`)),
  );
}
