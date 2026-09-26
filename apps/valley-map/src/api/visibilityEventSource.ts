/**
 * 숨은 탭에서는 SSE 연결을 놓는 `EventSourceLike` 겉옷 (실기기 실측 2026-09-24).
 *
 * 계곡 화면 한 장이 연결 셋을 잡는다 — 경보 스트림, 제보 스트림, 그리고 일반 요청. 브라우저는
 * HTTP/1.1 한 출처에 여섯 개까지만 열기 때문에 **탭 둘이면 한도가 차고 세 번째 탭은 응답을
 * 못 받고 멈춘다**(갤럭시 A20/안드로이드 11 크롬에서 탭 1→3, 2→6, 3→6 으로 실측, 세 번째 탭은
 * 빈 화면). 화면이 가려지면 스트림을 닫고 돌아오면 다시 연다.
 *
 * 돌아왔을 때의 새로고침은 따로 만들지 않는다 — 서버가 연결 직후 `hello` 를 보내고
 * (`server/src/http/routes/events.ts`) 구독자의 처리기가 그걸로 다시 읽기 때문이다.
 */
import type { EventSourceLike } from '@modu-valley/core';

type Listener = (event: { readonly data: string }) => void;

/** `document` 에서 쓰는 것만. 테스트가 가짜를 넣는다. */
export interface VisibilityDocument {
  readonly hidden: boolean;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

export class VisibilityEventSource implements EventSourceLike {
  readonly #open: () => EventSourceLike;
  readonly #doc: VisibilityDocument;
  readonly #listeners: [string, Listener][] = [];
  readonly #onVisibilityChange: () => void;
  #source: EventSourceLike | null = null;
  #closed = false;

  constructor(open: () => EventSourceLike, doc: VisibilityDocument) {
    this.#open = open;
    this.#doc = doc;
    this.#onVisibilityChange = () => {
      if (this.#closed) return;
      if (doc.hidden) this.#release();
      else this.#acquire();
    };
    doc.addEventListener('visibilitychange', this.#onVisibilityChange);
    // 이미 가려진 채로 만들어지면 열지 않는다 — 배경 탭이 뜨자마자 한 자리를 먹는 것을 막는다.
    if (!doc.hidden) this.#acquire();
  }

  addEventListener(type: string, listener: Listener): void {
    this.#listeners.push([type, listener]);
    this.#source?.addEventListener(type, listener);
  }

  close(): void {
    this.#closed = true;
    this.#doc.removeEventListener('visibilitychange', this.#onVisibilityChange);
    this.#release();
  }

  #acquire(): void {
    if (this.#source) return;
    const source = this.#open();
    // 다시 열 때마다 등록된 처리기를 새 연결에 다시 건다.
    for (const [type, listener] of this.#listeners) source.addEventListener(type, listener);
    this.#source = source;
  }

  #release(): void {
    this.#source?.close();
    this.#source = null;
  }
}
