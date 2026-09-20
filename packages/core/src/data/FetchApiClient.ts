/**
 * `ApiPort` 의 fetch 구현 — web·android·ios 공용. fetch 와(선택) EventSource 를 **주입**받으므로 이 파일은 DOM·RN 을
 * import 하지 않는다. 앱 쪽 `createApiClient` 가 `EXPO_PUBLIC_API_BASE` 와 런타임 전역을 넘긴다.
 *
 * 규약: 네트워크·HTTP·JSON 실패는 `RepositoryError('repository/load-failed')` 로 돌려준다. 던지지 않는다.
 * 실패 시 `context.status` 에 HTTP 상태(네트워크 예외는 0)를, JSON 으로 읽히면 `context.body` 에
 * 응답 본문을 싣는다 — 429(레이트리밋)의 `retryAfterSec` 처럼 호출자가 상태별로 다른 문구를
 * 보여줄 재료다(F5b).
 *
 * 제보(F5) 쓰기는 사진이 있으면 multipart, 없으면 JSON 이다(서버 `reports.ts` 의 두 경로와 대응).
 * multipart 본문은 `FormData`/`Blob` 없이 **바이트를 직접 이어 붙여** 만든다 — 이 파일은 DOM 을
 * 몰라야 하고, `ApiReportPhotoInput` 도 `Uint8Array` 로 사진을 들고 있기 때문이다. web `fetch` ·
 * RN `fetch` 모두 `Uint8Array`(ArrayBufferView) 본문을 받아들인다.
 */

import {
  type ApiAdminFlagSummary,
  type ApiAdminReport,
  type ApiAdminReportPage,
  type ApiAdminReportsQuery,
  type ApiAlert,
  type ApiBasinLookup,
  type ApiEvent,
  type ApiEventChannel,
  type ApiFoliage,
  type ApiHealth,
  type ApiLatest,
  ApiPort,
  type ApiReport,
  type ApiReportDraft,
  type ApiReportEventSummary,
  type ApiReportPage,
  type ApiReportPatch,
  type ApiReportPhotoInput,
  type ApiReportsQuery,
  type ApiResult,
  type ApiStation,
  type ApiStationsQuery,
} from '../application/ports/ApiPort';
import type { LngLat } from '../domain/geo/LngLat';
import { isReportType } from '../domain/report/Report';
import type { StationCode } from '../domain/valley/ids';
import { type Disposable, EMPTY_DISPOSABLE, toDisposable } from '../shared/disposable';
import { RepositoryError } from '../shared/errors';
import type { Logger } from '../shared/logger/Logger';
import { err, ok } from '../shared/result';

/** `#request`/`FetchLike` 에 실어 보내는 요청 옵션. `body` 는 DOM `FormData`/`Blob` 을 쓰지 않는다. */
export type FetchRequestInit = {
  readonly method?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string | Uint8Array;
};

/** 세 런타임의 `fetch` 가 모두 만족하는 최소 모양. */
export type FetchLike = (
  url: string,
  init?: FetchRequestInit,
) => Promise<{
  readonly ok: boolean;
  readonly status: number;
  text(): Promise<string>;
}>;

/** 브라우저 `EventSource` 의 최소 모양. 네이티브는 폴리필을 넘기거나 비워 둔다. */
export interface EventSourceLike {
  addEventListener(type: string, listener: (event: { readonly data: string }) => void): void;
  close(): void;
}
export type EventSourceFactory = (url: string) => EventSourceLike;

export interface FetchApiClientOptions {
  /** 예: `http://localhost:8787`. 끝의 `/` 는 벗긴다. */
  readonly baseUrl: string;
  readonly fetch: FetchLike;
  readonly eventSource?: EventSourceFactory;
  readonly logger?: Logger;
}

const SSE_EVENTS = ['hello', 'heartbeat', 'hydro', 'aws', 'alert', 'report'] as const;

export class FetchApiClient extends ApiPort {
  readonly #baseUrl: string;
  readonly #fetch: FetchLike;
  readonly #eventSource: EventSourceFactory | undefined;
  readonly #logger: Logger | undefined;

