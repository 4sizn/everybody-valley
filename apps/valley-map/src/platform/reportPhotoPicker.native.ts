/**
 * 제보 사진 선택 — 네이티브(android/ios) 자리표시자.
 *
 * RN 은 이미지 선택 UI 를 기본 제공하지 않는다(`expo-image-picker` 같은 라이브러리가 필요) —
 * 이 앱은 아직 그 의존성을 들이지 않았다(네이티브 빌드가 아직 없다, `docs/TODO.md` F5 후속
 * 제안). `REPORT_PHOTO_PICKER_SUPPORTED = false` 로 두면 폼이 추가 타일 대신 안내를 보여준다
 * (`useLayoutFlip.native.ts` 와 같은 자리표시자 패턴 — 결과 화면은 있고 기능만 비어 있다).
 */
import type { PickedReportPhoto } from './reportPhotoPicker';

export const REPORT_PHOTO_PICKER_SUPPORTED = false;

export async function pickReportPhotos(_options: {
  readonly maxCount: number;
}): Promise<readonly PickedReportPhoto[]> {
  return [];
}
