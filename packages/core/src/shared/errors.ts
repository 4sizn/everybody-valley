/**
 * 애플리케이션 오류 계층.
 *
 * 모든 실패는 `AppError` 하위 타입이다. `code` 로 프로그램이 분기하고,
 * `message` 는 개발자용이며, `context` 는 로그에 그대로 실린다.
 * 사용자에게 보일 문구는 표현 계층이 `code` 를 보고 만든다.
 */

export const ERROR_CODES = [
  'geo/invalid-coordinate',
  'geo/invalid-distance',
  'festival/spot-not-found',
  'festival/invalid-spot',
  'valley/segment-not-found',
  'valley/facility-not-found',
  'valley/empty-valley',
  'valley/inconsistent-segments',
  'valley-data/invalid-collection',
  'valley-data/missing-field',
  'valley-data/invalid-value',
  'valley-data/invalid-geometry',
  'valley-data/unsupported-crs',
  'repository/load-failed',
  'map/not-initialized',
  'map/initialization-failed',
  'map/style-load-failed',
  'map/layer-failed',
  'map/source-failed',
  'map/camera-failed',
  'map/capability-unsupported',
  'gl/context-unavailable',
  'gl/shader-compile-failed',
  'gl/program-link-failed',
  'storage/read-failed',
  'storage/write-failed',
  'storage/unavailable',
  'async/cancelled',
  'async/timeout',
  'internal/unexpected',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** 로그·전송에 안전한 평평한 부가 정보. */
export type ErrorContext = Readonly<Record<string, string | number | boolean | null>>;

export type AppErrorOptions = {
  readonly cause?: unknown;
  readonly context?: ErrorContext;
};

export abstract class AppError extends Error {
  abstract readonly code: ErrorCode;

  readonly context: ErrorContext;

  protected constructor(message: string, options: AppErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.context = options.context ?? {};
    // 트랜스파일된 클래스 상속에서도 instanceof 가 동작하도록 고정한다.
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /** 구조화 로깅용 평평한 페이로드. */
  toLogPayload(): Readonly<Record<string, unknown>> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      ...this.context,
      ...(this.cause === undefined ? {} : { cause: describeCause(this.cause) }),
    };
  }
}

function describeCause(cause: unknown): string {
  if (cause instanceof Error) return `${cause.name}: ${cause.message}`;
  if (typeof cause === 'string') return cause;
  try {
    return JSON.stringify(cause) ?? String(cause);
  } catch {
    return String(cause);
  }
}

/** 코드를 생성자 인자로 받는 구체 오류. 도메인별 하위 클래스의 기반. */
class CodedError extends AppError {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string, options?: AppErrorOptions) {
    super(message, options);
    this.code = code;
  }
}

export class GeoError extends CodedError {}
export class FestivalError extends CodedError {}
/** 계곡 애그리게이트 불변식 위반 (구간 누락·다른 계곡의 구간 혼입 등). */
export class ValleyError extends CodedError {}
/** GeoJSON → 계곡 도메인 로더의 검증 실패. `context.path` 가 어느 필드인지 가리킨다. */
export class ValleyDataError extends CodedError {}
export class RepositoryError extends CodedError {}
export class MapEngineError extends CodedError {}
export class GlError extends CodedError {}
export class StorageError extends CodedError {}

/** 취소는 오류 계층에 속하지만 실패로 로깅하지 않는다. */
export class CancelledError extends AppError {
  readonly code = 'async/cancelled' as const;

  /** 취소된 작업의 이름. 로그에서 어느 단계가 끊겼는지 바로 읽히게 남긴다. */
  readonly operation: string;

  constructor(operation: string, options?: AppErrorOptions) {
    super(`작업이 취소되었습니다: ${operation}`, {
      ...options,
      context: { operation, ...options?.context },
    });
    this.operation = operation;
  }
}

export class TimeoutError extends AppError {
  readonly code = 'async/timeout' as const;

  constructor(operation: string, timeoutMs: number, options?: AppErrorOptions) {
    super(`작업이 ${timeoutMs}ms 안에 끝나지 않았습니다: ${operation}`, {
      ...options,
      context: { operation, timeoutMs, ...options?.context },
    });
  }
}

/** 지도 엔진이 그 기능을 제공하지 않는 경우. 네이티브 어댑터의 주된 실패 모드. */
export class CapabilityUnsupportedError extends AppError {
  readonly code = 'map/capability-unsupported' as const;

  constructor(capability: string, engine: string, options?: AppErrorOptions) {
    super(`${engine} 엔진은 '${capability}' 기능을 지원하지 않습니다.`, {
      ...options,
      context: { capability, engine, ...options?.context },
    });
  }
}

/** 정규화되지 않은 예외를 감싸는 마지막 그물. */
export class UnexpectedError extends CodedError {
  constructor(message: string, options?: AppErrorOptions) {
    super('internal/unexpected', message, options);
  }
}

/** catch 로 잡은 unknown 을 AppError 로 정규화한다. */
export function toAppError(thrown: unknown, fallbackMessage: string): AppError {
  if (thrown instanceof AppError) return thrown;
  if (thrown instanceof Error) {
    return new UnexpectedError(thrown.message || fallbackMessage, { cause: thrown });
  }
  return new UnexpectedError(fallbackMessage, { cause: thrown });
}

export function isCancelled(error: AppError): error is CancelledError {
  return error.code === 'async/cancelled';
}
