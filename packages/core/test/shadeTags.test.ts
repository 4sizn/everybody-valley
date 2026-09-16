/**
 * 그늘 태그(N5) 테스트 — 경계값과 SD1 실데이터 30구간의 분포를 고정한다.
 *
 * 분포 스냅샷(많음 8 · 보통 12 · 적음 10)은 `docs/TODO.md` N5 절의 실측과 같다.
 * 다르게 나오면 `shadeTags` 의 계산이 틀렸다는 뜻이다 — 데이터가 바뀌어도 이
 * 값이 바뀌면 안 되는 게 아니라, 지금 이 데이터에서는 이 값이어야 한다.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  SHADE_AMOUNT_MANY_MIN,
  SHADE_AMOUNT_MODERATE_MIN,
  SHADE_LATE_AFTERNOON_SURGE_MIN,
  type ShadeAmount,
  shadeAmountLabel,
  shadeTags,
} from '../src/domain/valley/shadeTags';

const HERE = dirname(fileURLToPath(import.meta.url));
const VALLEYS_DIR = resolve(HERE, '../../../data/valleys');

/** `SHADE_NOON_INDEX`(2) · 마지막 인덱스(8) 자리만 바꾼 9칸 — 나머지는 계산에 안 쓰인다. */
function byHourOf(noon: number, last: number): readonly number[] {
  return [0, 0, noon, 0, 0, 0, 0, 0, last];
}

describe('shadeTags', () => {
  it('shadeByHour 가 없으면 null', () => {
    expect(shadeTags({ shadeByHour: undefined, canopyCover: 0.5 })).toBeNull();
    expect(shadeTags({ shadeByHour: [], canopyCover: undefined })).toBeNull();
  });

  it('종일 평균 경계값 — 0.199 적음 / 0.2 보통 / 0.499 보통 / 0.5 많음', () => {
    // 정오·마지막 값이 같은 평평한 배열로 정확한 평균을 만든다.
    const flat = (value: number): readonly number[] => new Array(9).fill(value);

    expect(shadeTags({ shadeByHour: flat(0.199) })?.amount).toBe<ShadeAmount>('few');
    expect(shadeTags({ shadeByHour: flat(0.2) })?.amount).toBe<ShadeAmount>('moderate');
    expect(shadeTags({ shadeByHour: flat(0.499) })?.amount).toBe<ShadeAmount>('moderate');
    expect(shadeTags({ shadeByHour: flat(0.5) })?.amount).toBe<ShadeAmount>('many');
  });

  it('경계 상수가 문서 값과 같다', () => {
    expect(SHADE_AMOUNT_MODERATE_MIN).toBe(0.2);
    expect(SHADE_AMOUNT_MANY_MIN).toBe(0.5);
    expect(SHADE_LATE_AFTERNOON_SURGE_MIN).toBe(0.2);
  });

  it('늦은 오후 급증 경계값 — 18시 − 정오 0.199 는 false, 0.2 는 true', () => {
    const noon = 0.1;
    expect(shadeTags({ shadeByHour: byHourOf(noon, noon + 0.199) })?.lateAfternoon).toBe(false);
    expect(shadeTags({ shadeByHour: byHourOf(noon, noon + 0.2) })?.lateAfternoon).toBe(true);
  });

  it('shadeAmountLabel 문구 — 결정 (d)', () => {
    expect(shadeAmountLabel('many')).toBe('나무 그늘 많음');
    expect(shadeAmountLabel('moderate')).toBe('나무 그늘 보통');
    expect(shadeAmountLabel('few')).toBe('나무 그늘 적음');
  });

  it('SD1 실데이터 30구간 분포 — 많음 8 · 보통 12 · 적음 10', () => {
    /* SD1(수도권 30) 기준선 — 뒤에 손으로 더한 계곡(긴고랑 SD3, 광주 무등산 SD5)은 뺀다. */
    const addedAfterSd1 = ['gingorang.geojson', 'jeungsimsa.geojson', 'wonhyo.geojson'];
    const files = readdirSync(VALLEYS_DIR).filter(
      (name) => name.endsWith('.geojson') && !addedAfterSd1.includes(name),
    );
    const counts: Record<ShadeAmount, number> = { many: 0, moderate: 0, few: 0 };
    let total = 0;

    for (const file of files) {
      // biome-ignore lint/suspicious/noExplicitAny: 원본 GeoJSON 을 그대로 순회
      const dataset = JSON.parse(readFileSync(resolve(VALLEYS_DIR, file), 'utf8')) as any;
      for (const feature of dataset.features) {
        const tags = shadeTags(feature.properties);
        if (tags === null) continue;
        total += 1;
        counts[tags.amount] += 1;
      }
    }

    expect(total).toBe(30);
    expect(counts).toEqual({ many: 8, moderate: 12, few: 10 });
  });
});
