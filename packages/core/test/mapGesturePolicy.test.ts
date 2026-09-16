/**
 * 제스처 정책 값을 고정한다.
 *
 * 이 파일이 지키는 것은 "세 플랫폼이 **같은 값**을 받는다" 는 사실과, 회전이 켜져 있다는
 * 사실이다. 정책이 조용히 바뀌면(예: 회전이 다시 꺼지면) web 과 네이티브 어느 쪽에서
 * 무엇이 켜져 있는지를 다시 추적할 수 없게 된다 — `MapGestures` 주석이 경계하는 상태다.
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP_GESTURES } from '../src/domain/camera/MapGestures';

describe('제스처 정책', () => {
  it('여섯 항목이 모두 켜져 있다 — 핀치 회전 포함(2026-09-08 사용자 요청)', () => {
    expect(DEFAULT_MAP_GESTURES).toEqual({
      pan: true,
      pinchZoom: true,
      pinchRotate: true,
      doubleTapZoom: true,
      quickZoom: true,
      dragPitch: true,
    });
  });
});
