/**
 * 제보 위치 피커(F5d) — 네이티브는 아직 **미지원 자리표시자**다(`reportPhotoPicker.native.ts`
 * 와 같은 능력 매트릭스 패턴 — 플래그 + 안내).
 *
 * 왜 미루나 — 네이티브에서 인라인 피커를 켜려면 메인 지도와 별도인 두 번째
 * `MapSurface`+`NativeMapView` 인스턴스를 모달 안에 새로 띄워야 한다. 이 세션에는 네이티브
 * 실기기·에뮬레이터 검증 환경이 없어(Android SDK 없음·Xcode 툴체인 우회 필요, 별도 기록)
 * 카메라 드라이버 배선을 검증 없이 얹는 위험을 감수하지 않았다. `ReportFormModal` 은 이 값이
 * 거짓이면 지도 대신 안내 문구를 보여준다 — web 은 실제 지도로 동작한다
 * (`reportLocationPicker.web.tsx`).
 */
import type { LngLat } from '@modu-valley/core';

export const REPORT_LOCATION_PICKER_SUPPORTED = false;

export type ReportLocationPickerProps = {
  readonly initialCenter: LngLat;
  readonly onChange: (point: LngLat) => void;
};

export function ReportLocationPicker(_props: ReportLocationPickerProps) {
  return null;
}
