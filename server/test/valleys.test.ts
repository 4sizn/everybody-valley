/**
 * `data/valleys/*.geojson` 에서 읽는 유효 계곡 id·중심선(F5d 좌표 반경 검증의 재료).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadValleyCenterlines, loadValleyIds } from '../src/valleys';

const REAL_VALLEYS_DIR = path.resolve(import.meta.dirname, '../../data/valleys');

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f5d-valleys-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('loadValleyIds', () => {
  it('없는 디렉터리는 빈 집합', () => {
    expect(loadValleyIds(path.join(tmpDir, 'nope')).size).toBe(0);
  });

  it('.geojson 파일 이름(확장자 제외)만 담는다', () => {
    fs.writeFileSync(path.join(tmpDir, 'a.geojson'), '{}');
    fs.writeFileSync(path.join(tmpDir, 'b.geojson'), '{}');
    fs.writeFileSync(path.join(tmpDir, 'readme.md'), '');
    expect(loadValleyIds(tmpDir)).toEqual(new Set(['a', 'b']));
  });
});

describe('loadValleyCenterlines', () => {
  it('첫 Feature 의 LineString 좌표열을 읽는다', () => {
    const geojson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [127.0, 37.0],
              [127.0, 37.01],
            ],
          },
        },
      ],
    };
    fs.writeFileSync(path.join(tmpDir, 'sample.geojson'), JSON.stringify(geojson));
    const centerlines = loadValleyCenterlines(tmpDir);
    const line = centerlines.get('sample');
    expect(line).toHaveLength(2);
    expect(line?.[0]).toMatchObject({ lng: 127.0, lat: 37.0 });
    expect(line?.[1]).toMatchObject({ lng: 127.0, lat: 37.01 });
  });

  it('기하가 없거나 LineString 이 아니거나 JSON 이 깨졌으면 빈 배열 — 그 계곡은 반경 검증이 항상 거부한다', () => {
    fs.writeFileSync(path.join(tmpDir, 'no-features.geojson'), JSON.stringify({ features: [] }));
    fs.writeFileSync(
      path.join(tmpDir, 'point-geometry.geojson'),
      JSON.stringify({
        features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [127.0, 37.0] } }],
      }),
    );
    fs.writeFileSync(path.join(tmpDir, 'broken.geojson'), '{not json');

    const centerlines = loadValleyCenterlines(tmpDir);
    expect(centerlines.get('no-features')).toEqual([]);
    expect(centerlines.get('point-geometry')).toEqual([]);
    expect(centerlines.get('broken')).toEqual([]);
  });

  it('없는 디렉터리는 빈 맵', () => {
    expect(loadValleyCenterlines(path.join(tmpDir, 'nope')).size).toBe(0);
  });

  it('실제 data/valleys 33개 전부 중심선을 읽는다(최소 2점)', () => {
    const ids = loadValleyIds(REAL_VALLEYS_DIR);
    expect(ids.size).toBe(33);
    expect(ids.has('gingorang')).toBe(true);
    // 광주 무등산(2026-09-09) — 수도권 밖 첫 계곡이라 지역 가정이 남아 있으면 여기서 깨진다.
    expect(ids.has('jeungsimsa')).toBe(true);
    expect(ids.has('wonhyo')).toBe(true);
    const centerlines = loadValleyCenterlines(REAL_VALLEYS_DIR);
    for (const id of ids) {
      const line = centerlines.get(id);
      expect(line, `${id} 중심선`).toBeDefined();
      expect(line?.length ?? 0).toBeGreaterThanOrEqual(2);
    }
  });
});
