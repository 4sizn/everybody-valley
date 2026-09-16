/**
 * 프로세스 안 폴링 잡(결정 (f)). 시작하면 즉시 1회, 성공하면 `intervalMs` 뒤, 실패하면 지수 백오프 뒤 다시.
 * 매 시도를 `fetch_log` 에 남긴다(오류 메시지는 마스킹). 겹침 없음 — 한 번에 하나만 돈다.
 */
import type { Logger } from '@modu-valley/core';
import type { FetchLogRepo } from '../db/repos';
import type { Redactor } from '../logging/redact';
import { HttpError } from '../sources/http';
import { type BackoffOptions, nextDelayMs } from './backoff';

export interface JobRunResult {
  readonly rows: number;
  readonly status?: number;
  readonly detail?: Readonly<Record<string, unknown>>;
}

export interface PollJobOptions {
  readonly name: string;
  readonly intervalMs: number;
  readonly run: () => Promise<JobRunResult>;
  readonly fetchLog: FetchLogRepo;
  readonly logger: Logger;
  readonly redact: Redactor;
  readonly now?: () => number;
  readonly backoff?: Omit<BackoffOptions, 'intervalMs'>;
}

export class PollJob {
  readonly name: string;
  #failures = 0;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #running: Promise<boolean> | undefined;
  #stopped = true;
  #nextRunAt: number | null = null;
  readonly #o: PollJobOptions;
  readonly #now: () => number;

  constructor(options: PollJobOptions) {
    this.name = options.name;
    this.#o = options;
    this.#now = options.now ?? Date.now;
  }

  get failures(): number {
    return this.#failures;
  }

  get nextRunAt(): number | null {
    return this.#nextRunAt;
  }

  start(): void {
    if (!this.#stopped) return;
    this.#stopped = false;
    void this.#tick();
  }

  stop(): void {
    this.#stopped = true;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#nextRunAt = null;
  }

  /** 한 번 실행하고 성공 여부를 돌려준다. 스케줄과 무관하게 호출할 수 있다(테스트·수동). */
  runOnce(): Promise<boolean> {
    if (this.#running) return this.#running;
    this.#running = this.#execute().finally(() => {
      this.#running = undefined;
    });
    return this.#running;
  }

  async #tick(): Promise<void> {
    const ok = await this.runOnce();
    if (this.#stopped) return;
    const delay = nextDelayMs(ok ? 0 : this.#failures, {
      intervalMs: this.#o.intervalMs,
      ...this.#o.backoff,
    });
    this.#nextRunAt = this.#now() + delay;
    this.#timer = setTimeout(() => void this.#tick(), delay);
    this.#timer.unref?.();
  }

  async #execute(): Promise<boolean> {
    const startedMs = this.#now();
    const startedAt = new Date(startedMs).toISOString();
    try {
      const result = await this.#o.run();
      const finishedMs = this.#now();
      this.#failures = 0;
      this.#o.fetchLog.record({
        job: this.name,
        startedAt,
        finishedAt: new Date(finishedMs).toISOString(),
        ok: true,
        status: result.status ?? 200,
        rows: result.rows,
        durationMs: finishedMs - startedMs,
        error: null,
      });
      this.#o.logger.info('job ok', {
        job: this.name,
        rows: result.rows,
        ms: finishedMs - startedMs,
        ...result.detail,
      });
      return true;
    } catch (error) {
      const finishedMs = this.#now();
      this.#failures += 1;
      const message = this.#o.redact(error instanceof Error ? error.message : String(error));
      this.#o.fetchLog.record({
        job: this.name,
        startedAt,
        finishedAt: new Date(finishedMs).toISOString(),
        ok: false,
        status: error instanceof HttpError ? error.status : null,
        rows: null,
        durationMs: finishedMs - startedMs,
        error: message,
      });
      this.#o.logger.warn('job failed', {
        job: this.name,
        failures: this.#failures,
        ms: finishedMs - startedMs,
        error: message,
      });
      return false;
    }
  }
}
