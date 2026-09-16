/**
 * 콘솔 구현. 이 파일이 프로젝트에서 `console` 을 부르는 유일한 지점이다.
 */
import { AppError } from '../errors';
import { LOG_LEVEL_ORDER, type LogFields, Logger, type LogLevel } from './Logger';

export type ConsoleLoggerOptions = {
  /** 이 레벨 미만은 버린다. 기본값은 개발 debug / 배포 warn. */
  readonly minLevel?: LogLevel;
  /** 테스트에서 갈아끼울 수 있게 시각 공급원을 분리한다. */
  readonly now?: () => Date;
};

type Sink = (message: string, payload?: Readonly<Record<string, unknown>>) => void;

export class ConsoleLogger extends Logger {
  readonly scope: string;

  readonly #minLevel: number;
  readonly #now: () => Date;

  constructor(scope = 'app', options: ConsoleLoggerOptions = {}) {
    super();
    this.scope = scope;
    this.#minLevel = LOG_LEVEL_ORDER[options.minLevel ?? defaultMinLevel()];
    this.#now = options.now ?? (() => new Date());
  }

  debug(message: string, fields?: LogFields): void {
    // 로깅 구현체의 유일한 출력 지점
    this.#write('debug', console.log, message, fields);
  }

  info(message: string, fields?: LogFields): void {
    this.#write('info', console.info, message, fields);
  }

  warn(message: string, fields?: LogFields): void {
    this.#write('warn', console.warn, message, fields);
  }

  error(message: string, error?: AppError | unknown, fields?: LogFields): void {
    this.#write('error', console.error, message, { ...describe(error), ...fields });
  }

  child(scope: string): Logger {
    return new ConsoleLogger(`${this.scope}:${scope}`, {
      minLevel: levelName(this.#minLevel),
      now: this.#now,
    });
  }

  #write(level: LogLevel, sink: Sink, message: string, fields?: LogFields): void {
    if (LOG_LEVEL_ORDER[level] < this.#minLevel) return;
    const prefix = `${this.#now().toISOString()} ${level.toUpperCase().padEnd(5)} [${this.scope}]`;
    if (fields === undefined || Object.keys(fields).length === 0) {
      sink(`${prefix} ${message}`);
      return;
    }
    sink(`${prefix} ${message}`, fields);
  }
}

function describe(error: unknown): Readonly<Record<string, unknown>> {
  if (error === undefined) return {};
  if (error instanceof AppError) return { error: error.toLogPayload() };
  if (error instanceof Error) {
    return { error: { name: error.name, message: error.message, stack: error.stack } };
  }
  return { error };
}

function defaultMinLevel(): LogLevel {
  const dev = (globalThis as { __DEV__?: boolean }).__DEV__;
  return dev === false ? 'warn' : 'debug';
}

function levelName(order: number): LogLevel {
  for (const [name, value] of Object.entries(LOG_LEVEL_ORDER)) {
    if (value === order) return name as LogLevel;
  }
  return 'debug';
}
