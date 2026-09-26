/**
 * 숨은 탭에서 SSE 연결을 놓는지 — 브라우저의 출처당 여섯 연결 한도를 넘겨 새 탭이 멈추던 것을
 * 막는 규약이다(`src/api/visibilityEventSource.ts` 의 실측 참고).
 */
import { describe, expect, it } from 'vitest';
import { type VisibilityDocument, VisibilityEventSource } from '../src/api/visibilityEventSource';

class FakeSource {
  closed = false;
  readonly types: string[] = [];
  addEventListener(type: string): void {
    this.types.push(type);
  }
  close(): void {
    this.closed = true;
  }
}

function fakeDoc(): VisibilityDocument & { hide(): void; show(): void; listeners: number } {
  const listeners = new Set<() => void>();
  let hidden = false;
  return {
    get hidden() {
      return hidden;
    },
    get listeners() {
      return listeners.size;
    },
    addEventListener: (_type, listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener);
    },
    hide() {
      hidden = true;
      for (const listener of [...listeners]) listener();
    },
    show() {
      hidden = false;
      for (const listener of [...listeners]) listener();
    },
  };
}

describe('VisibilityEventSource', () => {
  it('가려지면 연결을 닫고, 돌아오면 다시 열어 처리기를 새 연결에 건다', () => {
    const opened: FakeSource[] = [];
    const doc = fakeDoc();
    const source = new VisibilityEventSource(() => {
      const next = new FakeSource();
      opened.push(next);
      return next;
    }, doc);
    source.addEventListener('hello', () => {});
    source.addEventListener('alert', () => {});
    expect(opened).toHaveLength(1);
    expect(opened[0]?.types).toEqual(['hello', 'alert']);

    doc.hide();
    expect(opened[0]?.closed).toBe(true);
    expect(opened).toHaveLength(1);

    doc.show();
    expect(opened).toHaveLength(2);
    // 다시 연 연결에도 같은 처리기가 걸려야 서버의 `hello` 가 구독자의 새로고침을 돌린다.
    expect(opened[1]?.types).toEqual(['hello', 'alert']);
    expect(opened[1]?.closed).toBe(false);
  });

  it('가려진 채로 만들어지면 연결하지 않는다', () => {
    const opened: FakeSource[] = [];
    const doc = fakeDoc();
    doc.hide();
    const source = new VisibilityEventSource(() => {
      const next = new FakeSource();
      opened.push(next);
      return next;
    }, doc);
    source.addEventListener('hello', () => {});
    expect(opened).toHaveLength(0);
    doc.show();
    expect(opened).toHaveLength(1);
    expect(opened[0]?.types).toEqual(['hello']);
  });

  it('close 뒤에는 다시 보여도 열지 않고 구독도 남기지 않는다', () => {
    const opened: FakeSource[] = [];
    const doc = fakeDoc();
    const source = new VisibilityEventSource(() => {
      const next = new FakeSource();
      opened.push(next);
      return next;
    }, doc);
    source.close();
    expect(opened[0]?.closed).toBe(true);
    expect(doc.listeners).toBe(0);
    doc.show();
    expect(opened).toHaveLength(1);
  });
});
