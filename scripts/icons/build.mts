/**
 * 시설 핀 PNG 빌드 — 네이티브(maplibre-react-native) 몫 (C5 결정 (e) E1).
 *
 *   pnpm icons:build
 *
 * web 은 `map-style` 의 SVG 팩토리를 런타임에 `createImageBitmap` 으로 굽지만, 네이티브 래퍼의
 * `<Images>` 는 브리지 너머라 JS 에서 SVG 를 비트맵으로 바꿔 넘길 수 없다. 그래서 **같은 팩토리**로
 * 빌드 때 PNG 를 구워 `apps/valley-map/assets/icons/` 에 커밋하고 `require()` 로 등록한다 — 한 소스,
 * 두 출력이라 web 과 네이티브의 핀이 같다.
 *
 * 산출물: 9종 × 2상태(기본/선택) × 2배율(@2x·@3x) = 36장. 파일명은 RN 에셋 해상도 규약
 * (`facility-parking@2x.png`, `facility-parking-selected@3x.png`) — Metro 가 기기 배율에 맞는 장을 고른다.
 * 래스터화는 resvg-js(결정적 출력). SVG 문자열이 바뀌면(`facilityIcons.test.ts` 스냅샷) 다시 돌린다.
 */
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  FACILITY_ICON_SPECS,
  type FacilityIconSpec,
  facilityIconSize,
  facilityPinSvg,
} from '@modu-valley/map-style';
import { Resvg } from '@resvg/resvg-js';

/** RN 에셋 배율. `@1x` 는 굽지 않는다 — 현행 기기에 없고 Metro 는 있는 배율 중 가까운 것을 고른다. */
const SCALES = [2, 3] as const;
const OUT_DIR = join(import.meta.dirname, '..', '..', 'apps', 'valley-map', 'assets', 'icons');

/** `facility-parking`, `facility-parking-selected` — `NativeMapView` 의 `require()` 와 같은 이름. */
export function facilityIconFileStem(spec: FacilityIconSpec): string {
  return `facility-${spec.type}${spec.selected ? '-selected' : ''}`;
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  // 이전 산출물을 지워 이름이 바뀐 장이 남지 않게 한다.
  for (const name of await readdir(OUT_DIR)) {
    if (name.startsWith('facility-') && name.endsWith('.png')) await rm(join(OUT_DIR, name));
  }

  let written = 0;
  for (const spec of FACILITY_ICON_SPECS) {
    const svg = facilityPinSvg(spec.type, spec.selected);
    const size = facilityIconSize(spec.selected);
    for (const scale of SCALES) {
      const rendered = new Resvg(svg, {
        fitTo: { mode: 'width', value: size.width * scale },
      }).render();
      const expected = { width: size.width * scale, height: size.height * scale };
      if (rendered.width !== expected.width || rendered.height !== expected.height) {
        throw new Error(
          `${facilityIconFileStem(spec)}@${scale}x: ${rendered.width}×${rendered.height}, 기대 ${expected.width}×${expected.height}`,
        );
      }
      const file = join(OUT_DIR, `${facilityIconFileStem(spec)}@${scale}x.png`);
      await writeFile(file, rendered.asPng());
      written += 1;
    }
  }
  process.stdout.write(`${written}장 → ${OUT_DIR}\n`);
}

await main();
