/**
 * 제보 폼 순수 로직 테스트(F5b) — 경계값(본문 500자·닉네임 20자·비밀번호 4자·사진 4장·6MB),
 * 429 판정, 전송 페이로드 형태를 고정한다.
 */
import {
  LngLat,
  REPORT_BODY_MAX_LENGTH,
  REPORT_MAX_PHOTOS,
  REPORT_NICKNAME_MAX_LENGTH,
  REPORT_PASSWORD_MIN_LENGTH,
  REPORT_PHOTO_MAX_BYTES,
  Segment,
  toSegmentId,
  toValleyId,
  Valley,
} from '@modu-valley/core';
import { describe, expect, it } from 'vitest';
import {
  buildReportDraft,
  classifyReportSubmitError,
  createInitialReportFormState,
  isReportFormValid,
  type ReportFormPhoto,
  type ReportFormState,
  rejectReportPhoto,
  reportFormFieldErrors,
  reportLocationContextLabel,
  reportLocationDefaultCenter,
  retryAfterSecondsOf,
  withReportLocation,
} from '../src/components/valley/report/reportFormLogic';

const VALID: ReportFormState = {
  valleyId: 'baegun',
  type: 'trash',
  body: '쓰레기가 많아요',
  nickname: '산꾼',
  password: '1234',
  photos: [],
};

function photo(bytes: number, id = 'p'): ReportFormPhoto {
  return { id, filename: `${id}.jpg`, contentType: 'image/jpeg', bytes, data: new Uint8Array(1) };
}

describe('createInitialReportFormState', () => {
  it('계곡만 정해지고 나머지는 비어 있다', () => {
    const state = createInitialReportFormState('baegun');
    expect(state).toEqual({
      valleyId: 'baegun',
      type: null,
      body: '',
      nickname: '',
      password: '',
      photos: [],
    });
  });

  it('구간이 있으면 함께 담는다', () => {
    expect(createInitialReportFormState('baegun', 's1').segmentId).toBe('s1');
  });
});

describe('reportFormFieldErrors — 경계값(core validateReportDraft 위임)', () => {
  it('유효한 폼은 오류가 없다', () => {
    expect(reportFormFieldErrors(VALID)).toEqual([]);
    expect(isReportFormValid(VALID)).toBe(true);
  });

  it('유형을 고르지 않으면(null) type 오류', () => {
    const errors = reportFormFieldErrors({ ...VALID, type: null });
    expect(errors.map((e) => e.field)).toEqual(['type']);
  });

  it(`본문 ${REPORT_BODY_MAX_LENGTH}자는 통과, ${REPORT_BODY_MAX_LENGTH + 1}자는 거부`, () => {
    expect(reportFormFieldErrors({ ...VALID, body: 'a'.repeat(REPORT_BODY_MAX_LENGTH) })).toEqual(
      [],
    );
    expect(
      reportFormFieldErrors({ ...VALID, body: 'a'.repeat(REPORT_BODY_MAX_LENGTH + 1) }).map(
        (e) => e.field,
      ),
    ).toEqual(['body']);
  });

  it(`닉네임 ${REPORT_NICKNAME_MAX_LENGTH}자는 통과, ${REPORT_NICKNAME_MAX_LENGTH + 1}자는 거부`, () => {
    expect(
      reportFormFieldErrors({ ...VALID, nickname: '가'.repeat(REPORT_NICKNAME_MAX_LENGTH) }),
    ).toEqual([]);
    expect(
      reportFormFieldErrors({
        ...VALID,
        nickname: '가'.repeat(REPORT_NICKNAME_MAX_LENGTH + 1),
      }).map((e) => e.field),
    ).toEqual(['nickname']);
  });

  it(`비밀번호 ${REPORT_PASSWORD_MIN_LENGTH}자는 통과, ${REPORT_PASSWORD_MIN_LENGTH - 1}자는 거부`, () => {
    expect(
      reportFormFieldErrors({ ...VALID, password: 'a'.repeat(REPORT_PASSWORD_MIN_LENGTH) }),
    ).toEqual([]);
    expect(
      reportFormFieldErrors({
        ...VALID,
        password: 'a'.repeat(REPORT_PASSWORD_MIN_LENGTH - 1),
      }).map((e) => e.field),
    ).toEqual(['password']);
  });

  it(`사진 ${REPORT_MAX_PHOTOS}장은 통과, ${REPORT_MAX_PHOTOS + 1}장은 거부`, () => {
    const maxPhotos = Array.from({ length: REPORT_MAX_PHOTOS }, (_, i) => photo(1000, `p${i}`));
    expect(reportFormFieldErrors({ ...VALID, photos: maxPhotos })).toEqual([]);
    const tooMany = [...maxPhotos, photo(1000, 'extra')];
    expect(reportFormFieldErrors({ ...VALID, photos: tooMany }).map((e) => e.field)).toEqual([
      'photoCount',
    ]);
  });
});

