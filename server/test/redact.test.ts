import { describe, expect, it } from 'vitest';
import { createRedactor, MASK } from '../src/logging/redact';
import { ServerLogger } from '../src/logging/ServerLogger';

describe('createRedactor', () => {
  const redact = createRedactor(['VWORLD-SECRET-1234', 'HRFCOKEY0123456789ABCDEF', 'x']);

  it('알고 있는 비밀 값을 어디에 있어도 가린다(짧은 값은 무시)', () => {
    expect(redact('url ?key=VWORLD-SECRET-1234&domain=localhost')).toBe(
      `url ?key=${MASK}&domain=localhost`,
    );
    expect(redact('api.hrfco.go.kr/HRFCOKEY0123456789ABCDEF/waterlevel/info.json')).toBe(
      `api.hrfco.go.kr/${MASK}/waterlevel/info.json`,
    );
    expect(redact('xyz')).toBe('xyz');
  });

  it('모르는 값이라도 key= 류 파라미터와 HRFCO 경로 키는 패턴으로 가린다', () => {
    expect(redact('https://a/b?SERVICE=WFS&key=UNKNOWN123&x=1')).toBe(
      `https://a/b?SERVICE=WFS&key=${MASK}&x=1`,
    );
    expect(redact('nph-aws2_min?tm1=1&authKey=ABCDEFG')).toBe(`nph-aws2_min?tm1=1&authKey=${MASK}`);
    expect(redact('?serviceKey=abc&ServiceKey=def')).toBe(`?serviceKey=${MASK}&ServiceKey=${MASK}`);
    expect(redact('https://api.hrfco.go.kr/ABCDEFGHIJKLMNOPQRST/rainfall/info.json')).toBe(
      `https://api.hrfco.go.kr/${MASK}/rainfall/info.json`,
    );
  });
});

describe('ServerLogger', () => {
  it('한 줄 JSON 을 내보내고 필드·메시지 안의 키를 가린다', () => {
    const lines: string[] = [];
    const logger = new ServerLogger('t', {
      format: 'json',
      redact: createRedactor(['SECRET-VALUE-99']),
      now: () => new Date('2026-09-06T00:00:00.000Z'),
      sink: (_level, line) => lines.push(line),
    });
    logger.info('hello SECRET-VALUE-99', { url: 'https://x/?key=SECRET-VALUE-99', n: 1 });
    expect(lines).toHaveLength(1);
    const rec = JSON.parse(lines[0] ?? '{}') as Record<string, unknown>;
    expect(rec).toMatchObject({
      ts: '2026-09-06T00:00:00.000Z',
      level: 'info',
      scope: 't',
      msg: `hello ${MASK}`,
      url: `https://x/?key=${MASK}`,
      n: 1,
    });
  });

  it('minLevel 미만은 버리고 child 는 스코프를 이어 붙인다', () => {
    const lines: { level: string; line: string }[] = [];
    const logger = new ServerLogger('root', {
      format: 'pretty',
      minLevel: 'info',
      sink: (level, line) => lines.push({ level, line }),
    });
    const child = logger.child('db');
    child.debug('dropped');
    child.warn('kept', { a: 1 });
    child.error('boom', new Error('bad thing'));
    expect(lines.map((l) => l.level)).toEqual(['warn', 'error']);
    expect(lines[0]?.line).toContain('[root:db] kept {"a":1}');
    expect(lines[1]?.line).toContain('bad thing');
  });
});
