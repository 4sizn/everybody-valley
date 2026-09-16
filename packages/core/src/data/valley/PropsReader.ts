/**
 * GeoJSON `properties` 검증 도우미 — 로더 내부 전용.
 *
 * 필드 하나마다 `Result` 를 풀어 early-return 하면 스무 개 필드짜리 파서가
 * 읽기 힘들어진다. 대신 첫 실패를 기억해 두고 자리표시자를 돌려준 뒤,
 * `finish()` 에서 한 번에 판정한다. 자리표시자는 `finish()` 가 실패를 돌려줄 때
 * 절대 바깥으로 나가지 않으므로, 읽는 쪽 코드는 값이 항상 있다고 가정해도 된다.
 *
 * 오류 `context.path` 는 `features[2].properties.depth` 처럼 JSON 경로다 —
 * 데이터 작성자가 어느 줄을 고쳐야 하는지 바로 알게 하려는 것이다.
 */
import { ValleyDataError } from '../../shared/errors';
import { err, ok, type Result } from '../../shared/result';

export type JsonRecord = Readonly<Record<string, unknown>>;

export function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function missingField(path: string): ValleyDataError {
  return new ValleyDataError('valley-data/missing-field', `필수 필드가 없습니다: ${path}`, {
    context: { path },
  });
}

export function invalidValue(path: string, expected: string, actual: unknown): ValleyDataError {
  return new ValleyDataError(
    'valley-data/invalid-value',
    `${path} 는 ${expected} 이어야 합니다. 받은 값: ${describe(actual)}`,
    { context: { path, expected, actual: describe(actual) } },
  );
}

