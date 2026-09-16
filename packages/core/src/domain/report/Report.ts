/**
 * 제보(현장 게시) 도메인 — F5. 계정 없이 **닉네임 + 비밀번호**로 쓴다(계정 도입은 v2,
 * `docs/TODO.md` F5 결정 (a)). 비밀번호는 그 제보의 수정·삭제 인증에만 쓰이고 해시로만
 * 저장된다 — 이 클래스는 평문 비밀번호를 아예 모른다(해시·대조는 서버
 * `server/src/http/routes/reports.ts` 의 일).
 *
 * 유형은 6종뿐이고 대분류가 없다(결정 (b)) — 불법 사유지 · 쓰레기 · 긴급 신고 ·
 * 계곡 새정보 · 미아찾기 · 물건찾기.
 */
import type { SegmentId, ValleyId } from '../valley/ids';

export const REPORT_TYPES = [
  'illegal-property',
  'trash',
  'emergency',
  'valley-info',
  'missing-person',
  'lost-item',
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

const REPORT_TYPE_LABELS: Readonly<Record<ReportType, string>> = {
  'illegal-property': '불법 사유지',
  trash: '쓰레기',
  emergency: '긴급 신고',
  'valley-info': '계곡 새정보',
  'missing-person': '미아찾기',
  'lost-item': '물건찾기',
};

export function reportTypeLabel(type: ReportType): string {
  return REPORT_TYPE_LABELS[type];
}

export function isReportType(value: string): value is ReportType {
  return (REPORT_TYPES as readonly string[]).includes(value);
}

/** 본문 글자 수(공백 트림 뒤). */
export const REPORT_BODY_MIN_LENGTH = 1;
export const REPORT_BODY_MAX_LENGTH = 500;
/** 닉네임 글자 수(공백 트림 뒤). 최소 1 — 빈 문자열은 표시명이 없다는 뜻이 아니라 무효다. */
export const REPORT_NICKNAME_MAX_LENGTH = 20;
/** 비밀번호는 해시 전 원문 기준 최소 길이만 검사한다(상한 없음 — 해시 함수가 감당). */
export const REPORT_PASSWORD_MIN_LENGTH = 4;
export const REPORT_MAX_PHOTOS = 3;
export const REPORT_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
/** 서버가 리사이즈하는 장변 길이(결정 (c)). 원본이 이보다 작으면 확대하지 않는다. */
export const REPORT_PHOTO_MAX_DIMENSION = 1600;

export function isValidReportBody(body: string): boolean {
  const length = body.trim().length;
  return length >= REPORT_BODY_MIN_LENGTH && length <= REPORT_BODY_MAX_LENGTH;
}

export function isValidReportNickname(nickname: string): boolean {
  const length = nickname.trim().length;
  return length >= 1 && length <= REPORT_NICKNAME_MAX_LENGTH;
}

export function isValidReportPassword(password: string): boolean {
  return password.length >= REPORT_PASSWORD_MIN_LENGTH;
}

export function isValidReportPhotoCount(count: number): boolean {
  return Number.isInteger(count) && count >= 0 && count <= REPORT_MAX_PHOTOS;
}

export function isValidReportPhotoBytes(bytes: number): boolean {
  return Number.isFinite(bytes) && bytes > 0 && bytes <= REPORT_PHOTO_MAX_BYTES;
}

export type ReportDraftField = 'type' | 'body' | 'nickname' | 'password' | 'photoCount';

export type ReportDraftInput = {
  readonly type: string;
  readonly body: string;
  readonly nickname: string;
  readonly password: string;
  readonly photoCount: number;
};

export type ReportFieldError = {
  readonly field: ReportDraftField;
  readonly reason: string;
};

/**
 * 제보 초안을 검증한다 — 서버 라우트와 (F5b) 폼이 함께 쓰는 단일 규칙. 문제가 없으면 빈 배열,
 * 있으면 필드마다 하나씩(폼에 그대로 보여 줄 수 있는 순서: 유형 → 본문 → 닉네임 → 비밀번호 → 사진).
 */
export function validateReportDraft(input: ReportDraftInput): readonly ReportFieldError[] {
  const errors: ReportFieldError[] = [];
  if (!isReportType(input.type)) {
    errors.push({ field: 'type', reason: `유형은 ${REPORT_TYPES.join(', ')} 중 하나여야 합니다` });
  }
  if (!isValidReportBody(input.body)) {
    errors.push({
      field: 'body',
      reason: `본문은 ${REPORT_BODY_MIN_LENGTH}~${REPORT_BODY_MAX_LENGTH}자여야 합니다`,
    });
  }
  if (!isValidReportNickname(input.nickname)) {
    errors.push({
      field: 'nickname',
      reason: `닉네임은 1~${REPORT_NICKNAME_MAX_LENGTH}자여야 합니다`,
    });
  }
  if (!isValidReportPassword(input.password)) {
    errors.push({
      field: 'password',
      reason: `비밀번호는 ${REPORT_PASSWORD_MIN_LENGTH}자 이상이어야 합니다`,
    });
  }
  if (!isValidReportPhotoCount(input.photoCount)) {
    errors.push({ field: 'photoCount', reason: `사진은 최대 ${REPORT_MAX_PHOTOS}장까지입니다` });
  }
  return errors;
}

export type ReportPhotoProps = {
  readonly id: string;
  /** 정적 서빙 경로, 예: `/uploads/<id>.jpg`. */
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  /** 표시 순서(0부터). */
  readonly order: number;
};

export class ReportPhoto {
  readonly id: string;
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  readonly order: number;

  constructor(props: ReportPhotoProps) {
    this.id = props.id;
    this.url = props.url;
    this.width = props.width;
    this.height = props.height;
    this.bytes = props.bytes;
    this.order = props.order;
  }
}

export type ReportProps = {
  readonly id: string;
  readonly valleyId: ValleyId;
  /** 구간을 특정하지 않은 제보(계곡 전체)면 없다. */
  readonly segmentId?: SegmentId;
  readonly type: ReportType;
  readonly body: string;
  readonly nickname: string;
  /** ISO 8601. */
  readonly createdAt: string;
  readonly photos?: readonly ReportPhoto[];
  /**
   * 제보 지점(F5d, 해석 1) — **선택 사항**이다. 없으면 계곡·구간만으로 제보된 것이고,
   * 이 값이 없다고 해서 무효가 되지 않는다. 둘 다 있거나 둘 다 없다(서버가 검증,
   * `domain/report/ReportCoordinate.ts`).
   */
  readonly lat?: number;
  readonly lng?: number;
};

export class Report {
  readonly id: string;
  readonly valleyId: ValleyId;
  readonly segmentId: SegmentId | undefined;
  readonly type: ReportType;
  readonly body: string;
  readonly nickname: string;
  readonly createdAt: string;
  readonly photos: readonly ReportPhoto[];
  readonly lat: number | undefined;
  readonly lng: number | undefined;

  constructor(props: ReportProps) {
    this.id = props.id;
    this.valleyId = props.valleyId;
    this.segmentId = props.segmentId;
    this.type = props.type;
    this.body = props.body;
    this.nickname = props.nickname;
    this.createdAt = props.createdAt;
    this.photos = props.photos ?? [];
    this.lat = props.lat;
    this.lng = props.lng;
  }

  /** 긴급 신고 유형인가 — 서버는 특별 취급하지 않지만(결정), 폼·카드는 "119·112 는 직접
   * 전화" 고지를 병기한다(결정 (i)). */
  get isEmergency(): boolean {
    return this.type === 'emergency';
  }

  /** 좌표가 있는 제보인가(F5d) — 상세 면의 좌표 줄은 이 값이 참일 때만 보인다. */
  get hasCoordinate(): boolean {
    return this.lat !== undefined && this.lng !== undefined;
  }
}
