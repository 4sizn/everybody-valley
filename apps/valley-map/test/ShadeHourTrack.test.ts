import { createElement, type ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import { ShadeHourTrack } from '../src/journey/ShadeHourTrack.web';

const { renderToStaticMarkup } = await vi.importActual<{
  renderToStaticMarkup: (node: ReactNode) => string;
}>('react-dom/server');
const render = (value: number) =>
  renderToStaticMarkup(createElement(ShadeHourTrack, { value, onChange: () => {} }));

it('정시 9개 눈금과 선택 시각을 보여준다', () => {
  const html = render(14);
  expect(html.match(/class="ev-shade-tick[ "]/g)).toHaveLength(9);
  expect(html).toContain('aria-label="10시"');
  expect(html).toContain('aria-label="18시"');
  expect(html).toContain('14:00');
  expect(html).toContain('ev-shade-tick ev-shade-tick--on" aria-label="14시" aria-pressed="true"');
});

it('양 끝에서 해당 화살표만 잠근다', () => {
  expect(render(10)).toContain('aria-label="한 시간 전" disabled');
  expect(render(10)).not.toContain('aria-label="한 시간 후" disabled');
  expect(render(18)).toContain('aria-label="한 시간 후" disabled');
  expect(render(14)).not.toContain('disabled');
});
