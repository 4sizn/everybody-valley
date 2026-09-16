/**
 * 로깅 포트.
 *
 * 도메인·애플리케이션 계층은 `console` 을 직접 부르지 않는다. 어느 플랫폼에
 * 얹히는지 모른 채 로그를 남기려면 이 추상 위에서만 이야기해야 한다.
 * (biome 의 `noConsole` 규칙이 이 경계를 강제한다 — 예외는 ConsoleLogger 뿐)
 */
import type { AppError } from '../errors';

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const LOG_LEVEL_ORDER: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** 로그에 함께 실리는 구조화 필드. 직렬화 가능한 값만 허용한다. */
export type LogFields = Readonly<Record<string, unknown>>;

export abstract class Logger {
  abstract readonly scope: string;

  abstract debug(message: string, fields?: LogFields): void;
  abstract info(message: string, fields?: LogFields): void;
  abstract warn(message: string, fields?: LogFields): void;

  /**
   * 실패를 기록한다. `AppError` 를 받으면 `toLogPayload()` 를 펼쳐 넣는다.
   * 취소(`async/cancelled`)는 실패가 아니므로 호출자가 걸러야 한다.
   */
  abstract error(message: string, error?: AppError | unknown, fields?: LogFields): void;

  /** 하위 스코프를 딴 로거를 만든다. 스코프는 `부모:자식` 으로 이어진다. */
  abstract child(scope: string): Logger;
}
