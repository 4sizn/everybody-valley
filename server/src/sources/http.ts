/**
 * 잡용 fetch. 타임아웃·상태 검사·키 마스킹된 오류만 담당한다. 재시도는 `PollJob` 의 백오프가 맡는다.
 */
import type { Redactor } from '../logging/redact';

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export interface SourceHttpOptions {
  readonly fetch?: typeof fetch;
  readonly redact: Redactor;
  readonly timeoutMs?: number;
  readonly userAgent?: string;
}

export interface SourceHttp {
  text(url: string, encoding?: 'utf8' | 'euc-kr'): Promise<{ body: string; status: number }>;
  json<T = unknown>(url: string): Promise<{ body: T; status: number }>;
}

export function createSourceHttp(options: SourceHttpOptions): SourceHttp {
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const userAgent = options.userAgent ?? 'modu-valley-server/0.1';

  async function bytes(url: string): Promise<{ buf: ArrayBuffer; status: number }> {
    let res: Response;
    try {
      res = await doFetch(url, {
        headers: { 'user-agent': userAgent },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new Error(
        options.redact(
          `fetch 실패 ${url}: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
    if (!res.ok) throw new HttpError(res.status, options.redact(`HTTP ${res.status} ${url}`));
    return { buf: await res.arrayBuffer(), status: res.status };
  }

  return {
    async text(url, encoding = 'utf8') {
      const { buf, status } = await bytes(url);
      const body = new TextDecoder(encoding === 'euc-kr' ? 'euc-kr' : 'utf-8').decode(buf);
      return { body, status };
    },
    async json<T>(url: string) {
      const { buf, status } = await bytes(url);
      const text = new TextDecoder('utf-8').decode(buf);
      try {
        return { body: JSON.parse(text) as T, status };
      } catch {
        throw new Error(options.redact(`JSON 아님 ${url}: ${text.slice(0, 120)}`));
      }
    },
  };
}
