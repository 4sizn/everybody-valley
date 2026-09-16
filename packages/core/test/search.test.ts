/**
 * 검색(SR1) 테스트 — `docs/TODO.md` "SR1" 절 확정 사항의 계약을 고정한다.
 *
 * 합성 fixture 로 정렬·접두사·공백·상한·필터 무시 규칙을 통제된 입력으로 확인하고,
 * SD1 실측 데이터(`filterChips.test.ts` 와 같은 방식으로 적재)로 "긴고랑로" 가 정말
 * 0건인지 — 그리고 "백운"·"주차장" 같은 실제 질의가 무엇을 찾아내는지 — 확인한다.
 *
 * "긴고랑로" 는 광진구 도로명이고, **진짜 계곡 "긴고랑계곡"(아차산·용마산 사이, 서울
 * 광진구/경기 구리시 경계)의 이름을 딴 것**이다 — 무관한 지명이 아니다(`docs/TODO.md`
 * "SD3" 절). SD3 로 그 계곡을 31번째로 실제 추가했다(Terrarium DEM 최소비용경로 —
 * OSM 은 실제 구간에서 934 m 떨어진 184 m 짜리 무관한 하천 조각뿐이었다). 그래도
 * "긴고랑로" 질의는 여전히 결과 0 이 맞다 — 도로명("로")과 계곡명("계곡")은 문자열이
 * 다르니까다. "긴고랑" 은 이제 그 계곡을 실제로 찾아낸다(아래 테스트).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadValleyDataset } from '../src/data/valley/loadValleyDataset';
import { LngLat } from '../src/domain/geo/LngLat';
import { Facility } from '../src/domain/valley/Facility';
import { filterValleys } from '../src/domain/valley/filterChips';
import { toFacilityId, toSegmentId, toValleyId } from '../src/domain/valley/ids';
import { Segment, type SegmentPosition } from '../src/domain/valley/Segment';
import { SEARCH_RESULT_LIMIT, searchCatalog } from '../src/domain/valley/search';
import type { Valley } from '../src/domain/valley/Valley';
import { Valley as ValleyClass } from '../src/domain/valley/Valley';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, '../../../data');

/** `filterChips.test.ts` 와 같은 적재 방식 — `data/valleys` + `data/facilities` 를 합쳐 싣는다. */
function loadSd1Valleys(): readonly Valley[] {
  const merge = (dir: string) => {
    const files = readdirSync(resolve(DATA_DIR, dir)).filter((name) => name.endsWith('.geojson'));
    let metadata: unknown;
    const features: unknown[] = [];
    for (const file of files) {
      // biome-ignore lint/suspicious/noExplicitAny: 원본 GeoJSON 을 그대로 합친다
      const dataset = JSON.parse(readFileSync(resolve(DATA_DIR, dir, file), 'utf8')) as any;
      metadata ??= dataset.metadata;
      features.push(...dataset.features);
    }
    return { type: 'FeatureCollection', metadata, features };
  };

  const dataset = loadValleyDataset(merge('valleys'), merge('facilities'));
  if (!dataset.ok) throw dataset.error;
  return dataset.value.valleys;
}

const sd1 = loadSd1Valleys();

// ── 합성 fixture ──────────────────────────────────────────────
function segment(id: string, valleyId: ReturnType<typeof toValleyId>, valleyName: string): Segment {
  return new Segment({
    id: toSegmentId(id),
    valleyId,
    valleyName,
    position: 'whole' as SegmentPosition,
    order: 0,
    path: [LngLat.of(127.26, 37.83), LngLat.of(127.27, 37.84)],
  });
}

function facility(
  id: string,
  name: string,
  valleyId: ReturnType<typeof toValleyId>,
  type: Facility['facilityType'] = 'parking',
): Facility {
  return new Facility({
    id: toFacilityId(id),
    valleyId,
    name,
    facilityType: type,
    position: LngLat.of(127.27, 37.826),
  });
}

function valleyOf(name: string, id: string, facilities: readonly Facility[] = []): Valley {
  const valleyId = toValleyId(id);
  const created = ValleyClass.create({
    id: valleyId,
    name,
    segments: [segment(`${id}-seg`, valleyId, name)],
    facilities,
  });
  if (!created.ok) throw created.error;
  return created.value;
}

