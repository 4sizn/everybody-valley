/**
 * SSE 이벤트 허브. 잡이 `publish(channel, payload)` 하면 그 채널을 구독한 연결마다 이벤트가 나간다.
 * 연결마다 15 s 하트비트(결정 (e)) — 프록시·모바일 네트워크가 유휴 연결을 끊지 않게.
 *
 * 순수 클래스다: 연결(sink)·타이머는 주입받아 시험한다. Hono 라우트가 `streamSSE` 로 sink 를 만든다.
 */
export const EVENT_CHANNELS = ['hydro', 'aws', 'alert', 'report'] as const;
export type EventChannel = (typeof EVENT_CHANNELS)[number];

export const DEFAULT_HEARTBEAT_MS = 15_000;

export interface SseMessage {
  readonly event: string;
  readonly data: string;
  readonly id?: string;
}

export type SseSink = (message: SseMessage) => void | Promise<void>;

export interface Subscription {
  readonly id: number;
  close(): void;
}

export interface EventHubOptions {
  readonly heartbeatMs?: number;
  readonly now?: () => number;
}

export function isEventChannel(value: string): value is EventChannel {
  return (EVENT_CHANNELS as readonly string[]).includes(value);
}

/** `?channel=hydro,aws` 파싱. 비어 있으면 전부, 모르는 이름은 버린다. */
export function parseChannels(raw: string | undefined): EventChannel[] {
  if (!raw) return [...EVENT_CHANNELS];
  const picked = raw
    .split(',')
    .map((s) => s.trim())
    .filter(isEventChannel);
  return picked.length > 0 ? [...new Set(picked)] : [...EVENT_CHANNELS];
}

interface Subscriber {
  readonly channels: ReadonlySet<EventChannel>;
  readonly sink: SseSink;
  readonly heartbeat: ReturnType<typeof setInterval>;
}

export class EventHub {
  readonly #subscribers = new Map<number, Subscriber>();
  readonly #heartbeatMs: number;
  readonly #now: () => number;
  #nextId = 1;
  #eventSeq = 0;

  constructor(options: EventHubOptions = {}) {
    this.#heartbeatMs = options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;
    this.#now = options.now ?? Date.now;
  }

  get size(): number {
    return this.#subscribers.size;
  }

  subscribe(channels: readonly EventChannel[], sink: SseSink): Subscription {
    const id = this.#nextId++;
    const heartbeat = setInterval(() => {
      void this.#deliver(id, { event: 'heartbeat', data: JSON.stringify({ at: this.#iso() }) });
    }, this.#heartbeatMs);
    heartbeat.unref?.();
    this.#subscribers.set(id, { channels: new Set(channels), sink, heartbeat });
    void this.#deliver(id, {
      event: 'hello',
      data: JSON.stringify({ channels, heartbeatMs: this.#heartbeatMs, at: this.#iso() }),
    });
    return { id, close: () => this.#close(id) };
  }

  /** 채널 구독자 모두에게. 보낸 연결 수. */
  publish(channel: EventChannel, payload: Readonly<Record<string, unknown>>): number {
    const id = String(++this.#eventSeq);
    const data = JSON.stringify({ channel, at: this.#iso(), ...payload });
    let sent = 0;
    for (const [subId, s] of this.#subscribers) {
      if (!s.channels.has(channel)) continue;
      void this.#deliver(subId, { event: channel, data, id });
      sent += 1;
    }
    return sent;
  }

  closeAll(): void {
    for (const id of [...this.#subscribers.keys()]) this.#close(id);
  }

  #iso(): string {
    return new Date(this.#now()).toISOString();
  }

  #close(id: number): void {
    const s = this.#subscribers.get(id);
    if (!s) return;
    clearInterval(s.heartbeat);
    this.#subscribers.delete(id);
  }

  async #deliver(id: number, message: SseMessage): Promise<void> {
    const s = this.#subscribers.get(id);
    if (!s) return;
    try {
      await s.sink(message);
    } catch {
      // 끊긴 연결 — 조용히 정리한다.
      this.#close(id);
    }
  }
}
