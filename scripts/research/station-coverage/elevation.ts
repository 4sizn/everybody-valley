import zlib from 'node:zlib';
import { readBytes, writeBytes } from './cache.ts';
import type { Keys } from './env.ts';
import { type LngLat, lngLatToTile } from './geo.ts';
import { fetchBytes } from './http.ts';

/** AWS Terrarium 타일 줌. z=12 에서 위도 37.7° 의 1픽셀 ≈ 30 m. */
export const TERRARIUM_Z = 12;

interface Png {
  width: number;
  height: number;
  channels: number;
  data: Buffer;
}

/** 최소 PNG 디코더 — 8비트 RGB/RGBA, 비인터레이스만(Terrarium 타일이 그렇다). 의존성 없이 zlib 만 쓴다. */
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
      if (depth !== 8 || interlace !== 0) throw new Error(`지원하지 않는 PNG (depth ${depth}, interlace ${interlace})`);
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
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)] ?? 0;
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let i = 0; i < stride; i++) {
      const x = raw[src + i] ?? 0;
      const a = i >= channels ? (data[dst + i - channels] ?? 0) : 0;
      const b = y > 0 ? (data[dst - stride + i] ?? 0) : 0;
      const c = y > 0 && i >= channels ? (data[dst - stride + i - channels] ?? 0) : 0;
      let v: number;
      switch (filter) {
        case 0:
          v = x;
          break;
        case 1:
          v = x + a;
          break;
        case 2:
          v = x + b;
          break;
        case 3:
          v = x + ((a + b) >> 1);
          break;
        case 4:
          v = x + paeth(a, b, c);
          break;
        default:
          throw new Error(`PNG filter ${filter}`);
      }
      data[dst + i] = v & 0xff;
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
  let bytes = readBytes(rel);
  if (!bytes) {
    bytes = await fetchBytes(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`, keys, 50);
    writeBytes(rel, bytes);
  }
  const png = decodePng(bytes);
  tileMemo.set(id, png);
  return png;
}

/** 점 표고(m). Terrarium 인코딩: (R·256 + G + B/256) − 32768. */
export async function elevationAt(p: LngLat, keys: Keys): Promise<number> {
  const t = lngLatToTile(p, TERRARIUM_Z);
  const png = await loadTile(TERRARIUM_Z, t.x, t.y, keys);
  const i = (t.py * png.width + t.px) * png.channels;
  const r = png.data[i] ?? 0;
  const g = png.data[i + 1] ?? 0;
  const b = png.data[i + 2] ?? 0;
  return Math.round((r * 256 + g + b / 256 - 32768) * 10) / 10;
}
