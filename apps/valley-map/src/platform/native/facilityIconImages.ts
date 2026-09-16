/**
 * 시설 핀 PNG → 아이콘 ID 표 (네이티브, C5 결정 (e)).
 *
 * `scripts/icons/build.mts` 가 `map-style` 의 SVG 팩토리로 구운 40장(10종 × 기본/선택 × @2x/@3x)을
 * `<Images>` 에 등록한다. 키는 심볼 레이어가 부르는 ID(`facilityIconId`) 와 글자 하나 다르지 않다 —
 * web 은 같은 ID 를 런타임 SVG 로 푼다. Metro 의 `require()` 는 정적 문자열만 받으므로 20개를
 * 손으로 적고, `Record<FacilityType, …>` 타입이 10종 누락을 컴파일에서 잡는다. `@2x`/`@3x` 는 RN
 * 에셋 해상도 규약 — 기기 배율에 맞는 장을 Metro 가 고르고, 지도는 그 배율로 28×36dp 에 그린다.
 */
import type { FacilityType } from '@modu-valley/core';
import { facilityIconId } from '@modu-valley/map-style';
import type { ImageRequireSource } from 'react-native';

type IconPair = { readonly base: ImageRequireSource; readonly selected: ImageRequireSource };

const FACILITY_ICON_FILES: Readonly<Record<FacilityType, IconPair>> = {
  parking: {
    base: require('../../../assets/icons/facility-parking.png'),
    selected: require('../../../assets/icons/facility-parking-selected.png'),
  },
  restroom: {
    base: require('../../../assets/icons/facility-restroom.png'),
    selected: require('../../../assets/icons/facility-restroom-selected.png'),
  },
  food: {
    base: require('../../../assets/icons/facility-food.png'),
    selected: require('../../../assets/icons/facility-food-selected.png'),
  },
  cafe: {
    base: require('../../../assets/icons/facility-cafe.png'),
    selected: require('../../../assets/icons/facility-cafe-selected.png'),
  },
  store: {
    base: require('../../../assets/icons/facility-store.png'),
    selected: require('../../../assets/icons/facility-store-selected.png'),
  },
  shelter: {
    base: require('../../../assets/icons/facility-shelter.png'),
    selected: require('../../../assets/icons/facility-shelter-selected.png'),
  },
  station: {
    base: require('../../../assets/icons/facility-station.png'),
    selected: require('../../../assets/icons/facility-station-selected.png'),
  },
  access: {
    base: require('../../../assets/icons/facility-access.png'),
    selected: require('../../../assets/icons/facility-access-selected.png'),
  },
  safety: {
    base: require('../../../assets/icons/facility-safety.png'),
    selected: require('../../../assets/icons/facility-safety-selected.png'),
  },
  etc: {
    base: require('../../../assets/icons/facility-etc.png'),
    selected: require('../../../assets/icons/facility-etc-selected.png'),
  },
};

/** `<Images images>` 에 그대로 넘기는 표 — `facility/<type>` → PNG, `facility/<type>/selected` → PNG. */
export const FACILITY_ICON_IMAGES: Readonly<Record<string, ImageRequireSource>> =
  Object.fromEntries(
    (Object.entries(FACILITY_ICON_FILES) as Array<[FacilityType, IconPair]>).flatMap(
      ([type, files]) => [
        [facilityIconId(type, false), files.base],
        [facilityIconId(type, true), files.selected],
      ],
    ),
  );