  constructor(options: FetchApiClientOptions) {
    super();
    this.#baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.#fetch = options.fetch;
    this.#eventSource = options.eventSource;
    this.#logger = options.logger;
  }

  get baseUrl(): string {
    return this.#baseUrl;
  }

  health(): ApiResult<ApiHealth> {
    return this.#getJson<ApiHealth>('/healthz');
  }

  async hydroStations(query: ApiStationsQuery = {}): ApiResult<readonly ApiStation[]> {
    // 코어는 DOM lib 을 켜지 않아 URLSearchParams 가 없다 — 값은 전부 숫자·고정 문자열이라 손으로 붙인다.
    const params: string[] = [];
    if (query.kinds && query.kinds.length > 0) params.push(`kind=${query.kinds.join(',')}`);
    if (query.bbox) {
      const b = query.bbox;
      params.push(`bbox=${b.minLng},${b.minLat},${b.maxLng},${b.maxLat}`);
    }
    const r = await this.#getJson<{ stations: readonly ApiStation[] }>(
      `/api/hydro/stations${params.length > 0 ? `?${params.join('&')}` : ''}`,
    );
    return r.ok ? ok(r.value.stations) : r;
  }

  hydroLatest(codes: readonly StationCode[]): ApiResult<ApiLatest> {
    return this.#latest('/api/hydro/latest', 'stations', codes);
  }

  awsLatest(codes: readonly StationCode[]): ApiResult<ApiLatest> {
    return this.#latest('/api/aws/latest', 'stns', codes);
  }

  async basinAt(point: LngLat): ApiResult<ApiBasinLookup | null> {
    const path = `/api/basins?lng=${point.lng}&lat=${point.lat}`;
    const res = await this.#request(path);
    if (!res.ok) return res.error.context['status'] === 404 ? ok(null) : res;
    return this.#parse<ApiBasinLookup>(path, res.value);
  }

  async alerts(): ApiResult<readonly ApiAlert[]> {
    const r = await this.#getJson<{ alerts: readonly ApiAlert[] }>('/api/alerts');
    return r.ok ? ok(r.value.alerts) : r;
  }

  override async foliage(): ApiResult<readonly ApiFoliage[]> {
    const r = await this.#getJson<{ foliage: readonly ApiFoliage[] }>('/api/foliage');
    return r.ok ? ok(r.value.foliage) : r;
  }

  override async reports(query: ApiReportsQuery = {}): ApiResult<ApiReportPage> {
    const params: string[] = [];
    if (query.valleyId) params.push(`valleyId=${encodeURIComponent(query.valleyId)}`);
    if (query.limit !== undefined) params.push(`limit=${query.limit}`);
    if (query.cursor) params.push(`cursor=${encodeURIComponent(query.cursor)}`);
    const path = `/api/reports${params.length > 0 ? `?${params.join('&')}` : ''}`;
    const r = await this.#getJson<{
      readonly reports: readonly ApiReport[];
      readonly nextCursor: string | null;
    }>(path);
    return r.ok ? ok({ reports: r.value.reports, nextCursor: r.value.nextCursor }) : r;
  }

  override async report(id: string): ApiResult<ApiReport | null> {
    const path = `/api/reports/${encodeURIComponent(id)}`;
    const res = await this.#request(path);
    if (!res.ok) return res.error.context['status'] === 404 ? ok(null) : res;
    return this.#parse<ApiReport>(path, res.value);
  }

  override createReport(draft: ApiReportDraft): ApiResult<ApiReport> {
    if ((draft.photos?.length ?? 0) === 0) {
      return this.#postJson<ApiReport>('/api/reports', {
        valleyId: draft.valleyId,
        ...(draft.segmentId ? { segmentId: draft.segmentId } : {}),
        type: draft.type,
        body: draft.body,
        nickname: draft.nickname,
        password: draft.password,
        // F5d — 둘 다 있을 때만 보낸다(한쪽만 있으면 서버가 400 으로 거절한다).
        ...(draft.lat !== undefined && draft.lng !== undefined
          ? { lat: draft.lat, lng: draft.lng }
          : {}),
      });
    }
    const { body, contentType } = buildReportMultipartBody(draft);
    return this.#send<ApiReport>('POST', '/api/reports', body, contentType);
  }

  override updateReport(id: string, patch: ApiReportPatch): ApiResult<ApiReport> {
    return this.#patchJson<ApiReport>(`/api/reports/${encodeURIComponent(id)}`, patch);
  }

  override async deleteReport(id: string, password: string): ApiResult<void> {
    const r = await this.#send<{ readonly ok: boolean }>(
      'DELETE',
      `/api/reports/${encodeURIComponent(id)}`,
      JSON.stringify({ password }),
      'application/json',
    );
    return r.ok ? ok() : r;
  }

  override async flagReport(id: string, reason?: string): ApiResult<void> {
    const r = await this.#send<{ readonly ok: boolean }>(
      'POST',
      `/api/reports/${encodeURIComponent(id)}/flag`,
      JSON.stringify(reason ? { reason } : {}),
      'application/json',
    );
    return r.ok ? ok() : r;
  }

  /**
   * 관리자 API(OPS1). `token` 을 매 호출 `Authorization: Bearer` 로 싣는다 — 어디에도
   * 저장하지 않는다(호출부의 `StoragePort` 가 유일한 보관처, 로그·에러 메시지엔 절대 없다).
   */
  override async adminReports(
    token: string,
    query: ApiAdminReportsQuery = {},
  ): ApiResult<ApiAdminReportPage> {
    const params: string[] = [];
    if (query.valleyId) params.push(`valleyId=${encodeURIComponent(query.valleyId)}`);
    if (query.limit !== undefined) params.push(`limit=${query.limit}`);
    if (query.cursor) params.push(`cursor=${encodeURIComponent(query.cursor)}`);
    if (query.includeHidden) params.push('includeHidden=1');
    const path = `/api/admin/reports${params.length > 0 ? `?${params.join('&')}` : ''}`;
    const res = await this.#request(path, { headers: bearerHeader(token) });
    if (!res.ok) return res;
    return this.#parse<ApiAdminReportPage>(path, res.value);
  }

  override setReportHidden(token: string, id: string, hidden: boolean): ApiResult<ApiAdminReport> {
    return this.#send<ApiAdminReport>(
      'PATCH',
      `/api/admin/reports/${encodeURIComponent(id)}/hidden`,
      JSON.stringify({ hidden }),
      'application/json',
      bearerHeader(token),
    );
  }

  override async adminFlags(token: string): ApiResult<readonly ApiAdminFlagSummary[]> {
    const path = '/api/admin/flags';
    const res = await this.#request(path, { headers: bearerHeader(token) });
    if (!res.ok) return res;
    const parsed = await this.#parse<{ readonly flags: readonly ApiAdminFlagSummary[] }>(
      path,
      res.value,
    );
    return parsed.ok ? ok(parsed.value.flags) : parsed;
  }

  subscribeEvents(
    channels: readonly ApiEventChannel[],
    handler: (event: ApiEvent) => void,
  ): Disposable {
    if (!this.#eventSource) {
      this.#logger?.warn('이 런타임에는 EventSource 가 없어 SSE 를 구독하지 않는다', {
        baseUrl: this.#baseUrl,
      });
      return EMPTY_DISPOSABLE;
    }
    const url = `${this.#baseUrl}/api/events?channel=${encodeURIComponent(channels.join(','))}`;
    const source = this.#eventSource(url);
    for (const type of SSE_EVENTS) {
      source.addEventListener(type, (e) => {
        const event = parseSseEvent(type, e.data);
        if (event) handler(event);
        else this.#logger?.warn('SSE 이벤트를 읽을 수 없다', { type });
      });
    }
    return toDisposable(() => source.close());
  }

  async #latest(path: string, param: string, codes: readonly StationCode[]): ApiResult<ApiLatest> {
    const query = codes.length > 0 ? `?${param}=${encodeURIComponent(codes.join(','))}` : '';
    const r = await this.#getJson<ApiLatest>(`${path}${query}`);
    return r.ok ? ok({ observedAt: r.value.observedAt, observations: r.value.observations }) : r;
  }

  async #getJson<T>(path: string): ApiResult<T> {
    const res = await this.#request(path);
    return res.ok ? this.#parse<T>(path, res.value) : res;
  }

  /** JSON 본문의 POST — 제보 쓰기(사진 없음)·목록 조회 아닌 나머지가 쓴다. */
  async #postJson<T>(path: string, payload: unknown): ApiResult<T> {
    return this.#send<T>('POST', path, JSON.stringify(payload), 'application/json');
  }

  async #patchJson<T>(path: string, payload: unknown): ApiResult<T> {
    return this.#send<T>('PATCH', path, JSON.stringify(payload), 'application/json');
  }

  /** 본문 있는 요청 공통 — JSON 문자열이든 multipart 바이트든 같은 경로로 보내고 파싱한다. */
  async #send<T>(
    method: string,
    path: string,
    body: string | Uint8Array,
    contentType: string,
    extraHeaders: Readonly<Record<string, string>> = {},
  ): ApiResult<T> {
    const res = await this.#request(path, {
      method,
      headers: { 'content-type': contentType, ...extraHeaders },
      body,
    });
    return res.ok ? this.#parse<T>(path, res.value) : res;
  }

  async #request(path: string, init: FetchRequestInit = {}): ApiResult<string> {
    try {
      const res = await this.#fetch(`${this.#baseUrl}${path}`, {
        headers: { accept: 'application/json', ...init.headers },
        ...(init.method !== undefined ? { method: init.method } : {}),
        ...(init.body !== undefined ? { body: init.body } : {}),
      });
      const text = await res.text();
      if (!res.ok) {
        return err(
          new RepositoryError('repository/load-failed', `서버 응답 ${res.status}: ${path}`, {
            context: { path, status: res.status, ...errorBodyContext(text) },
          }),
        );
      }
      return ok(text);
    } catch (cause) {
      return err(
        new RepositoryError('repository/load-failed', `서버에 닿지 못했다: ${path}`, {
          cause,
          context: { path, status: 0 },
        }),
      );
    }
  }

  #parse<T>(path: string, text: string): ApiResult<T> {
    try {
      return Promise.resolve(ok(JSON.parse(text) as T));
    } catch (cause) {
      return Promise.resolve(
        err(
          new RepositoryError('repository/load-failed', `서버 응답이 JSON 이 아니다: ${path}`, {
            cause,
            context: { path, status: 200 },
          }),
        ),
      );
    }
  }
}

