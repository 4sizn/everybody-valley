/**
 * 제보 폼(F5b)의 순수 로직 — react-native 를 import 하지 않는다(vitest 가 RN 목 없이 검증).
 *
 * 검증 규칙은 core `validateReportDraft` 를 그대로 쓴다 — 여기서 다시 쓰지 않는다(작업 지시
 * "검증 규칙을 앱에 다시 쓰지 마라"). 이 파일이 하는 일은 폼 상태 ↔ core 입력·전송 페이로드
 * 사이의 변환과, core 가 모르는 두 가지(사진 선택 시점의 즉석 거절, 서버 실패의 종류 판정)뿐이다.
 */
import {
  type ApiReportDraft,
  type LngLat,
  lookupSegment,
  REPORT_MAX_PHOTOS,
  REPORT_PHOTO_MAX_BYTES,
  type ReportFieldError,
  type ReportType,
  segmentPositionLabel,
  toSegmentId,
  type Valley,
  validateReportDraft,
} from '@modu-valley/core';

/** 선택된 사진 한 장 — 플랫폼 선택기(`platform/reportPhotoPicker`)가 채운다. */
export type ReportFormPhoto = {
  readonly id: string;
  readonly filename: string;
  readonly contentType: string;
  readonly bytes: number;
  readonly data: Uint8Array;
  /** 썸네일 미리보기. web 은 object URL — 없으면 썸네일 자리에 파일명만 보인다. */
  readonly previewUri?: string;
};

export type ReportFormState = {
  readonly valleyId: string;
  readonly segmentId?: string;
  readonly type: ReportType | null;
  readonly body: string;
  readonly nickname: string;
  readonly password: string;
  readonly photos: readonly ReportFormPhoto[];
  /**
   * 지도에서 고른 지점(F5d) — **선택 사항**(해석 1). 없으면 계곡·구간만으로 제보된다 —
   * 급한 제보(긴급 신고·미아찾기)에서 좌표 선택을 강제하지 않는다.
   */
  readonly lat?: number;
  readonly lng?: number;
};

/**
 * 위치 피커의 기본 중심(해석 3) — **보고 있던 구간, 없으면 계곡**. 단말 위치는 읽지 않는다
 * — `CLAUDE.md` "개인위치정보는 기기를 떠나지 않는다" 규칙 때문에 피커에 "내 위치로" 버튼을
 * 두지 않는다(내 위치를 기본값으로 넣으면 사용자가 그대로 제출해 서버에 저장될 수 있다).
 * 계곡·구간을 찾지 못하면(데이터가 아직 없을 때) `null`.
 */
export function reportLocationDefaultCenter(
  valleys: readonly Valley[],
  valleyId: string,
  segmentId: string | undefined,
): LngLat | null {
  if (segmentId !== undefined) {
    const found = lookupSegment(valleys, toSegmentId(segmentId));
    if (found.ok) return found.value.segment.midpoint();
  }
  const valley = valleys.find((v) => v.id === valleyId);
  return valley === undefined ? null : valley.center();
}

/** 피커에서 고른 지점을 상태에 반영한다. `point` 가 `null` 이면 지운다(지우기 가능, F5d). */
export function withReportLocation(state: ReportFormState, point: LngLat | null): ReportFormState {
  if (point === null) {
    const { lat: _lat, lng: _lng, ...rest } = state;
    return rest;
  }
  return { ...state, lat: point.lat, lng: point.lng };
}

/**
 * 피커 아래 "계곡·구간 라벨"(승인된 목업) — "조무락골 중류" 형식. 상세 면 복사 문자열
 * 첫 줄(`reportCoordinateCopyText`)과 같은 조립이라 사용자가 둘을 같은 규칙으로 읽는다.
 * 계곡을 찾지 못하면(드문 경우) `null`.
 */
export function reportLocationContextLabel(
  valleys: readonly Valley[],
  valleyId: string,
  segmentId: string | undefined,
): string | null {
  const valley = valleys.find((v) => v.id === valleyId);
  if (valley === undefined) return null;
  if (segmentId === undefined) return valley.name;
  const found = lookupSegment(valleys, toSegmentId(segmentId));
  if (!found.ok) return valley.name;
  return `${valley.name} ${segmentPositionLabel(found.value.segment.position)}`;
}

