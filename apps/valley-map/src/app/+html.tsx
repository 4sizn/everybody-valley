/**
 * web 문서 셸.
 *
 * 여기 있는 CSS 는 **react-native 스타일로는 표현할 수 없는 것만** 담는다.
 * 레이아웃·색·타이포·반경은 모두 컴포넌트의 StyleSheet 에 있고, 그 덕분에
 * 네이티브로 옮길 때 그대로 따라간다. 아래 목록이 그 경계다.
 *
 *   backdrop-filter        상단바 유리 효과
 *   다층 box-shadow        RN 의 shadow* 는 한 겹만 표현한다
 *   position: sticky       시트 손잡이
 *   ::-webkit-scrollbar    시트 스크롤바 숨김
 *   @keyframes             티커 맥박, 선택 핀 낙하
 *   :hover                 원형 컨트롤·목록 행·CTA·내비
 *   transition             hover·opacity 전환
 *   perspective/preserve-3d  목록 배치 전환의 3D 접힘
 *   filter: drop-shadow    선택 핀 그림자
 *   font-variant-numeric   거리 숫자 정렬
 *   text-shadow            티커 문구
 *   linear-gradient        제보 폼 유형 칩 줄 오른쪽 페이드(F5b, 화면 결정 (b) 완화)
 *
 * 선택자는 컴포넌트가 `dataSet={{ mv: '...' }}` 로 붙인 슬롯 이름을 쓴다.
 * 속성 선택자의 특이도는 클래스와 같으므로, react-native-web 이 런타임에
 * 주입하는 규칙을 덮어써야 하는 곳에서는 `:hover` 를 겹치거나 `!important`
 * 를 명시해 의도를 드러낸다.
 *
 * 색은 이 파일에 리터럴로 두지 않는다. `theme/cssVariables.ts` 가 TS 토큰에서
 * 테마별 `:root` 변수 블록을 만들고, 아래 CSS 는 `var(--mv-…)` 만 참조한다 —
 * 토큰과 CSS 가 두 개의 진실이 되지 않도록. 어느 블록이 적용되는지는
 * `<html data-theme>` 가 정하며, 초기값은 `ThemeProvider` 와 같은 env 에서 온다.
 * 저장된 사용자 선택(C9)이 있으면 `<head>` 의 인라인 스크립트가 첫 페인트 전에 같은
 * 규칙(저장값 → env, `system` 은 `prefers-color-scheme`)으로 덮어 문서 배경이 한 프레임도
 * 다른 팔레트로 그려지지 않는다. RN 트리는 `ThemeProvider` 가 같은 값을 읽어 맞춘다.
 */
import { STORAGE_KEYS } from '@modu-valley/core';
import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';
import { cssVar, themeCssVariableBlocks } from '@/theme/cssVariables';
import { ENV_THEME_MODE } from '@/theme/themeMode';

