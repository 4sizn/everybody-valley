/** 제보 좌표 복사(F5d) — web 은 브라우저 Clipboard API. */
export const REPORT_CLIPBOARD_SUPPORTED =
  typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function';

export async function copyReportCoordinate(text: string): Promise<boolean> {
  if (!REPORT_CLIPBOARD_SUPPORTED) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
