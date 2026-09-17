import { createElement, type ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import { LandLegend, type LandStatus } from '../src/journey/LandLegend.web';

const { renderToStaticMarkup } = await vi.importActual<{
  renderToStaticMarkup: (node: ReactNode) => string;
}>('react-dom/server');
const render = (status: LandStatus) =>
  renderToStaticMarkup(createElement(LandLegend, { status, onRetry: () => {} }));

it('성공 범례는 네 소유구분과 출입 안내를 제공하고 재시도 버튼을 숨긴다', () => {
  const html = render('ready');
  for (const label of ['개인', '법인', '국공유지', '미확인']) expect(html).toContain(label);
  expect(html.match(/class="ev-land-swatch"/g)).toHaveLength(4);
  expect(html).toContain('소유구분은 출입 허가와 달라요');
  expect(html).not.toContain('<button');
});

it('조회 중·실패·빈 결과·부분 결과를 정상 전체 결과로 오해하지 않게 구분한다', () => {
  for (const status of ['loading', 'error', 'empty'] as const) {
    const html = render(status);
    expect(html).toContain('role="status"');
    expect(html).not.toContain('ev-land-swatch');
    expect(html.includes('<button')).toBe(status === 'error');
  }
  expect(render('empty')).toContain('사유지가 없다는 뜻은 아니에요');
  expect(render('partial')).toContain('일부 지역만 표시 중');
  expect(render('partial')).toContain('ev-land-swatch');
});