export default function Root({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="ko" data-theme={ENV_THEME_MODE}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>모두밸리 · 계곡을 더 잘 즐기는 방법</title>
        <meta
          name="description"
          content="계곡의 구간, 시간별 그늘, 주변 시설과 현장 제보를 함께 살펴보세요. 현장 통제와 공식 안내를 우선하세요."
        />
        <link rel="icon" type="image/svg+xml" href="/moduvalley/icons/mountain.svg" />
        {/* 데모와 같은 CDN·같은 버전의 Pretendard */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <ScrollViewStyleReset />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: 저장 키 상수(`STORAGE_KEYS`)만
            끼운 고정 스크립트다. 외부 입력이 없다. */}
        <script dangerouslySetInnerHTML={{ __html: EARLY_THEME_SCRIPT }} />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: 아래 CSS 는 이
            파일의 상수 리터럴과 `theme/tokens.ts` 의 상수만으로 만들어지며 외부
            입력이 섞이지 않는다. expo-router 가 문서 <head> 에 스타일을 넣는
            유일한 방법이기도 하다. */}
        <style dangerouslySetInnerHTML={{ __html: WEB_ONLY_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

/**
 * 첫 페인트 전에 저장된 테마 선택을 `data-theme` 에 반영한다. `ThemeProvider` 의 결정 순서와
 * 같다 — 저장값이 있으면 그것(`system` 은 기기 설정), 없으면 env 초기값 그대로. 실패(프라이빗
 * 모드 등)는 조용히 env 로 남는다 — RN 트리의 `useStoredThemeMode` 가 같은 실패를 경고로 남긴다.
 */
const EARLY_THEME_SCRIPT = `(function(){try{var m=localStorage.getItem(${JSON.stringify(STORAGE_KEYS.themeMode)});if(m==='system'){m=window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}if(m==='light'||m==='dark'){document.documentElement.dataset.theme=m}}catch(e){}})();`;

/** `var(--mv-…)` — 토큰 키를 그대로 써서 오타를 타입이 잡는다. */
const v = cssVar;

const WEB_ONLY_CSS = `
/* ── 테마 변수 — theme/tokens.ts 에서 생성. 색은 여기서만 정해진다. ── */
${themeCssVariableBlocks()}

/* ── 문서 ─────────────────────────────────────────────────────── */
html, body, #root { height: 100%; }
body {
  margin: 0;
  background: ${v('bg')};
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
}
svg { display: block; flex: none; }

/* ── 지도 ─────────────────────────────────────────────────────── */
/* map-root 의 절대 위치는 RN 스타일에 있다. 여기에 두면 안 된다 —
   react-native-web 이 자기 스타일시트를 이 <style> **뒤에** 주입하므로,
   같은 특이도(속성 선택자 = 클래스)에서는 RNW 의 position:relative 가 이긴다.
   높이가 0 이 되어 지도가 그려지지 않는다. */
.maplibregl-ctrl-attrib { font-size: 10px !important; }
.maplibregl-ctrl-bottom-right { margin-bottom: 74px; }

/* 선택 핀 — 낙하 등장과 그림자. adapter-web 이 이 클래스를 붙인다. */
.mv-pin {
  cursor: pointer;
  filter: drop-shadow(${v('pinShadow')});
  animation: mv-drop .42s cubic-bezier(.2,1.5,.4,1);
}
@keyframes mv-drop {
  0%   { transform: translateY(-22px) scale(.5); opacity: 0; }
  100% { transform: none; opacity: 1; }
}

/* ── 상단 검색바 ──────────────────────────────────────────────── */
[data-mv="topbar"] {
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: ${v('shadow')};
}
[data-mv="search-input"] { outline: 0 !important; }
/* 상단바 아래 띠 배너(C7) — 상단바와 같은 그림자. 장애 때만 DOM 에 있다. */
[data-mv="shell-banner"] { box-shadow: ${v('shadow')}; }

/* ── 실시간 소식 티커 ─────────────────────────────────────────── */
[data-mv="ticker"] { transition: opacity .3s; }
[data-mv="ticker-line"] {
  text-shadow: ${v('tickerTextShadow')};
  transition: opacity .35s;
}
[data-mv="live-dot"] { animation: mv-pulse 1.6s ease-in-out infinite; }
@keyframes mv-pulse {
  0%, 100% { opacity: 1;   transform: scale(1); }
  50%      { opacity: .35; transform: scale(.8); }
}

/* ── 우측 원형 컨트롤 ─────────────────────────────────────────── */
[data-mv="ctrl"] {
  box-shadow: ${v('shadow')};
  transition: background-color .15s, transform .15s;
}
[data-mv="ctrl"]:hover { background-color: ${v('ctrlHover')}; transform: scale(1.05); }
/* 데모에서 .ctrl.on 이 .ctrl:hover 보다 뒤에 정의돼 hover 중에도 배경이
   accent 로 남는다. 같은 결과가 나오도록 특이도를 한 단계 올린다. */
[data-mv="ctrl"][data-on="true"]:hover { background-color: ${v('accent')}; }

/* ── 하단 시트 ────────────────────────────────────────────────── */
[data-mv="sheet"] {
  box-shadow: ${v('sheetShadow')};
}
[data-mv="sheet-scroll"] { scrollbar-width: none; -ms-overflow-style: none; }
[data-mv="sheet-scroll"]::-webkit-scrollbar { display: none; }

/* 손잡이 — RN 에 없는 sticky. react-native-web 이 position:relative 를
   내려보내므로 !important 로 덮는다. */
[data-mv="grab"] {
  position: sticky !important;
  top: 0;
  cursor: grab;
}

/* ── 시트 CTA·버튼 ───────────────────────────────────────────── */
[data-mv="cta"] { transition: filter .15s; }
[data-mv="cta"]:hover { filter: brightness(1.12); }
[data-mv="round-button"], [data-mv="cal"] { box-shadow: ${v('shadow')}; }

/* ── 배치 세그먼트 ───────────────────────────────────────────── */
[data-mv="seg"] { transition: background-color .18s; }
[data-mv="seg"] path, [data-mv="seg"] rect { transition: stroke .18s; }

/* ── 명당 목록 ───────────────────────────────────────────────── */
/* perspective 는 부모에 걸어야 자식 rotateY 가 원근으로 접힌다. */
[data-mv="spot-list"] { perspective: 1200px; }
[data-mv="spot-wrapper"] {
  transform-style: preserve-3d;
  backface-visibility: hidden;
}
[data-mv="spot"] { cursor: pointer; transition: background-color .15s; }
[data-mv="spot"]:hover { background-color: ${v('spotHover')}; }
[data-mv="spot-dot"] { box-shadow: 0 0 0 4px ${v('dotRing')}; }
[data-mv="spot-dot"][data-tiles="true"] { box-shadow: 0 0 0 5px ${v('dotRingTiles')}; }
[data-mv="spot-distance"] { font-variant-numeric: tabular-nums; }

/* ── 계곡 카드·시설 행 ───────────────────────────────────────── */
[data-mv="segment-card"], [data-mv="facility-item"] {
  cursor: pointer;
  transition: background-color .15s;
}
[data-mv="segment-card"]:hover, [data-mv="facility-item"]:hover {
  background-color: ${v('spotHover')};
}

/* ── 하단 플로팅 내비 ────────────────────────────────────────── */
[data-mv="nav"] {
  box-shadow: ${v('navShadow')};
}
[data-mv="nav-button"] path,
[data-mv="nav-button"] circle,
[data-mv="nav-button"] rect { transition: stroke .15s; }
[data-mv="nav-button"]:hover path,
[data-mv="nav-button"]:hover circle,
[data-mv="nav-button"]:hover rect { stroke: ${v('fg2')}; }
/* 활성 탭은 hover 에도 색이 유지된다 — 데모의 정의 순서와 같은 결과. */
[data-mv="nav-button"][data-act="true"]:hover path,
[data-mv="nav-button"][data-act="true"]:hover circle,
[data-mv="nav-button"][data-act="true"]:hover rect { stroke: ${v('fg')}; }
/* .nav button.act 의 inset 링. RN 은 inset box-shadow 를 표현하지 못한다. */
[data-mv="nav-button"][data-act="true"] {
  box-shadow: inset 0 0 0 1px ${v('navActiveRing')};
}

/* ── 제보 폼(F5b) ─────────────────────────────────────────────── */
/* 유형 칩 줄 — 스크롤바 숨김(시트와 같은 처리) + 오른쪽 끝 페이드(화면 결정 (b) 완화,
   "더 있음"을 알린다). 페이드 색은 모달 카드 배경(surface)과 같아 이어 붙은 것처럼 보인다. */
[data-mv="report-type-scroll"] { scrollbar-width: none; -ms-overflow-style: none; }
[data-mv="report-type-scroll"]::-webkit-scrollbar { display: none; }
[data-mv="report-type-fade"] {
  background: linear-gradient(to right, transparent, ${v('surface')});
}
`;
