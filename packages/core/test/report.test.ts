/**
 * 제보 도메인 테스트 — 검증 규칙 경계값과 유형 6종 라벨을 고정한다(F5a).
 */
import { describe, expect, it } from 'vitest';
import {
  isReportType,
  isValidReportBody,
  isValidReportNickname,
  isValidReportPassword,
  isValidReportPhotoBytes,
  isValidReportPhotoCount,
  REPORT_BODY_MAX_LENGTH,
  REPORT_MAX_PHOTOS,
  REPORT_NICKNAME_MAX_LENGTH,
  REPORT_PASSWORD_MIN_LENGTH,
  REPORT_PHOTO_MAX_BYTES,
  REPORT_TYPES,
  Report,
  ReportPhoto,
  reportTypeLabel,
  validateReportDraft,
} from '../src/domain/report/Report';
import { toValleyId } from '../src/domain/valley/ids';

describe('REPORT_TYPES', () => {
  it('6종뿐이고 전부 라벨이 있다', () => {
    expect(REPORT_TYPES).toEqual([
      'illegal-property',
      'trash',
      'emergency',
      'valley-info',
      'missing-person',
      'lost-item',
    ]);
    for (const type of REPORT_TYPES) expect(reportTypeLabel(type).length).toBeGreaterThan(0);
  });

  it('isReportType 은 6종 밖은 거부한다', () => {
    expect(isReportType('trash')).toBe(true);
    expect(isReportType('report')).toBe(false);
    expect(isReportType('')).toBe(false);
  });
});

describe('isValidReportBody', () => {
  it('1~500자(트림 뒤)만 통과한다', () => {
    expect(isValidReportBody('')).toBe(false);
    expect(isValidReportBody('   ')).toBe(false);
    expect(isValidReportBody('a')).toBe(true);
    expect(isValidReportBody('a'.repeat(REPORT_BODY_MAX_LENGTH))).toBe(true);
    expect(isValidReportBody('a'.repeat(REPORT_BODY_MAX_LENGTH + 1))).toBe(false);
  });
});

describe('isValidReportNickname', () => {
  it('1~20자(트림 뒤)만 통과한다', () => {
    expect(isValidReportNickname('')).toBe(false);
    expect(isValidReportNickname('닉')).toBe(true);
    expect(isValidReportNickname('가'.repeat(REPORT_NICKNAME_MAX_LENGTH))).toBe(true);
    expect(isValidReportNickname('가'.repeat(REPORT_NICKNAME_MAX_LENGTH + 1))).toBe(false);
  });
});

describe('isValidReportPassword', () => {
  it(`${REPORT_PASSWORD_MIN_LENGTH}자 미만은 거부한다`, () => {
    expect(isValidReportPassword('a'.repeat(REPORT_PASSWORD_MIN_LENGTH - 1))).toBe(false);
    expect(isValidReportPassword('a'.repeat(REPORT_PASSWORD_MIN_LENGTH))).toBe(true);
  });
});

describe('isValidReportPhotoCount / isValidReportPhotoBytes', () => {
  it(`사진은 0~${REPORT_MAX_PHOTOS}장, 장당 ${REPORT_PHOTO_MAX_BYTES}바이트까지`, () => {
    expect(isValidReportPhotoCount(0)).toBe(true);
    expect(isValidReportPhotoCount(REPORT_MAX_PHOTOS)).toBe(true);
    expect(isValidReportPhotoCount(REPORT_MAX_PHOTOS + 1)).toBe(false);
    expect(isValidReportPhotoCount(-1)).toBe(false);
    expect(isValidReportPhotoCount(1.5)).toBe(false);

    expect(isValidReportPhotoBytes(REPORT_PHOTO_MAX_BYTES)).toBe(true);
    expect(isValidReportPhotoBytes(REPORT_PHOTO_MAX_BYTES + 1)).toBe(false);
    expect(isValidReportPhotoBytes(0)).toBe(false);
  });
});

describe('validateReportDraft', () => {
  const valid = {
    type: 'trash',
    body: '쓰레기가 많아요',
    nickname: '산꾼',
    password: '1234',
    photoCount: 2,
  };

  it('유효한 초안은 빈 배열을 돌려준다', () => {
    expect(validateReportDraft(valid)).toEqual([]);
  });

  it('필드마다 어긋나면 각각 항목이 실린다', () => {
    expect(validateReportDraft({ ...valid, type: 'nope' }).map((e) => e.field)).toEqual(['type']);
    expect(validateReportDraft({ ...valid, body: '' }).map((e) => e.field)).toEqual(['body']);
    expect(validateReportDraft({ ...valid, nickname: '' }).map((e) => e.field)).toEqual([
      'nickname',
    ]);
    expect(validateReportDraft({ ...valid, password: '123' }).map((e) => e.field)).toEqual([
      'password',
    ]);
    expect(validateReportDraft({ ...valid, photoCount: 4 }).map((e) => e.field)).toEqual([
      'photoCount',
    ]);
  });

  it('여러 필드가 어긋나면 전부 모은다', () => {
    const errors = validateReportDraft({
      type: 'nope',
      body: '',
      nickname: '',
      password: '',
      photoCount: 9,
    });
    expect(errors.map((e) => e.field)).toEqual([
      'type',
      'body',
      'nickname',
      'password',
      'photoCount',
    ]);
  });
});

describe('Report', () => {
  it('emergency 유형만 isEmergency 가 참이다', () => {
    const base = {
      id: 'r1',
      valleyId: toValleyId('baegun'),
      body: '조난자가 있어요',
      nickname: '산꾼',
      createdAt: '2026-09-07T00:00:00.000Z',
    };
    expect(new Report({ ...base, type: 'emergency' }).isEmergency).toBe(true);
    expect(new Report({ ...base, type: 'trash' }).isEmergency).toBe(false);
  });

  it('사진이 없으면 빈 배열', () => {
    const report = new Report({
      id: 'r1',
      valleyId: toValleyId('baegun'),
      type: 'valley-info',
      body: '물이 맑아요',
      nickname: '산꾼',
      createdAt: '2026-09-07T00:00:00.000Z',
    });
    expect(report.photos).toEqual([]);
  });

  it('좌표는 선택 사항이다 — 둘 다 있어야 hasCoordinate 가 참(F5d 해석 1)', () => {
    const base = {
      id: 'r1',
      valleyId: toValleyId('baegun'),
      type: 'valley-info' as const,
      body: '물이 맑아요',
      nickname: '산꾼',
      createdAt: '2026-09-07T00:00:00.000Z',
    };
    expect(new Report(base).hasCoordinate).toBe(false);
    expect(new Report({ ...base, lat: 37.98, lng: 127.46 }).hasCoordinate).toBe(true);
    expect(new Report({ ...base, lat: 37.98, lng: 127.46 }).lat).toBe(37.98);
  });

  it('사진 순서·용량을 그대로 보관한다', () => {
    const photo = new ReportPhoto({
      id: 'p1',
      url: '/uploads/p1.jpg',
      width: 1600,
      height: 1200,
      bytes: 1234,
      order: 0,
    });
    expect(photo).toMatchObject({ id: 'p1', width: 1600, order: 0 });
  });
});