describe('rejectReportPhoto — 선택 시점 즉석 거절', () => {
  it('3장째까지는 통과, 4장째는 too-many', () => {
    expect(rejectReportPhoto(REPORT_MAX_PHOTOS - 1, 1000)).toBeNull();
    expect(rejectReportPhoto(REPORT_MAX_PHOTOS, 1000)).toBe('too-many');
  });

  it(`${REPORT_PHOTO_MAX_BYTES}바이트(5MB)는 통과, 6MB 는 too-large`, () => {
    expect(rejectReportPhoto(0, REPORT_PHOTO_MAX_BYTES)).toBeNull();
    expect(rejectReportPhoto(0, 6 * 1024 * 1024)).toBe('too-large');
  });
});

describe('buildReportDraft — 전송 페이로드 형태', () => {
  it('segmentId·photos 가 없으면 필드 자체를 뺀다', () => {
    const draft = buildReportDraft(VALID);
    expect(draft).toEqual({
      valleyId: 'baegun',
      type: 'trash',
      body: '쓰레기가 많아요',
      nickname: '산꾼',
      password: '1234',
    });
    expect(draft).not.toHaveProperty('segmentId');
    expect(draft).not.toHaveProperty('photos');
  });

  it('segmentId·사진이 있으면 함께 싣는다(사진은 core ApiReportPhotoInput 모양)', () => {
    const draft = buildReportDraft({
      ...VALID,
      segmentId: 's1',
      photos: [photo(1234, 'p0')],
    });
    expect(draft.segmentId).toBe('s1');
    expect(draft.photos).toEqual([
      { data: expect.any(Uint8Array), filename: 'p0.jpg', contentType: 'image/jpeg' },
    ]);
  });

  it('본문·닉네임을 트림한다', () => {
    const draft = buildReportDraft({ ...VALID, body: '  공백  ', nickname: '  산꾼  ' });
    expect(draft.body).toBe('공백');
    expect(draft.nickname).toBe('산꾼');
  });

  it('type 이 null 이면 던진다(호출부는 isReportFormValid 로 먼저 걸러야 한다)', () => {
    expect(() => buildReportDraft({ ...VALID, type: null })).toThrow();
  });
});

describe('buildReportDraft — 좌표(F5d)', () => {
  it('좌표가 있으면 함께 싣고, 없으면 필드 자체가 없다', () => {
    const withCoord = buildReportDraft({ ...VALID, lat: 37.983412, lng: 127.460591 });
    expect(withCoord.lat).toBe(37.983412);
    expect(withCoord.lng).toBe(127.460591);

    const withoutCoord = buildReportDraft(VALID);
    expect(withoutCoord).not.toHaveProperty('lat');
    expect(withoutCoord).not.toHaveProperty('lng');
  });
});

describe('withReportLocation — 지도에서 고른 지점 반영·지우기', () => {
  it('점을 넣으면 lat/lng 가 생기고, null 을 넣으면 지운다', () => {
    const withCoord = withReportLocation(VALID, LngLat.of(127.46, 37.98));
    expect(withCoord.lat).toBe(37.98);
    expect(withCoord.lng).toBe(127.46);

    const cleared = withReportLocation(withCoord, null);
    expect(cleared).not.toHaveProperty('lat');
    expect(cleared).not.toHaveProperty('lng');
  });
});

describe('reportLocationDefaultCenter — 피커 기본 중심(해석 3)', () => {
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
  const valley = created.value;

  it('구간이 있으면 그 구간의 중간점', () => {
    const center = reportLocationDefaultCenter([valley], 'baegun', 'baegun-mid');
    expect(center).not.toBeNull();
    expect(center?.lng).toBeCloseTo(0.5 * (127.0 + 127.01), 6);
  });

  it('구간이 없으면 계곡 전체 중심', () => {
    const center = reportLocationDefaultCenter([valley], 'baegun', undefined);
    expect(center).toEqual(valley.center());
  });

  it('계곡을 찾지 못하면 null', () => {
    expect(reportLocationDefaultCenter([valley], 'nope', undefined)).toBeNull();
  });

  it('reportLocationContextLabel — "계곡명 구간" 형식(복사 문자열 첫 줄과 같은 조립)', () => {
    expect(reportLocationContextLabel([valley], 'baegun', 'baegun-mid')).toBe('백운계곡 중류');
    expect(reportLocationContextLabel([valley], 'baegun', undefined)).toBe('백운계곡');
    expect(reportLocationContextLabel([valley], 'nope', undefined)).toBeNull();
  });
});

describe('classifyReportSubmitError / retryAfterSecondsOf', () => {
  it('status 429 는 rate-limited', () => {
    expect(classifyReportSubmitError({ status: 429 })).toBe('rate-limited');
  });

  it('status 0 은 network', () => {
    expect(classifyReportSubmitError({ status: 0 })).toBe('network');
  });

  it('그 밖은 server', () => {
    expect(classifyReportSubmitError({ status: 500 })).toBe('server');
    expect(classifyReportSubmitError({ status: 400 })).toBe('server');
  });

  it('retryAfterSec 이 숫자면 그 값, 없으면 null', () => {
    expect(retryAfterSecondsOf({ status: 429, retryAfterSec: 37 })).toBe(37);
    expect(retryAfterSecondsOf({ status: 429 })).toBeNull();
    expect(retryAfterSecondsOf({ status: 429, retryAfterSec: 'soon' })).toBeNull();
  });
});
