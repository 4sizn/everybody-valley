/**
 * 그늘 합본 픽스처 — `data/examples/shade/sample/*.geojson`(샘플 계곡의 P1 산출물 사본, 픽스처 전용)을 앱의 `sync-valley-data.mjs` 가
 * 만드는 것과 같은 모양(`{ index, valleys: { sample: { canopy, shadow: { "10": … } } } }`)
 * 으로 조립한다. 매 호출이 새로 파싱하므로 테스트가 마음껏 망가뜨릴 수 있다.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHADE_DIR = resolve(HERE, '../../../../data/examples/shade');

// biome-ignore lint/suspicious/noExplicitAny: 테스트가 임의로 망가뜨릴 JSON 원문
export type LooseJson = any;

function readJson(relativePath: string): LooseJson {
  return JSON.parse(readFileSync(resolve(SHADE_DIR, relativePath), 'utf8'));
}

export const SHADE_FIXTURE_HOURS = ['10', '11', '12', '13', '14', '15', '16', '17', '18'] as const;

export function shadeBundleFixture(valleyId = 'sample'): LooseJson {
  const shadow: Record<string, unknown> = {};
  for (const hour of SHADE_FIXTURE_HOURS) {
    shadow[hour] = readJson(`${valleyId}/shadow-${hour}.geojson`);
  }
  return {
    index: readJson('index.json'),
    valleys: { [valleyId]: { canopy: readJson(`${valleyId}/canopy.geojson`), shadow } },
  };
}
