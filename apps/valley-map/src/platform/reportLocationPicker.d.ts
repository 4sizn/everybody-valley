/**
 * 제보 위치 피커(F5d) — web/native 갈림. `mapPlatform.d.ts`·`reportPhotoPicker.d.ts` 와 같은
 * 패턴 — 공유 코드(`ReportFormModal`)가 볼 표면을 여기서 정의하고, 실제 구현은
 * `reportLocationPicker.web.tsx`/`reportLocationPicker.native.tsx` 두 개다.
 *
 * 십자선 고정 + 지도 이동(승인된 목업, 결정 2) — 탭으로 찍지 않는다. 사용자가 지도를 끌면
 * 십자선 아래 지점이 바뀌고, 그때마다 `onChange` 로 알린다(드래그 중에도 실시간).
 */
import type { LngLat } from '@modu-valley/core';

/** 이 런타임이 인라인 지도 피커를 지원하는가. 거짓이면 폼이 지도 대신 안내 문구를 보여준다. */
export declare const REPORT_LOCATION_PICKER_SUPPORTED: boolean;

export type ReportLocationPickerProps = {
  /**
   * 최초 중심 — 보고 있던 구간, 없으면 계곡(해석 3, `reportLocationDefaultCenter`).
   * 단말 위치를 읽지 않는다(`CLAUDE.md` 개인위치정보 규칙 — "내 위치로" 버튼이 없다).
   */
  readonly initialCenter: LngLat;
  /** 십자선 아래 지점이 바뀔 때마다(드래그 중에도) 알린다. */
  readonly onChange: (point: LngLat) => void;
  /**
   * 지정할 수 있는 영역의 기준 — 그 계곡 중심선(F5d 반경 3km). 주면 그 밖으로 끌었을 때
   * 지도가 허용 영역 안으로 되돌아온다. 없으면 되돌리지 않는다.
   */
  readonly limit?: readonly LngLat[];
};

export declare function ReportLocationPicker(props: ReportLocationPickerProps): JSX.Element;
