/**
 * 웹 앱이 셸에 알려 주는 테마 — 웹의 `<html data-theme>` 를 셸 테마로 옮기는 다리.
 *
 * 웹과 앱은 테마 선택을 각자 저장한다(web localStorage · 앱 AsyncStorage). 셸이 자기 저장값을
 * 따르면 상단 여백 띠·상태바 글자색이 WebView 속 화면과 어긋난다(다크 웹 위에 흰 띠). 그래서
 * 웹이 결정한 값을 그대로 받아 세션 선택으로 밀어 넣는다.
 */
import { THEME_MODES, type ThemeMode } from '@modu-valley/core';

/** WebView 에 주입해 `data-theme` 초깃값과 변경을 `postMessage` 로 올리는 스크립트. */
export const THEME_BRIDGE_SCRIPT = `(function(){
  var send=function(){
    var mode=document.documentElement.getAttribute('data-theme');
    if(mode&&window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:'theme',mode:mode}));
  };
  send();
  new MutationObserver(send).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
})();true;`;

/** 웹이 올린 메시지에서 테마를 읽는다. 테마 메시지가 아니거나 값이 이상하면 null. */
export function parseThemeMessage(data: string): ThemeMode | null {
  try {
    const parsed: unknown = JSON.parse(data);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { type, mode } = parsed as { type?: unknown; mode?: unknown };
    if (type !== 'theme') return null;
    return (THEME_MODES as readonly string[]).includes(String(mode)) ? (mode as ThemeMode) : null;
  } catch {
    return null;
  }
}
