/**
 * 정리 가능한 타이머.
 *
 * 원본 데모의 `setInterval(spawn, 620)` 과 티커 `setInterval(..., 3200)` 은
 * 해제 경로가 없다. 여기서는 모든 타이머가 `Disposable` 로 나온다.
 */
import type { Disposable } from '../disposable';
import { toDisposable } from '../disposable';
import { ok, type VoidResult } from '../result';
import type { CancellationToken } from './cancellation';

export function managedTimeout(handler: () => void, delayMs: number): Disposable {
  const id = setTimeout(handler, delayMs);
  return toDisposable(() => clearTimeout(id));
}

export function managedInterval(handler: () => void, periodMs: number): Disposable {
  const id = setInterval(handler, periodMs);
  return toDisposable(() => clearInterval(id));
}

/**
 * 취소 가능한 지연. 취소되면 남은 시간을 기다리지 않고 즉시 결과를 돌려준다.
 * reject 하지 않으므로 호출부에 try/catch 가 필요 없다.
 */
export function delay(delayMs: number, token: CancellationToken): Promise<VoidResult> {
  const immediate = token.checkpoint('delay');
  if (!immediate.ok) return Promise.resolve(immediate);

  return new Promise<VoidResult>((resolve) => {
    const timer = managedTimeout(() => {
      link.dispose();
      resolve(ok());
    }, delayMs);
    const link = token.onCancel((reason) => {
      timer.dispose();
      resolve({ ok: false, error: reason });
    });
  });
}
