/**
 * 폴러 재시도 간격(결정 (f)): 성공하면 정규 주기, 실패하면 30 s·60 s·120 s… 지수로 늘리되 10분을 넘지 않는다.
 * 백오프는 정규 주기와 무관하다 — 10분 잡도 첫 실패 뒤 30 s 에 다시 시도하고, 1분 잡도 장애가 길어지면
 * 10분까지 늘어나 한도를 태우지 않는다.
 */
export interface BackoffOptions {
  readonly intervalMs: number;
  readonly baseMs?: number;
  readonly maxMs?: number;
}

export const DEFAULT_BACKOFF_BASE_MS = 30_000;
export const DEFAULT_BACKOFF_MAX_MS = 10 * 60_000;

/** 연속 실패 횟수(`failures`, 0 = 직전 성공) 뒤 다음 실행까지의 지연. */
export function nextDelayMs(failures: number, options: BackoffOptions): number {
  if (failures <= 0) return options.intervalMs;
  const base = options.baseMs ?? DEFAULT_BACKOFF_BASE_MS;
  const max = options.maxMs ?? DEFAULT_BACKOFF_MAX_MS;
  return Math.min(max, base * 2 ** (failures - 1));
}
