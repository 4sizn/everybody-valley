import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventHub, parseChannels, type SseMessage } from '../src/events/EventHub';

afterEach(() => {
  vi.useRealTimers();
});

describe('parseChannels', () => {
  it('비면 전부, 모르는 이름은 버리고, 전부 모르면 전부', () => {
    expect(parseChannels(undefined)).toEqual(['hydro', 'aws', 'alert', 'report']);
    expect(parseChannels('aws')).toEqual(['aws']);
    expect(parseChannels('aws, hydro,aws,bogus')).toEqual(['aws', 'hydro']);
    expect(parseChannels('bogus')).toEqual(['hydro', 'aws', 'alert', 'report']);
  });
});

describe('EventHub', () => {
  it('구독 직후 hello, 15 s 마다 heartbeat, 채널 이벤트는 구독자에게만', async () => {
    vi.useFakeTimers({ now: Date.parse('2026-09-06T00:00:00Z') });
    const hub = new EventHub({ heartbeatMs: 15_000 });
    const a: SseMessage[] = [];
    const b: SseMessage[] = [];
    const subA = hub.subscribe(['hydro'], (m) => {
      a.push(m);
    });
    hub.subscribe(['hydro', 'aws'], (m) => {
      b.push(m);
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(a.map((m) => m.event)).toEqual(['hello']);
    expect(JSON.parse(a[0]?.data ?? '{}')).toMatchObject({
      channels: ['hydro'],
      heartbeatMs: 15_000,
    });

    await vi.advanceTimersByTimeAsync(15_000);
    expect(a.map((m) => m.event)).toEqual(['hello', 'heartbeat']);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(a.filter((m) => m.event === 'heartbeat')).toHaveLength(3);
    expect(JSON.parse(a[1]?.data ?? '{}').at).toBe('2026-09-06T00:00:15.000Z');

    expect(hub.publish('aws', { stations: 736 })).toBe(1);
    expect(hub.publish('hydro', { waterlevel: 1203 })).toBe(2);
    await vi.advanceTimersByTimeAsync(0);
    expect(a.filter((m) => m.event === 'aws')).toHaveLength(0);
    expect(b.filter((m) => m.event === 'aws')).toHaveLength(1);
    const hydro = a.find((m) => m.event === 'hydro');
    expect(JSON.parse(hydro?.data ?? '{}')).toMatchObject({ channel: 'hydro', waterlevel: 1203 });
    expect(hydro?.id).toBe('2');

    subA.close();
    expect(hub.size).toBe(1);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(a.filter((m) => m.event === 'heartbeat')).toHaveLength(3);
    hub.closeAll();
    expect(hub.size).toBe(0);
  });

  it('sink 가 던지면 그 구독을 정리한다', async () => {
    vi.useFakeTimers();
    const hub = new EventHub({ heartbeatMs: 1000 });
    hub.subscribe(['aws'], () => {
      throw new Error('closed socket');
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(hub.size).toBe(0);
  });
});
