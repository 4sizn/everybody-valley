/**
 * 이징 — 원본 데모의 cubic-bezier 값 그대로.
 *
 * RN 의 `Easing.bezier` 는 CSS 의 `cubic-bezier()` 와 같은 곡선을 만든다.
 * 덕분에 CSS transition 을 Animated 로 옮기면서 감각이 유지되고, 같은 코드가
 * 네이티브에서도 돈다.
 */
import { Easing } from 'react-native';

/** `.flip` 접힘 — `cubic-bezier(.55,0,1,.45)` (가속) */
export const FOLD_IN = Easing.bezier(0.55, 0, 1, 0.45);
/** `.flip.back` 펴짐 — `cubic-bezier(0,.55,.45,1)` (감속) */
export const FOLD_OUT = Easing.bezier(0, 0.55, 0.45, 1);
/** 시트 접힘/펴짐 — `cubic-bezier(.32,.72,0,1)` */
export const SHEET = Easing.bezier(0.32, 0.72, 0, 1);
/** 항목 스태거 등장 — `cubic-bezier(.22,.9,.3,1)` */
export const STAGGER = Easing.bezier(0.22, 0.9, 0.3, 1);
/** 데모의 `opacity .22s ease-in` */
export const EASE_IN = Easing.bezier(0.42, 0, 1, 1);
/** 데모의 `opacity .24s ease-out` */
export const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);
/** 핀 낙하 — `cubic-bezier(.2,1.5,.4,1)` (오버슈트) */
export const DROP = Easing.bezier(0.2, 1.5, 0.4, 1);