describe('searchCatalog — 합성 fixture', () => {
  it('빈 질의(공백만이어도)는 아무것도 찾지 않는다 — 검색 모드 아님', () => {
    const valleys = [valleyOf('백운계곡', 'baegun')];
    expect(searchCatalog(valleys, '')).toEqual([]);
    expect(searchCatalog(valleys, '   ')).toEqual([]);
  });

  it('계곡명 부분일치', () => {
    const valleys = [valleyOf('백운계곡', 'baegun'), valleyOf('명지계곡', 'myeongji')];
    const results = searchCatalog(valleys, '운계');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ kind: 'valley', valley: { name: '백운계곡' } });
  });

  it('시설명 부분일치', () => {
    const valleys = [
      valleyOf('백운계곡', 'baegun', [facility('p1', '백운 제1주차장', toValleyId('baegun'))]),
    ];
    const results = searchCatalog(valleys, '제1주차');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      kind: 'facility',
      facility: { name: '백운 제1주차장' },
      valley: { name: '백운계곡' },
    });
  });

  it('둘 다 매치되면 계곡 그룹이 시설 그룹보다 위(결정 3)', () => {
    // "청" 이 계곡명("청계계곡")과 다른 계곡의 시설명("청계 매점") 둘 다에 걸리게 짠다.
    const valleys = [
      valleyOf('청계계곡', 'cheonggye'),
      valleyOf('백운계곡', 'baegun', [facility('s1', '청계 매점', toValleyId('baegun'), 'store')]),
    ];
    const results = searchCatalog(valleys, '청');
    expect(results.map((r) => r.kind)).toEqual(['valley', 'facility']);
  });

  it('접두사 매치가 같은 그룹 안에서 위 — 접두사가 아니면 이름 순', () => {
    const valleys = [
      valleyOf('가나계곡', 'gana'), // "나" 로 시작하지 않음 — 포함만
      valleyOf('나리계곡', 'nari'), // 접두사
      valleyOf('나비계곡', 'nabi'), // 접두사
    ];
    const results = searchCatalog(valleys, '나');
    expect(results.map((r) => (r.kind === 'valley' ? r.valley.name : ''))).toEqual([
      '나리계곡',
      '나비계곡',
      '가나계곡',
    ]);
  });

  it('공백을 지우고 견준다 — 질의·이름 양쪽', () => {
    const valleys = [valleyOf('백 운 계곡', 'baegun')];
    expect(searchCatalog(valleys, '백운')).toHaveLength(1);
    expect(searchCatalog(valleys, '백 운')).toHaveLength(1);
  });

  it(`결과는 ${SEARCH_RESULT_LIMIT}건에서 자른다`, () => {
    const facilities = Array.from({ length: 25 }, (_, i) =>
      facility(`p${i}`, `공통주차장${i}`, toValleyId('baegun')),
    );
    const valleys = [valleyOf('백운계곡', 'baegun', facilities)];
    const results = searchCatalog(valleys, '공통주차장');
    expect(results).toHaveLength(SEARCH_RESULT_LIMIT);
  });

  it('없으면 빈 배열', () => {
    const valleys = [valleyOf('백운계곡', 'baegun')];
    expect(searchCatalog(valleys, '존재하지않는이름')).toEqual([]);
  });

  it('필터 칩이 걸려 있어도 결과가 나온다 — 검색은 필터를 무시한다(결정 6)', () => {
    // 주차장이 없는 계곡 — filterValleys 는 'parking' 칩이 걸리면 이 계곡을 거른다.
    const noParking = valleyOf('그늘계곡', 'neuleup');
    const filtered = filterValleys([noParking], new Set(['parking']));
    expect(filtered.valleys).toHaveLength(0); // 필터는 이 계곡을 뺀다

    const found = searchCatalog([noParking], '그늘'); // 검색은 필터를 모른다 — 그대로 찾는다
    expect(found).toHaveLength(1);
  });
});

describe('searchCatalog — SD1 실측', () => {
  it('"긴고랑로" 는 결과 0 — 도로명이라 계곡명("긴고랑계곡")과 부분일치하지 않는다', () => {
    // SD3(2026-09-08)로 긴고랑계곡을 목록에 추가한 뒤에도 이 질의는 여전히 0건이 맞다 —
    // "긴고랑로" 는 "긴고랑계곡" 의 부분 문자열이 아니다("로" ≠ "계곡"). 아래 테스트가
    // "긴고랑"·"긴고랑계곡" 은 실제로 찾아낸다는 것을 보여 대조한다.
    expect(searchCatalog(sd1, '긴고랑로')).toEqual([]);
  });

  it('"긴고랑" 은 계곡과 공식 화장실을 함께 찾는다', () => {
    const results = searchCatalog(sd1, '긴고랑');
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ kind: 'valley', valley: { name: '긴고랑계곡' } });
    expect(results[1]).toMatchObject({ kind: 'facility', facility: { name: '긴고랑어린이공원' } });
  });

  it('"백운" 은 계곡명 매치를 찾는다', () => {
    const results = searchCatalog(sd1, '백운');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.kind === 'valley' && r.valley.name.includes('백운'))).toBe(true);
  });

  it('"주차장" 은 시설 매치를 찾고, 결과에 계곡명이 함께 실려 있다(결정 4 재료)', () => {
    const results = searchCatalog(sd1, '주차장');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.kind === 'facility')).toBe(true);
    for (const result of results) {
      if (result.kind === 'facility') {
        expect(result.valley.name.length).toBeGreaterThan(0);
        expect(result.facility.name).toContain('주차장');
      }
    }
  });
});
