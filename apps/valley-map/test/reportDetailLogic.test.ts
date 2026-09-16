/**
 * 제보 상세 순수 로직 테스트(F5c) — 신고하기(결정 (h)) 는 접수만 하고 카드는 그대로 남는다.
 *
 * `reportFlagResultMessage` 는 성공·실패에 따라 토스트 문구를 고르는 것 말고는 아무 일도
 * 하지 않는다(반환 타입이 문자열 하나뿐이다) — 목록·상세를 다시 그리게 할 상태도, 제보를
 * 지우거나 숨길 자리도 없다는 사실이 시그니처 자체로 보장된다.
 */
import { LngLat, Segment, toSegmentId, toValleyId, Valley } from '@modu-valley/core';
import { describe, expect, it } from 'vitest';
import {
  reportCopyResultMessage,
  reportDetailCopyText,
  reportFlagResultMessage,
} from '../src/components/valley/report/reportDetailLogic';
import { REPORT_FEED_COPY } from '../src/theme/copy';

describe('reportFlagResultMessage', () => {
  it('성공이면 접수 문구, 실패면 재시도 문구를 돌려준다', () => {
    expect(reportFlagResultMessage(true)).toBe(REPORT_FEED_COPY.flagSuccess);
    expect(reportFlagResultMessage(false)).toBe(REPORT_FEED_COPY.flagFailed);
  });

  it('반환값은 문자열 하나뿐이다 — 카드를 지우거나 숨길 자리가 이 함수에는 없다', () => {
    expect(typeof reportFlagResultMessage(true)).toBe('string');
    expect(typeof reportFlagResultMessage(false)).toBe('string');
  });
});

describe('reportDetailCopyText — 상세 면 복사 문자열(F5d 해석 5)', () => {
  const segment = new Segment({
    id: toSegmentId('baegun-mid'),
    valleyId: toValleyId('baegun'),
    valleyName: '백운계곡',
    position: 'mid',
    order: 0,
    path: [LngLat.of(127.0, 37.0), LngLat.of(127.01, 37.0)],
  });
  const created = Valley.create({
    id: toValleyId('baegun'),
    name: '백운계곡',
    segments: [segment],
    facilities: [],
  });
  if (!created.ok) throw created.error;
  const valleys = [created.value];

  it('구간이 있으면 "계곡명 구간\\n위도, 경도"', () => {
    expect(reportDetailCopyText(valleys, 'baegun', 'baegun-mid', 37.983412, 127.460591)).toBe(
      '백운계곡 중류\n37.983412, 127.460591',
    );
  });

  it('구간이 없으면(계곡 전체 제보) 첫 줄은 계곡명뿐', () => {
    expect(reportDetailCopyText(valleys, 'baegun', null, 37.983412, 127.460591)).toBe(
      '백운계곡\n37.983412, 127.460591',
    );
  });

  it('계곡을 찾지 못하면 null', () => {
    expect(reportDetailCopyText(valleys, 'nope', null, 37.98, 127.46)).toBeNull();
  });
});

describe('reportCopyResultMessage', () => {
  it('성공·실패 문구를 고른다', () => {
    expect(reportCopyResultMessage(true)).toBe(REPORT_FEED_COPY.copyCoordinateSuccess);
    expect(reportCopyResultMessage(false)).toBe(REPORT_FEED_COPY.copyCoordinateFailed);
  });
});
