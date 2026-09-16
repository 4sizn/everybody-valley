/**
 * AWS Terrarium 표고 — 상·하류 방향 판정과 접근 경사(accessGradePct)의 재료.
 *
 * `scripts/research/station-coverage/elevation.ts` 를 그대로 옮겼다. z=12 에서 위도 37.7° 의
 * 1픽셀 ≈ 30 m. PNG 는 zlib 로 직접 디코드(의존성 없음). 타일은 캐시.
 * 출처: Mapzen/AWS Open Data Terrarium — 앱 설정 면의 지형 출처 표기와 같다.
 */
import zlib from 'node:zlib';
import type { Keys } from './env.mts';
import { lngLatToTile, type Position } from './geo.mts';
import { fetchBytes, readCachedBytes, TERRARIUM_GAP_MS, writeCachedBytes } from './http.mts';

export const TERRARIUM_Z = 12;
export const TERRARIUM_ATTRIBUTION = 'https://registry.opendata.aws/terrain-tiles/';

interface Png {
  width: number;
  height: number;
  channels: number;
  data: Buffer;
}

function decodePng(buf: Buffer): Png {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('PNG 아님');
  let pos = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const depth = body[8];
      const color = body[9];
      const interlace = body[12];
      if (depth !== 8 || interlace !== 0) {
        throw new Error(`지원하지 않는 PNG (depth ${depth}, interlace ${interlace})`);
      }
      channels = color === 2 ? 3 : color === 6 ? 4 : 0;
      if (!channels) throw new Error(`지원하지 않는 PNG color type ${color}`);
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const data = Buffer.alloc(stride * height);
  const paeth = (a: number, b: number, c: number): number => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)] ?? 0;
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let i = 0; i < stride; i += 1) {
      const x = raw[src + i] ?? 0;
      const a = i >= channels ? (data[dst + i - channels] ?? 0) : 0;
      const b = y > 0 ? (data[dst - stride + i] ?? 0) : 0;
      const c = y > 0 && i >= channels ? (data[dst - stride + i - channels] ?? 0) : 0;
      let value: number;
      switch (filter) {
        case 0:
          value = x;
          break;
        case 1:
          value = x + a;
          break;
        case 2:
          value = x + b;
          break;
        case 3:
          value = x + ((a + b) >> 1);
          break;
        case 4:
          value = x + paeth(a, b, c);
          break;
        default:
          throw new Error(`PNG filter ${filter}`);
      }
      data[dst + i] = value & 0xff;
    }
  }
  return { width, height, channels, data };
}

const tileMemo = new Map<string, Png>();

async function loadTile(z: number, x: number, y: number, keys: Keys): Promise<Png> {
  const id = `${z}/${x}/${y}`;
  const memo = tileMemo.get(id);
  if (memo) return memo;
  const rel = `terrarium/${z}-${x}-${y}.png`;
  let bytes = readCachedBytes(rel);
  if (!bytes) {
    bytes = await fetchBytes(
      `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`,
      keys,
      TERRARIUM_GAP_MS,
    );
    writeCachedBytes(rel, bytes);
  }
  const png = decodePng(bytes);
  tileMemo.set(id, png);
  return png;
}

/** 점 표고(m). Terrarium 인코딩: (R·256 + G + B/256) − 32768. */
export async function elevationAt(p: Position, keys: Keys): Promise<number> {
  const tile = lngLatToTile(p, TERRARIUM_Z);
  const png = await loadTile(TERRARIUM_Z, tile.x, tile.y, keys);
  const index = (tile.py * png.width + tile.px) * png.channels;
  const r = png.data[index] ?? 0;
  const g = png.data[index + 1] ?? 0;
  const b = png.data[index + 2] ?? 0;
  return Math.round((r * 256 + g + b / 256 - 32768) * 10) / 10;
}