/**
 * 실패 응답 본문이 JSON 이면 그중 원시값 필드만 골라 `context` 에 얹는다 — `ErrorContext` 는
 * 문자열·숫자·불리언·null 만 담을 수 있다. 429(레이트리밋)의 `error`·`retryAfterSec` 처럼
 * 호출자가 상태별 문구를 고를 재료다(F5b). JSON 이 아니면(대개 프록시·인프라 에러 페이지)
 * 조용히 생략한다.
 */
function errorBodyContext(
  text: string,
): Readonly<Record<string, string | number | boolean | null>> {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed === null || typeof parsed !== 'object') return {};
    const context: Record<string, string | number | boolean | null> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        context[key] = value;
      }
    }
    return context;
  } catch {
    return {};
  }
}

/** 관리자 API(OPS1) 요청 헤더 — 토큰을 여기서만 조립하고 어디에도 보관하지 않는다. */
function bearerHeader(token: string): Readonly<Record<string, string>> {
  return { authorization: `Bearer ${token}` };
}

/** UTF-8 인코딩 — `TextEncoder` 에 기대지 않는다(일부 RN 런타임에 없다, 크로스플랫폼 제약). */
function utf8Bytes(input: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const code = input.codePointAt(i);
    if (code === undefined) continue;
    if (code > 0xffff) i++; // 서로게이트 쌍의 두 번째 코드유닛은 건너뛴다.
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return new Uint8Array(bytes);
}

