/**
 * `/` — 네이티브 셸. 화면은 서버가 주는 웹 앱(`ValleyApp`)을 WebView 로 띄운다.
 *
 * 계곡 화면의 기능은 웹에서 먼저 자란다(README "현재 출시 검증 대상: 모바일/데스크톱 웹").
 * 네이티브 원본 화면(`components/shell/MapScreen`)은 지우지 않고 그대로 두었다 — 이 파일에서
 * 다시 불러오면 예전 화면으로 돌아간다.
 *
 * 주소는 서버 주소와 같다. 서버가 `/api` 와 웹을 같은 출처에서 서빙한다(`docs/PRODUCTION.md`).
 */
import { WebShell } from '@/components/shell/WebShell';

export default function ValleyScreen() {
  return <WebShell />;
}
