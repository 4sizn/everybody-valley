/**
 * Result — 예상된 실패를 값으로 다루는 프로토콜.
 *
 * 규약
 *  · 호출자가 복구할 수 있는 실패(스타일 로드 실패, 저장소 접근 거부,
 *    잘못된 좌표 입력)는 `Result` 로 돌려준다.
 *  · 호출자가 복구할 수 없는 프로그래밍 오류(불변식 위반)는 throw 한다.
 *  · 비동기 함수는 `Promise<Result<T>>` 를 돌려주고 reject 하지 않는다.
 *    단 하나의 예외는 취소이며, 그것도 `Result` 로 표현한다.
 */
import type { AppError } from './errors';

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E extends AppError> = { readonly ok: false; readonly error: E };

export type Result<T, E extends AppError = AppError> = Ok<T> | Err<E>;

/** 값이 없는 성공을 표현하는 별칭. `Result<void>` 보다 의도가 분명하다. */
export type VoidResult<E extends AppError = AppError> = Result<undefined, E>;

const OK_VOID: Ok<undefined> = { ok: true, value: undefined };

export function ok(): Ok<undefined>;
export function ok<T>(value: T): Ok<T>;
export function ok<T>(value?: T): Ok<T | undefined> {
  return value === undefined ? OK_VOID : { ok: true, value };
}

export function err<E extends AppError>(error: E): Err<E> {
  return { ok: false, error };
}

export function isOk<T, E extends AppError>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

export function isErr<T, E extends AppError>(result: Result<T, E>): result is Err<E> {
  return !result.ok;
}

/** 성공 값을 변환한다. 실패는 그대로 통과시킨다. */
export function mapResult<T, U, E extends AppError>(
  result: Result<T, E>,
  transform: (value: T) => U,
): Result<U, E> {
  return result.ok ? ok(transform(result.value)) : result;
}

/** 성공하면 다음 Result 를 반환하는 함수로 이어 붙인다. */
export function flatMapResult<T, U, E extends AppError>(
  result: Result<T, E>,
  transform: (value: T) => Result<U, E>,
): Result<U, E> {
  return result.ok ? transform(result.value) : result;
}

export function unwrapOr<T, E extends AppError>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback;
}

/** 여러 Result 를 모은다. 첫 실패에서 멈춘다. */
export function collectResults<T, E extends AppError>(
  results: readonly Result<T, E>[],
): Result<readonly T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (!result.ok) return result;
    values.push(result.value);
  }
  return ok(values as readonly T[]);
}
