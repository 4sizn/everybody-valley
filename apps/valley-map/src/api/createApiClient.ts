/**
 * 서버 API 클라이언트 배선(S1 결정 (d)). `EXPO_PUBLIC_API_BASE` 가 서버 주소다 — web·android·ios 가 같은 변수를 읽는다.
 * 기본은 로컬 개발 서버 `http://localhost:8787`(`pnpm server:dev`).
 *
 * 여기서는 포트만 만든다. UI 배선(세션·화면)은 F2·F3b 의 몫이다.
 */
import {
  type EventSourceFactory,
  FetchApiClient,
  type FetchLike,
  type Logger,
} from '@modu-valley/core';
import { VisibilityEventSource } from './visibilityEventSource';

export const DEFAULT_API_BASE = 'http://localhost:8787';

export function resolveApiBase(raw: string | undefined = process.env.EXPO_PUBLIC_API_BASE): string {
  const trimmed = raw?.trim();
  if (trimmed) return trimmed;
  // Production web is served with /api and /uploads on the same origin.
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production')
    return window.location.origin;
  return DEFAULT_API_BASE;
}

/**
 * 제보 사진의 절대 URL(F5c) — `ApiReportPhoto.url`/`ReportPhoto.url` 은 서버 정적 서빙
 * 경로(`/uploads/<id>.jpg`)뿐이다(F5a 결정 (d)). 이미 절대 URL(테스트 픽스처 등)이면
 * 그대로 둔다.
 */
export function reportPhotoUrl(url: string): string {
  return /^https?:\/\//.test(url) ? url : `${resolveApiBase()}${url}`;
}

/**
 * 브라우저(web)에는 `EventSource` 가 있고, RN 런타임에는 없다 — 없으면 SSE 없이 REST 만 쓴다.
 *
 * `document` 가 있으면 `VisibilityEventSource` 로 감싼다. 숨은 탭이 연결을 쥐고 있으면 브라우저의
 * 출처당 여섯 연결 한도가 차서 새 탭이 멈춘다(그 파일에 실측을 적어 두었다).
 */
function eventSourceFactory(): EventSourceFactory | undefined {
  const ctor = (globalThis as { EventSource?: new (url: string) => unknown }).EventSource;
  if (typeof ctor !== 'function') return undefined;
  const open = (url: string) => new ctor(url) as unknown as ReturnType<EventSourceFactory>;
  if (typeof document === 'undefined') return open;
  return (url) => new VisibilityEventSource(() => open(url), document);
}

export function createApiClient(
  options: { logger?: Logger; baseUrl?: string } = {},
): FetchApiClient {
  // web `fetch` 의 `RequestInit['body']` 는 `Uint8Array` 를 실제로 받아들이지만(BufferSource),
  // TS lib 의 `BodyInit` 유니온 타입 검사가 `exactOptionalPropertyTypes` 아래서 구조적으로
  // 어긋난다고 본다 — 경계에서만 단언한다(멀티파트 제보 전송, F5b).
  const fetchLike: FetchLike = (url, init) => fetch(url, init as RequestInit | undefined);
  const eventSource = eventSourceFactory();
  return new FetchApiClient({
    baseUrl: options.baseUrl ?? resolveApiBase(),
    fetch: fetchLike,
    ...(eventSource ? { eventSource } : {}),
    ...(options.logger ? { logger: options.logger } : {}),
  });
}
