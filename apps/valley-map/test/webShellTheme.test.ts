import { describe, expect, it } from 'vitest';
import { parseThemeMessage } from '../src/components/shell/webShellTheme';

describe('parseThemeMessage', () => {
  it('테마 메시지의 모드를 읽는다', () => {
    expect(parseThemeMessage('{"type":"theme","mode":"dark"}')).toBe('dark');
    expect(parseThemeMessage('{"type":"theme","mode":"light"}')).toBe('light');
  });
  it('다른 메시지·이상한 값·깨진 JSON 은 null', () => {
    expect(parseThemeMessage('{"type":"nav","mode":"dark"}')).toBeNull();
    expect(parseThemeMessage('{"type":"theme","mode":"sepia"}')).toBeNull();
    expect(parseThemeMessage('not json')).toBeNull();
    expect(parseThemeMessage('null')).toBeNull();
  });
});
