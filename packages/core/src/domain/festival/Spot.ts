/**
 * 관람 명당 엔티티.
 *
 * 불변이고, 자기 자신에 대한 질문(발사 지점까지의 거리)에 스스로 답한다.
 * 지도 표현(색, 마커)은 도메인 속성으로 남기되 렌더링 방법은 모른다.
 */
import { type Distance, equirectangularDistance } from '../geo/Distance';
import type { LngLat } from '../geo/LngLat';
import type { CrowdLevel } from './CrowdLevel';
import type { SpotId } from './SpotId';
import type { SpotInfoRow } from './SpotInfoRow';

/** 마커·목록 점의 색. `#rrggbb` 만 허용한다. */
export type HexColor = `#${string}`;

export type SpotProps = {
  readonly id: SpotId;
  readonly name: string;
  readonly tag: string;
  readonly color: HexColor;
  readonly position: LngLat;
  readonly description: string;
  readonly crowd: CrowdLevel;
  readonly infoRows: readonly SpotInfoRow[];
};

export class Spot {
  readonly id: SpotId;
  readonly name: string;
  readonly tag: string;
  readonly color: HexColor;
  readonly position: LngLat;
  readonly description: string;
  readonly crowd: CrowdLevel;
  readonly infoRows: readonly SpotInfoRow[];

  constructor(props: SpotProps) {
    this.id = props.id;
    this.name = props.name;
    this.tag = props.tag;
    this.color = props.color;
    this.position = props.position;
    this.description = props.description;
    this.crowd = props.crowd;
    this.infoRows = props.infoRows;
  }

  distanceFrom(origin: LngLat): Distance {
    return equirectangularDistance(origin, this.position);
  }
}
