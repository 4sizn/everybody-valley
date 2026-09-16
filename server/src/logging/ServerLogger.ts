/**
 * 서버용 `Logger` 구현. `console` 을 쓰지 않고(biome `noConsole`) stdout/stderr 에 직접 쓴다.
 *
 * 한 줄 = 한 레코드. `json`(배포: 수집기 친화) 또는 `pretty`(개발: 사람이 읽는다). 어느 형식이든
 * 직렬화된 한 줄 전체를 `redact` 로 거르므로 메시지·필드·오류 스택 어디에 키가 섞여도 나가지 않는다.
 */
import {
  AppError,
  LOG_LEVEL_ORDER,
  type LogFields,
  Logger,
  type LogLevel,
} from '@modu-valley/core';
import { identityRedactor, type Redactor } from './redact';

export interface ServerLoggerOptions {
  readonly minLevel?: LogLevel;
  readonly format?: 'json' | 'pretty';
  readonly redact?: Redactor;
  readonly now?: () => Date;
  /** 테스트에서 출력을 가로챈다. 기본은 stdout(debug·info) / stderr(warn·error). */
  readonly sink?: (level: LogLevel, line: string) => void;
}

const defaultSink = (level: LogLevel, line: string): void => {
  const stream = LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER.warn ? process.stderr : process.stdout;
  stream.write(`${line}\n`);
};

export class ServerLogger extends Logger {
  readonly scope: string;

  readonly #minLevel: number;
  readonly #format: 'json' | 'pretty';
  readonly #redact: Redactor;
  readonly #now: () => Date;
  readonly #sink: (level: LogLevel, line: string) => void;
  readonly #options: ServerLoggerOptions;

  constructor(scope = 'server', options: ServerLoggerOptions = {}) {
    super();
    this.scope = scope;
    this.#options = options;
    this.#minLevel = LOG_LEVEL_ORDER[options.minLevel ?? 'debug'];
    this.#format = options.format ?? 'json';
    this.#redact = options.redact ?? identityRedactor;
    this.#now = options.now ?? (() => new Date());
    this.#sink = options.sink ?? defaultSink;
  }

  debug(message: string, fields?: LogFields): void {
    this.#write('debug', message, fields);
  }

  info(message: string, fields?: LogFields): void {
    this.#write('info', message, fields);
  }

  warn(message: string, fields?: LogFields): void {
    this.#write('warn', message, fields);
  }

  error(message: string, error?: AppError | unknown, fields?: LogFields): void {
    this.#write('error', message, { ...describeError(error), ...fields });
  }

  child(scope: string): Logger {
    return new ServerLogger(`${this.scope}:${scope}`, this.#options);
  }

  #write(level: LogLevel, message: string, fields?: LogFields): void {
    if (LOG_LEVEL_ORDER[level] < this.#minLevel) return;
    const ts = this.#now().toISOString();
    const hasFields = fields !== undefined && Object.keys(fields).length > 0;
    const line =
      this.#format === 'json'
        ? JSON.stringify({
            ts,
            level,
            scope: this.scope,
            msg: message,
            ...(hasFields ? fields : {}),
          })
        : `${ts} ${level.toUpperCase().padEnd(5)} [${this.scope}] ${message}${
            hasFields ? ` ${JSON.stringify(fields)}` : ''
          }`;
    this.#sink(level, this.#redact(line));
  }
}

export function describeError(error: unknown): Readonly<Record<string, unknown>> {
  if (error === undefined) return {};
  if (error instanceof AppError) return { error: error.toLogPayload() };
  if (error instanceof Error) {
    return {
      error: {
        name: error.name,
        message: error.message,
        ...(error.cause !== undefined ? { cause: String(error.cause) } : {}),
        stack: error.stack,
      },
    };
  }
  return { error: String(error) };
}