export function describe(value: unknown): string {
  if (typeof value === 'string') return `'${value}'`;
  if (value === undefined) return 'undefined';
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

type NumberBounds = { readonly min?: number; readonly max?: number; readonly integer?: boolean };
/** 숫자 배열 — 원소마다 `NumberBounds`, 배열 전체에 정확한 길이. 스키마의 `minItems === maxItems`. */
type NumberArrayBounds = NumberBounds & { readonly length: number };

export class PropsReader {
  readonly #record: JsonRecord;
  readonly #path: string;
  readonly #parent: PropsReader | undefined;
  #failure: ValleyDataError | undefined;

  constructor(record: JsonRecord, path: string, parent?: PropsReader) {
    this.#record = record;
    this.#path = path;
    this.#parent = parent;
  }

  /**
   * 첫 실패만 남긴다. 나머지는 첫 것을 고친 뒤 다음 로드에서 드러난다.
   * 하위 reader(`record()`)의 실패는 상위로 올라가므로 루트의 `finish()` 하나로 판정한다.
   */
  #fail(error: ValleyDataError): void {
    this.#failure ??= error;
    if (this.#parent !== undefined) this.#parent.#fail(error);
  }

  #at(key: string): string {
    return `${this.#path}.${key}`;
  }

  #has(key: string): boolean {
    return this.#record[key] !== undefined && this.#record[key] !== null;
  }

  string(key: string): string {
    const value = this.#record[key];
    if (typeof value === 'string' && value.length > 0) return value;
    this.#fail(
      value === undefined || value === null
        ? missingField(this.#at(key))
        : invalidValue(this.#at(key), '빈 문자열이 아닌 문자열', value),
    );
    return '';
  }

  /** 정규식에 맞아야 하는 필수 문자열. 스키마의 `pattern`. */
  pattern(key: string, regex: RegExp, format: string): string {
    const value = this.string(key);
    if (value === '' || regex.test(value)) return value;
    this.#fail(invalidValue(this.#at(key), `${format} 형식`, value));
    return '';
  }

  optionalString(key: string): string | undefined {
    if (!this.#has(key)) return undefined;
    const value = this.#record[key];
    if (typeof value === 'string') return value;
    this.#fail(invalidValue(this.#at(key), '문자열', value));
    return undefined;
  }

  /** `expected` 와 정확히 같아야 하는 상수 필드. 스키마의 `const`. */
  const<T extends string>(key: string, expected: T, code?: 'valley-data/unsupported-crs'): T {
    const value = this.#record[key];
    if (value === expected) return expected;
    if (value === undefined || value === null) {
      this.#fail(missingField(this.#at(key)));
    } else if (code === undefined) {
      this.#fail(invalidValue(this.#at(key), `'${expected}'`, value));
    } else {
      this.#fail(
        new ValleyDataError(
          code,
          `${this.#at(key)} 는 '${expected}' 만 허용합니다. 저장 시점에 정규화하고 런타임에는 변환하지 않습니다.`,
          { context: { path: this.#at(key), expected, actual: describe(value) } },
        ),
      );
    }
    return expected;
  }

  enum<T extends string>(key: string, values: readonly T[]): T {
    const value = this.#record[key];
    if (typeof value === 'string' && (values as readonly string[]).includes(value)) {
      return value as T;
    }
    this.#fail(
      value === undefined || value === null
        ? missingField(this.#at(key))
        : invalidValue(this.#at(key), `${values.map((v) => `'${v}'`).join(' | ')} 중 하나`, value),
    );
    return values[0] as T;
  }

  optionalEnum<T extends string>(key: string, values: readonly T[]): T | undefined {
    if (!this.#has(key)) return undefined;
    const value = this.#record[key];
    if (typeof value === 'string' && (values as readonly string[]).includes(value)) {
      return value as T;
    }
    this.#fail(
      invalidValue(this.#at(key), `${values.map((v) => `'${v}'`).join(' | ')} 중 하나`, value),
    );
    return undefined;
  }

  /** 정수 enum(`mapIconTier` 0|1|2)처럼 값 집합이 숫자인 경우. */
  optionalNumberEnum<T extends number>(key: string, values: readonly T[]): T | undefined {
    if (!this.#has(key)) return undefined;
    const value = this.#record[key];
    if (typeof value === 'number' && (values as readonly number[]).includes(value)) {
      return value as T;
    }
    this.#fail(invalidValue(this.#at(key), `${values.join(' | ')} 중 하나`, value));
    return undefined;
  }

  number(key: string, bounds: NumberBounds = {}): number {
    const value = this.#record[key];
    if (value === undefined || value === null) {
      this.#fail(missingField(this.#at(key)));
      return 0;
    }
    return this.#checkNumber(key, value, bounds) ?? 0;
  }

  optionalNumber(key: string, bounds: NumberBounds = {}): number | undefined {
    if (!this.#has(key)) return undefined;
    return this.#checkNumber(key, this.#record[key], bounds);
  }

  #checkNumber(key: string, value: unknown, bounds: NumberBounds): number | undefined {
    const expectation = describeBounds(bounds);
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      this.#fail(invalidValue(this.#at(key), expectation, value));
      return undefined;
    }
    const integerOk = bounds.integer !== true || Number.isInteger(value);
    const minOk = bounds.min === undefined || value >= bounds.min;
    const maxOk = bounds.max === undefined || value <= bounds.max;
    if (integerOk && minOk && maxOk) return value;
    this.#fail(invalidValue(this.#at(key), expectation, value));
    return undefined;
  }

  /**
   * 고정 길이 숫자 배열(`shadeByHour` 9개). 길이가 다르거나 원소 하나라도 범위를
   * 벗어나면 실패 — 시각 축과 어긋난 배열은 슬라이더가 잘못된 값을 가리키게 된다.
   */
  optionalNumberArray(key: string, bounds: NumberArrayBounds): readonly number[] | undefined {
    if (!this.#has(key)) return undefined;
    const value = this.#record[key];
    const expectation = `길이 ${bounds.length} 인 ${describeBounds(bounds)} 배열`;
    if (!Array.isArray(value) || value.length !== bounds.length) {
      this.#fail(invalidValue(this.#at(key), expectation, value));
      return undefined;
    }
    const numbers: number[] = [];
    for (const [index, element] of value.entries()) {
      const checked = this.#checkNumber(`${key}[${index}]`, element, bounds);
      if (checked === undefined) return undefined;
      numbers.push(checked);
    }
    return numbers;
  }

  /** 문자열 배열(`metadata.sources`). 원소 하나라도 문자열이 아니면 실패. */
  optionalStringArray(key: string): readonly string[] | undefined {
    if (!this.#has(key)) return undefined;
    const value = this.#record[key];
    if (Array.isArray(value) && value.every((element) => typeof element === 'string')) {
      return value as readonly string[];
    }
    this.#fail(invalidValue(this.#at(key), '문자열 배열', value));
    return undefined;
  }

  optionalBoolean(key: string): boolean | undefined {
    if (!this.#has(key)) return undefined;
    const value = this.#record[key];
    if (typeof value === 'boolean') return value;
    this.#fail(invalidValue(this.#at(key), 'boolean', value));
    return undefined;
  }

  /** 하위 객체. 없거나 객체가 아니면 빈 객체 위의 reader 를 돌려주고 실패를 기록한다. */
  record(key: string): PropsReader {
    const value = this.#record[key];
    if (isJsonRecord(value)) return new PropsReader(value, this.#at(key), this);
    this.#fail(
      value === undefined || value === null
        ? missingField(this.#at(key))
        : invalidValue(this.#at(key), '객체', value),
    );
    return new PropsReader({}, this.#at(key), this);
  }

  /** 배열 필드의 원시 값. 원소 검증은 호출자가 한다. */
  array(key: string): readonly unknown[] {
    const value = this.#record[key];
    if (Array.isArray(value)) return value;
    this.#fail(
      value === undefined || value === null
        ? missingField(this.#at(key))
        : invalidValue(this.#at(key), '배열', value),
    );
    return [];
  }

  /** 다른 reader(하위 객체·기하 파서)의 실패를 이 reader 로 합친다. */
  absorb<T>(result: Result<T, ValleyDataError>, placeholder: T): T {
    if (result.ok) return result.value;
    this.#fail(result.error);
    return placeholder;
  }

  /** 실패가 하나도 없었을 때만 `build` 를 호출한다. */
  finish<T>(build: () => T): Result<T, ValleyDataError> {
    return this.#failure === undefined ? ok(build()) : err(this.#failure);
  }
}

function describeBounds(bounds: NumberBounds): string {
  const parts = [bounds.integer === true ? '정수' : '유한한 수'];
  if (bounds.min !== undefined) parts.push(`${bounds.min} 이상`);
  if (bounds.max !== undefined) parts.push(`${bounds.max} 이하`);
  return parts.join(' ');
}
