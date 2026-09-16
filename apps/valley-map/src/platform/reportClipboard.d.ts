/**
 * 제보 좌표 복사(F5d, 해석 5) — web/native 갈림. `reportPhotoPicker.d.ts` 와 같은 능력
 * 매트릭스 패턴 — 실제 구현은 `reportClipboard.web.ts`/`reportClipboard.native.ts` 두 개다.
 */

/** 이 런타임이 클립보드 복사를 지원하는가. 거짓이면 상세 면이 복사 버튼을 감춘다. */
export declare const REPORT_CLIPBOARD_SUPPORTED: boolean;

/** 성공하면 `true`. */
export declare function copyReportCoordinate(text: string): Promise<boolean>;
