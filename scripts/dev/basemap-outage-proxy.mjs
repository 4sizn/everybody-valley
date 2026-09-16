#!/usr/bin/env node
/**
 * 베이스맵 강제 장애 프록시 (C7 검증용, 개발 전용).
 *
 * openfreemap(`tiles.openfreemap.org`) 앞에 서는 로컬 프록시. 앱은
 * `EXPO_PUBLIC_BASEMAP_HOST_OVERRIDE=localhost:8099` 로 스타일·TileJSON·타일·스프라이트·글리프를
 * 전부 이 프록시로 보낸다(`overrideBaseMapOrigin`). 응답 JSON 안의 절대 URL(TileJSON `tiles`,
 * 스타일 `sprite`·`glyphs`)도 프록시 오리진으로 바꿔 주므로 뒤따르는 요청도 여기로 온다.
 *
 * 제어 엔드포인트(같은 포트):
 *   GET /__outage            현재 모드 {"mode":"ok"|"fail"|"drop"}
 *   GET /__outage?mode=fail  모든 업스트림 요청에 503
 *   GET /__outage?mode=drop  모든 업스트림 요청의 소켓을 그냥 끊는다(네트워크 단절 흉내)
 *   GET /__outage?mode=ok    정상 프록시
 *   GET /__outage?mode=fail&only=tiles  스타일·TileJSON 은 살리고 타일(.pbf)·스프라이트·글리프만 실패
 *
 * 시연 순서: ok 로 지도를 띄움 → fail 로 바꾸고 지도를 조금 움직임(타일 요청) → 8초 뒤 배너
 * → ok 로 되돌리고 "다시 시도" → 배너 사라짐. 처음부터 fail 이면 스타일 fetch 가 실패해 전면
 * `RetryState` → ok 뒤 "다시 시도" 로 지도가 뜬다.
 *
 * 사용: node scripts/dev/basemap-outage-proxy.mjs [port=8099]
 */
import { createServer } from 'node:http';

const PORT = Number(process.argv[2] ?? 8099);
const UPSTREAM = 'https://tiles.openfreemap.org';
const ORIGIN = `http://localhost:${PORT}`;

/** @type {{ mode: 'ok' | 'fail' | 'drop', only: 'all' | 'tiles' }} */
const state = { mode: 'ok', only: 'all' };
let requests = 0;

function isTileLike(pathname) {
  return /\.(pbf|png|jpg|webp|json)$/i.test(pathname)
    ? !/^\/styles\//.test(pathname) && pathname !== '/planet'
    : /^\/(sprites|fonts)\//.test(pathname);
}

function handleControl(url, res) {
  const mode = url.searchParams.get('mode');
  if (mode === 'ok' || mode === 'fail' || mode === 'drop') state.mode = mode;
  const only = url.searchParams.get('only');
  if (only === 'all' || only === 'tiles') state.only = only;
  res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  res.end(JSON.stringify({ ...state, requests }));
}

async function proxyUpstream(req, res, url) {
  try {
    const upstream = await fetch(`${UPSTREAM}${url.pathname}${url.search}`, {
      headers: { accept: req.headers.accept ?? '*/*' },
    });
    const type = upstream.headers.get('content-type') ?? 'application/octet-stream';
    const headers = {
      'content-type': type,
      'access-control-allow-origin': '*',
      'cache-control': 'no-store',
    };
    if (/json/i.test(type)) {
      const text = (await upstream.text()).replaceAll(UPSTREAM, ORIGIN);
      res.writeHead(upstream.status, headers);
      res.end(text);
      return;
    }
    const body = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, headers);
    res.end(body);
  } catch (error) {
    res.writeHead(502, { 'content-type': 'text/plain', 'access-control-allow-origin': '*' });
    res.end(`upstream error: ${String(error)}`);
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', ORIGIN);
  if (url.pathname === '/__outage') {
    handleControl(url, res);
    return;
  }
  requests += 1;
  const affected = state.only === 'all' || isTileLike(url.pathname);
  if (state.mode === 'drop' && affected) {
    req.socket.destroy();
    return;
  }
  if (state.mode === 'fail' && affected) {
    res.writeHead(503, { 'content-type': 'text/plain', 'access-control-allow-origin': '*' });
    res.end('forced outage');
    return;
  }
  void proxyUpstream(req, res, url);
});

server.listen(PORT, () => {
  process.stdout.write(`basemap outage proxy → ${UPSTREAM} on ${ORIGIN} (mode=${state.mode})\n`);
  process.stdout.write(`  toggle: curl '${ORIGIN}/__outage?mode=fail' | ?mode=ok | ?mode=drop\n`);
});
