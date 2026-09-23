/**
 * 계곡 주변 봉우리 시딩 — OSM `natural=peak`(이름 있는 것) → `data/peaks/<valleyId>.geojson`.
 *
 * 왜(2026-09-23): 베이스맵 타일의 봉우리 라벨은 3D 지형 + 타일 최대 줌 초과(z ≥ 14)에서 MapLibre 가
 * 그리지 않아 계곡 화면(줌 14.2·15.5)에 산 이름이 늘 비었다. 자체 GeoJSON 소스(`peaks-bundle.json`,
 * core `Peak`)로 그린다. 사용자 요청 "계곡 주변의 산이름 정보도 맵에 표기 — 매봉산(678.8m)".
 *
 *   기준   구간 중심선에서 `PEAK_MAX_FROM_LINE_M`(3 km) 안. 표고는 OSM `ele`(숫자로 풀리는 것만).
 *   출처   OSM(ODbL) — `metadata.sources` 에 출처표시. 좌표는 OSM 노드 그대로(소수 6자리).
 *
 *   pnpm seed:peaks                       # 전체, Overpass 캐시 재사용
 *   pnpm seed:peaks --valley myeongji
 */
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, loadKeys, todayKst } from './env.mts';
import { dumpsFile } from './format.mts';
import { type Position, projectOnLine, round6 } from './geo.mts';
import { log, warn } from './log.mts';
import { fetchPeaks, OSM_ATTRIBUTION } from './overpass.mts';
import { loadSeedValleys, valleyFilterFromArgv } from './valleys.mts';

export const PEAKS_DIR = path.join(DATA_DIR, 'peaks');
/** 봉우리가 "이 계곡의 산"인 최대 거리 — 중심선에서(m). 골짜기 양쪽 능선(1~2 km)과 그 너머 주봉까지. */
export const PEAK_MAX_FROM_LINE_M = 3000;

function elevationOf(tags: Readonly<Record<string, string>>): number | undefined {
  const raw = tags['ele'];
  if (raw === undefined) return undefined;
  const parsed = Number(raw.replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 10) / 10 : undefined;
}

async function main(): Promise<void> {
  const keys = loadKeys();
  const only = valleyFilterFromArgv(process.argv.slice(2));
  const valleys = loadSeedValleys(only);
  fs.mkdirSync(PEAKS_DIR, { recursive: true });
  const today = todayKst();
  let total = 0;
  const failed: string[] = [];
  for (const valley of valleys) {
    const file = path.join(DATA_DIR, 'valleys', `${valley.id}.geojson`);
    if (!fs.existsSync(file)) {
      warn(`${valley.id}: data/valleys 파일이 없다 — 먼저 pnpm seed:build`);
      continue;
    }
    const collection = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      features: { geometry: { coordinates: Position[] } }[];
    };
    const line = collection.features.flatMap((feature) => feature.geometry.coordinates);
    let pois: Awaited<ReturnType<typeof fetchPeaks>>;
    try {
      pois = await fetchPeaks(valley.id, line, PEAK_MAX_FROM_LINE_M, keys);
    } catch (error) {
      // Overpass 미러가 자주 504 를 낸다 — 한 계곡 실패로 전체를 멈추지 않고 건너뛴다(다시 돌리면 캐시된 것은 즉시).
      failed.push(valley.id);
      warn(`${valley.id}: Overpass 실패 — ${(error as Error).message.slice(0, 80)}`);
      continue;
    }
    const features = pois
      .map((poi) => ({ poi, distance: projectOnLine(line, poi.position).distance }))
      .filter(({ distance }) => distance <= PEAK_MAX_FROM_LINE_M)
      .sort((a, b) => a.distance - b.distance)
      .map(({ poi, distance }) => {
        const elevationM = elevationOf(poi.tags);
        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [round6(poi.position[0]), round6(poi.position[1])],
          },
          properties: {
            valleyId: valley.id,
            name: poi.tags['name'],
            ...(elevationM === undefined ? {} : { elevationM }),
            distanceM: Math.round(distance),
            osmId: `node/${poi.id}`,
          },
        };
      });
    const out = {
      type: 'FeatureCollection',
      metadata: {
        description: `${valley.name} 주변 봉우리 ${features.length}개 — 중심선 ${PEAK_MAX_FROM_LINE_M / 1000} km 안, 이름 있는 OSM natural=peak`,
        source: 'OSM natural=peak (ODbL) — 이름·표고(ele) 그대로, 데스크 검수',
        sourceFile: 'scripts/seed/peaks.mts (pnpm seed:peaks)',
        datasetVersion: `${today}.0`,
        collectedAt: today,
        coordinateOrder: '[longitude, latitude]',
        crs: 'EPSG:4326',
        sources: [OSM_ATTRIBUTION],
      },
      features,
    };
    fs.writeFileSync(path.join(PEAKS_DIR, `${valley.id}.geojson`), dumpsFile(out));
    total += features.length;
    log(
      `${valley.id.padEnd(18)} 봉우리 ${String(features.length).padStart(2)} · ${features
        .slice(0, 3)
        .map(
          (f) =>
            `${f.properties.name}${f.properties.elevationM ? ` ${f.properties.elevationM}m` : ''}`,
        )
        .join(' · ')}`,
    );
  }
  log(
    `계곡 ${valleys.length - failed.length}/${valleys.length}개 · 봉우리 ${total}개 → ${PEAKS_DIR}${failed.length ? ` · 실패 ${failed.join(',')} (다시 실행)` : ''}`,
  );
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  warn((error as Error).message);
  process.exitCode = 1;
});