function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

const MULTIPART_BOUNDARY_PREFIX = 'modu-valley-report';

function multipartField(boundary: string, name: string, value: string): Uint8Array {
  return utf8Bytes(
    `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
  );
}

function multipartFile(boundary: string, name: string, photo: ApiReportPhotoInput): Uint8Array {
  const header = utf8Bytes(
    `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${photo.filename}"\r\nContent-Type: ${photo.contentType}\r\n\r\n`,
  );
  return concatBytes([header, photo.data, utf8Bytes('\r\n')]);
}

/**
 * 제보 쓰기(사진 있음)의 multipart/form-data 본문 — 서버 `parseMultipartCreateRequest` 와
 * 같은 필드 이름(`valleyId`·`segmentId`·`type`·`body`·`nickname`·`password`·`photos`)이다.
 * 경계 문자열에 타임스탬프를 섞어 본문 안 어떤 값과도 우연히 겹치지 않게 한다.
 */
function buildReportMultipartBody(draft: ApiReportDraft): {
  readonly body: Uint8Array;
  readonly contentType: string;
} {
  const boundary = `${MULTIPART_BOUNDARY_PREFIX}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const hasCoordinate = draft.lat !== undefined && draft.lng !== undefined;
  const parts: Uint8Array[] = [
    multipartField(boundary, 'valleyId', draft.valleyId),
    ...(draft.segmentId ? [multipartField(boundary, 'segmentId', draft.segmentId)] : []),
    multipartField(boundary, 'type', draft.type),
    multipartField(boundary, 'body', draft.body),
    multipartField(boundary, 'nickname', draft.nickname),
    multipartField(boundary, 'password', draft.password),
    // F5d — 둘 다 있을 때만(한쪽만 있으면 서버가 400 으로 거절한다).
    ...(hasCoordinate ? [multipartField(boundary, 'lat', String(draft.lat))] : []),
    ...(hasCoordinate ? [multipartField(boundary, 'lng', String(draft.lng))] : []),
    ...(draft.photos ?? []).map((photo) => multipartFile(boundary, 'photos', photo)),
    utf8Bytes(`--${boundary}--\r\n`),
  ];
  return { body: concatBytes(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

/** 서버 SSE `data` → `ApiEvent`. 모양이 다르면 `null`. */
export function parseSseEvent(type: string, data: string): ApiEvent | null {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(data) as Record<string, unknown>;
  } catch {
    return null;
  }
  const at = typeof payload['at'] === 'string' ? payload['at'] : null;
  if (type === 'hello') {
    const channels = Array.isArray(payload['channels'])
      ? payload['channels'].filter(
          (c): c is ApiEventChannel =>
            c === 'hydro' || c === 'aws' || c === 'alert' || c === 'report',
        )
      : [];
    return { type: 'hello', channels };
  }
  if (at === null) return null;
  if (type === 'heartbeat') return { type: 'heartbeat', at };
  if (type === 'hydro' || type === 'aws' || type === 'alert') {
    const observedAt = typeof payload['observedAt'] === 'string' ? payload['observedAt'] : null;
    return { type, at, observedAt };
  }
  if (type === 'report') {
    const report = parseApiReportEventSummary(payload['report']);
    return report === null ? null : { type: 'report', at, report };
  }
  return null;
}

/** SSE `report` 이벤트의 `report` 필드 — 모양이 다르면 `null`(요약 자체를 못 믿으면 통째로 버린다). */
function parseApiReportEventSummary(raw: unknown): ApiReportEventSummary | null {
  if (raw === null || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r['id'] === 'string' ? r['id'] : null;
  const valleyId = typeof r['valleyId'] === 'string' ? r['valleyId'] : null;
  const type = typeof r['type'] === 'string' && isReportType(r['type']) ? r['type'] : null;
  const nickname = typeof r['nickname'] === 'string' ? r['nickname'] : null;
  const createdAt = typeof r['createdAt'] === 'string' ? r['createdAt'] : null;
  if (
    id === null ||
    valleyId === null ||
    type === null ||
    nickname === null ||
    createdAt === null
  ) {
    return null;
  }
  return { id, valleyId, type, nickname, createdAt };
}
