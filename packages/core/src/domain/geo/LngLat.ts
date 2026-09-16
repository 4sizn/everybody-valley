/**
 * 경위도 값 객체.
 *
 * 원본 데모는 `[lng, lat]` 배열을 그대로 돌린다. 짧지만 순서를 뒤집어도
 * 타입이 잡아 주지 않고, 위도/경도 범위 검사도 없다. 값 객체로 감싸 두면
 * 잘못된 좌표가 지도 엔진까지 내려가지 못한다.
 */
import { GeoError } from '../../shared/errors';
import { err, ok, type Result } from '../../shared/result';

/** MapLibre·GeoJSON 이 쓰는 `[경도, 위도]` 순서. 지도 SDK 경계에서만 사용한다. */
export type LngLatTuple = readonly [lng: number, lat: number];

const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;

export class LngLat {
  readonly lng: number;
  readonly lat: number;

  private constructor(lng: number, lat: number) {
    this.lng = lng;
    this.lat = lat;
  }

  /** 검증된 생성. 외부 입력(검색 결과, 저장된 값)은 반드시 이 경로로 들어온다. */
  static create(lng: number, lat: number): Result<LngLat, GeoError> {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return err(
        new GeoError('geo/invalid-coordinate', '좌표가 유한한 수가 아닙니다.', {
          context: { lng: String(lng), lat: String(lat) },
        }),
      );
    }
    if (Math.abs(lat) > MAX_LATITUDE) {
      return err(
        new GeoError('geo/invalid-coordinate', `위도는 ±${MAX_LATITUDE} 를 넘을 수 없습니다.`, {
          context: { lat },
        }),
      );
    }
    if (Math.abs(lng) > MAX_LONGITUDE) {
      return err(
        new GeoError('geo/invalid-coordinate', `경도는 ±${MAX_LONGITUDE} 를 넘을 수 없습니다.`, {
          context: { lng },
        }),
      );
    }
    return ok(new LngLat(lng, lat));
  }

  /**
   * 코드에 박힌 리터럴용. 잘못된 값은 복구 대상이 아니라 버그이므로 던진다.
   * (Result 규약: 호출자가 손쓸 수 없는 실패는 throw)
   */
  static of(lng: number, lat: number): LngLat {
    const result = LngLat.create(lng, lat);
    if (!result.ok) throw result.error;
    return result.value;
  }

  static fromTuple(tuple: LngLatTuple): Result<LngLat, GeoError> {
    return LngLat.create(tuple[0], tuple[1]);
  }

  toTuple(): LngLatTuple {
    return [this.lng, this.lat];
  }

  equals(other: LngLat): boolean {
    return this.lng === other.lng && this.lat === other.lat;
  }

  toString(): string {
    return `${this.lng.toFixed(6)},${this.lat.toFixed(6)}`;
  }
}
