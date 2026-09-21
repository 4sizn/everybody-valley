/**
 * `data/valleys/*.geojson` 에서 읽는 정적 사실 둘 — 유효한 계곡 id 집합과 계곡별 중심선.
 * 제보(F5a·F5d) 검증에만 쓴다. 디렉터리는 서버 시작 시 한 번 읽는다(30개 파일, 재시작
 * 전까지 고정 — 계곡을 늘리려면 서버를 다시 띄운다).
 */
import fs from 'node:fs';
import path from 'node:path';
import { type LngLat, parseLineString } from '@modu-valley/core';

const VALLEY_FILE_EXT = '.geojson';

function valleyFiles(dir: string): readonly { readonly id: string; readonly file: string }[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(VALLEY_FILE_EXT))
    .map((name) => ({ id: name.slice(0, -VALLEY_FILE_EXT.length), file: path.join(dir, name) }));
}

export function loadValleyIds(dir: string): ReadonlySet<string> {
  return new Set(valleyFiles(dir).map((v) => v.id));
}

/**
 * 계곡 id → 중심선(그 계곡 GeoJSON 의 첫 Feature 의 LineString 좌표열, `[lng,lat]` → `LngLat`).
 * 제보 좌표(F5d)가 그 계곡 반경 3km 안인지 검증하는 재료다(`domain/report/ReportCoordinate`
 * `isWithinReportCoordinateRadius`). 지금 `data/valleys/*.geojson` 은 파일마다 Feature 가
 * 하나뿐이라(SD1 반입 시점 실측) 첫 Feature 만 본다 — 파일이 읽히지 않거나 기하가
 * LineString 이 아니면 그 계곡은 빈 배열(중심선을 모르면 좌표 제보는 항상 반경 밖으로
 * 거절된다 — `isWithinReportCoordinateRadius` 계약).
 */
export function loadValleyCenterlines(dir: string): ReadonlyMap<string, readonly LngLat[]> {
  const centerlines = new Map<string, readonly LngLat[]>();
  for (const { id, file } of valleyFiles(dir)) {
    centerlines.set(id, readCenterline(file));
  }
  return centerlines;
}

function readCenterline(file: string): readonly LngLat[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      readonly features?: readonly { readonly geometry?: unknown }[];
    };
    const geometry = parsed.features?.[0]?.geometry;
    if (geometry === undefined) return [];
    const result = parseLineString(geometry, file);
    return result.ok ? result.value : [];
  } catch {
    return [];
  }
}

/**
 * 계곡 id → 중심선 표고 중앙값(m, `seed:elevation` 이 첫 feature 속성 `elevationM` 으로 쓴다).
 * 없으면 그 계곡은 빠진다 — 단풍 기온 보정은 표고를 모르면 하지 않는다.
 */
export function loadValleyElevations(dir: string): ReadonlyMap<string, number> {
  const out = new Map<string, number>();
  for (const { id, file } of valleyFiles(dir)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as {
        readonly features?: readonly { readonly properties?: { readonly elevationM?: unknown } }[];
      };
      const e = parsed.features?.[0]?.properties?.elevationM;
      if (typeof e === 'number' && Number.isFinite(e)) out.set(id, e);
    } catch {
      // 파일 하나가 깨졌다고 전체를 막지 않는다 — 그 계곡만 보정 없이 간다.
    }
  }
  return out;
}
