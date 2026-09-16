/**
 * 제보 사진 선택 — web/native 갈림(F5b). 실제 구현은 `reportPhotoPicker.web.ts` 와
 * `reportPhotoPicker.native.ts` 두 개이고, Metro 가 빌드 대상에 맞는 쪽을 고른다.
 * `mapPlatform.d.ts` 와 같은 패턴 — 공유 코드(`ReportFormModal`)가 볼 표면을 여기서 정의한다.
 */

/** 선택된 사진 한 장. 서버 전송(core `ApiReportPhotoInput`)과 같은 바이트 모양이라 그대로 옮겨 쓸 수 있다. */
export type PickedReportPhoto = {
  readonly id: string;
  readonly filename: string;
  readonly contentType: string;
  readonly bytes: number;
  readonly data: Uint8Array;
  /** 썸네일 미리보기 — web 은 object URL. 네이티브 구현이 준비되기 전에는 없다. */
  readonly previewUri?: string;
};

/** 이 런타임이 사진 선택을 지원하는가. 폼은 이 값이 거짓이면 추가 타일 대신 안내를 보여준다. */
export declare const REPORT_PHOTO_PICKER_SUPPORTED: boolean;

/**
 * 사진 선택 UI 를 띄운다. `maxCount` 는 지금 더 고를 수 있는 장수(이미 고른 것을 뺀 나머지) —
 * 그보다 많이 고르면 앞에서부터 `maxCount` 장만 취한다. 사용자가 취소하면 빈 배열.
 */
export declare function pickReportPhotos(options: {
  readonly maxCount: number;
}): Promise<readonly PickedReportPhoto[]>;
