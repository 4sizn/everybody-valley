/**
 * 축제 애그리게이트 — 화면이 다루는 데이터의 루트.
 *
 * 명당 조회를 여기로 모아 두면, 표현 계층이 배열을 직접 인덱싱하지 않는다.
 */

import { FestivalError } from '../../shared/errors';
import { err, ok, type Result } from '../../shared/result';
import type { LngLat } from '../geo/LngLat';
import type { Program } from './Program';
import type { Spot } from './Spot';
import type { SpotId } from './SpotId';

export type FestivalProps = {
  readonly title: string;
  /** 발사 지점 — 카메라 기준점이자 모든 거리 계산의 원점. */
  readonly launchSite: LngLat;
  readonly programs: readonly Program[];
  readonly spots: readonly Spot[];
};

export class Festival {
  readonly title: string;
  readonly launchSite: LngLat;
  readonly programs: readonly Program[];
  readonly spots: readonly Spot[];

  readonly #spotsById: ReadonlyMap<SpotId, Spot>;

  constructor(props: FestivalProps) {
    this.title = props.title;
    this.launchSite = props.launchSite;
    this.programs = props.programs;
    this.spots = props.spots;
    this.#spotsById = new Map(props.spots.map((spot) => [spot.id, spot]));
  }

  findSpot(id: SpotId): Result<Spot, FestivalError> {
    const spot = this.#spotsById.get(id);
    if (spot === undefined) {
      return err(
        new FestivalError('festival/spot-not-found', '해당 명당을 찾을 수 없습니다.', {
          context: { spotId: id },
        }),
      );
    }
    return ok(spot);
  }

  /** 순회 비행용 — 현재 명당 다음 순서. 마지막이면 처음으로 돌아간다. */
  spotAfter(id: SpotId | null): Spot | undefined {
    if (this.spots.length === 0) return undefined;
    if (id === null) return this.spots[0];
    const index = this.spots.findIndex((spot) => spot.id === id);
    return this.spots[(index + 1) % this.spots.length];
  }
}
