import { defineConfig } from 'vitest/config';

// 지도 SDK 없이 돌아가는 단위만 — `MarkerIconRegistry` 는 maplibre `Map` 의 네 메서드
// (`setMissingStyleImageResolver`·`hasImage`·`addImage`·`style`)만 쓰므로 가짜로 대신한다.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
