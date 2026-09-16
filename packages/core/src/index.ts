/**
 * @modu-valley/core — 플랫폼 무관 공용 모듈.
 *
 * 이 패키지는 DOM·React·react-native·maplibre 를 import 하지 않는다.
 * web / android / ios 세 플랫폼이 같은 도메인·유즈케이스·상태를 공유한다.
 */

export * from './application/index';
export * from './data/index';
export * from './domain/index';
export * from './domain/news/index';
export * from './shared/index';
