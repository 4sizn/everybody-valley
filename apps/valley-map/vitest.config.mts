import { defineConfig } from 'vitest/config';

// 테스트 대상은 `src/theme` 의 순수 TS 모듈만이다(react-native import 없음).
// RN 컴포넌트 렌더 테스트는 여기서 하지 않는다 — jsdom·RN 목이 필요해진다.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