/** 새 폼을 연 시점의 상태 — 계곡(+구간) 컨텍스트만 정해져 있고 나머지는 비어 있다. */
export function createInitialReportFormState(
  valleyId: string,
  segmentId?: string,
): ReportFormState {
  return {
    valleyId,
    ...(segmentId ? { segmentId } : {}),
    type: null,
    body: '',
    nickname: '',
    password: '',
    photos: [],
  };
}

/**
 * 폼 상태를 core 검증 입력으로 옮겨 그대로 위임한다. `type` 이 아직 선택 전(`null`)이면
 * core 가 이해하는 빈 문자열로 — "유형을 고르지 않았다"도 core 기준 무효 유형이라 같은
 * 오류 경로를 탄다.
 */
export function reportFormFieldErrors(state: ReportFormState): readonly ReportFieldError[] {
  return validateReportDraft({
    type: state.type ?? '',
    body: state.body,
    nickname: state.nickname,
    password: state.password,
    photoCount: state.photos.length,
  });
}

export function isReportFormValid(state: ReportFormState): boolean {
  return reportFormFieldErrors(state).length === 0;
}

/** 유효한 상태에서만 부른다(호출부가 `isReportFormValid` 로 먼저 확인). */
export function buildReportDraft(state: ReportFormState): ApiReportDraft {
  if (state.type === null) {
    throw new Error('reportFormFieldErrors 를 먼저 확인하세요 — type 이 없습니다.');
  }
  return {
    valleyId: state.valleyId,
    ...(state.segmentId ? { segmentId: state.segmentId } : {}),
    type: state.type,
    body: state.body.trim(),
    nickname: state.nickname.trim(),
    password: state.password,
    ...(state.lat !== undefined && state.lng !== undefined
      ? { lat: state.lat, lng: state.lng }
      : {}),
    ...(state.photos.length > 0
      ? {
          photos: state.photos.map((photo) => ({
            data: photo.data,
            filename: photo.filename,
            contentType: photo.contentType,
          })),
        }
      : {}),
  };
}

export type PhotoRejectionReason = 'too-many' | 'too-large';

/**
 * 사진 선택 시점의 즉석 거절 — 전송 전에 폼에서 막고 이유를 보여준다(작업 지시). core 의
 * `isValidReportPhotoCount`/`isValidReportPhotoBytes` 경계값을 그대로 쓰되, "이미 고른 것 +
 * 지금 고른 것"이 넘는지를 선택 시점에 판정한다는 점이 core 의 사후 검증과 다르다.
 */
export function rejectReportPhoto(
  currentCount: number,
  candidateBytes: number,
): PhotoRejectionReason | null {
  if (currentCount + 1 > REPORT_MAX_PHOTOS) return 'too-many';
  if (candidateBytes > REPORT_PHOTO_MAX_BYTES) return 'too-large';
  return null;
}

export type ReportSubmitErrorKind = 'rate-limited' | 'network' | 'server';

/**
 * 서버 실패를 사용자에게 보일 세 종류로 좁힌다(작업 지시 "성공·실패·429 를 각각 보여준다").
 * `context` 는 `RepositoryError.context` — `status` 0 은 네트워크 예외, 429 는 레이트리밋,
 * 그 밖은 서버 오류로 뭉뚱그린다(F5b 는 필드별 재현보다 "다시 시도" 안내가 우선).
 */
export function classifyReportSubmitError(
  context: Readonly<Record<string, string | number | boolean | null>>,
): ReportSubmitErrorKind {
  const status = context['status'];
  if (status === 429) return 'rate-limited';
  if (status === 0) return 'network';
  return 'server';
}

/** 429 응답의 `retryAfterSec` — 없으면 `null`(문구가 그때는 초를 말하지 않는다). */
export function retryAfterSecondsOf(
  context: Readonly<Record<string, string | number | boolean | null>>,
): number | null {
  const value = context['retryAfterSec'];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
