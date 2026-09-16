/**
 * 제보 좌표 복사(F5d) — 네이티브는 아직 미지원 자리표시자다. React Native 코어에는 클립보드
 * API 가 없다(0.65+ 에서 빠졌다) — `expo-clipboard` 같은 새 네이티브 모듈이 필요한데, 이
 * 세션에는 네이티브 빌드·실기기 검증 환경이 없어(`reportPhotoPicker.native.ts`·
 * `reportLocationPicker.native.tsx` 와 같은 사정) 배선을 미뤘다. 상세 면은 이 값이 거짓이면
 * 복사 버튼을 감추고 좌표 텍스트만 보여준다.
 */
export const REPORT_CLIPBOARD_SUPPORTED = false;

export async function copyReportCoordinate(_text: string): Promise<boolean> {
  return false;
}
