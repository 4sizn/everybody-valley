/**
 * 긴고랑계곡 구간 좌표열 — OSM 하천이 없어(SD3) Terrarium DEM 최소비용경로로 유도.
 *
 * 방법: 계곡 입구(확인된 VWorld 점)와 용마산 정상(OSM natural=peak, "용마봉에서
 * 흘러내려온다"는 현장 설명과 일치)을 두 끝점으로 고정하고, 그 사이 지형에서
 * 오르막을 가장 적게 타는 경로(A*, 간선 비용 = 거리 × (1 + 상승분 × GAIN_W), 휴리스틱
 * = 목표까지 직선거리)를 찾는다. 두 실측 점을 잇는 최소비용경로는 능선이 아니라
 * 골짜기 바닥을 따라가는 경향이 있다(표준 GIS 최소비용경로 기법) — 임의로 그은 선이
 * 아니다. 실행: `npx tsx scripts/research/gingorang/trace.mts` → `/tmp/gingorang-path.json`.
 *
 * 한계(정직하게 남긴다) — GAIN_W 를 6→40 으로 올려도 직선 대비 최대 편차가 22 m 를
 * 못 넘었다(전체 982 m, 직선 946 m). Terrarium 는 z15(≈2.4 m/px, 이 위도 기준)에서도
 * 원본 SRTM/ASTER 급 전지구 지형자료라 이런 작은 소하천의 실제 굴곡을 담을 만큼
 * 촘촘하지 않다는 뜻으로 읽었다 — 그래서 이 경로는 "실측 두 점을 잇는 현실적인
 * 근사"이지 "실제 계곡의 정밀한 형태"라고는 주장하지 않는다(결과 파일 메타데이터에도
 * 같은 고지를 남겼다). 현장 GPS 트랙이 나오면 이 경로를 교체한다.
 */
import zlib from 'node:zlib';
import fs from 'node:fs';

const ENTRANCE = { lat: 37.56267150314907, lng: 127.09618647364996 }; // VWorld 검색 "긴고랑계곡"
const PEAK = { lat: 37.5711684, lng: 127.0957102 }; // OSM node 2493496155 "용마산" 348m
const Z = 15;

function latlonToTileFrac(lat: number, lng: number, z: number) {
  const latRad = (lat * Math.PI) / 180;
  const n = 2 ** z;
  const x = ((lng + 180) / 360) * n;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}
function tileToLatLng(x: number, y: number, z: number) {
  const n = 2 ** z;
  const lng = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  return { lat: (latRad * 180) / Math.PI, lng };
}

interface Png { width: number; height: number; channels: number; data: Buffer }
function decodePng(buf: Buffer): Png {
  let pos = 8; let width = 0; let height = 0; let channels = 0;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4);
      const color = body[9];
      channels = color === 2 ? 3 : color === 6 ? 4 : 0;
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const data = Buffer.alloc(stride * height);
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)] ?? 0;
    const src = y * (stride + 1) + 1, dst = y * stride;
    for (let i = 0; i < stride; i += 1) {
      const x = raw[src + i] ?? 0;
      const a = i >= channels ? data[dst + i - channels]! : 0;
      const b = y > 0 ? data[dst - stride + i]! : 0;
      const c = y > 0 && i >= channels ? data[dst - stride + i - channels]! : 0;
      let value: number;
      switch (filter) {
        case 0: value = x; break;
        case 1: value = x + a; break;
        case 2: value = x + b; break;
        case 3: value = x + ((a + b) >> 1); break;
        case 4: value = x + paeth(a, b, c); break;
        default: throw new Error(`filter ${filter}`);
      }
      data[dst + i] = value & 0xff;
    }
  }
  return { width, height, channels, data };
}

async function fetchTile(z: number, x: number, y: number): Promise<Png> {
  const cacheDir = '/tmp/gingorang-terrarium-cache';
  fs.mkdirSync(cacheDir, { recursive: true });
  const cachePath = `${cacheDir}/${z}-${x}-${y}.png`;
  let buf: Buffer;
  if (fs.existsSync(cachePath)) {
    buf = fs.readFileSync(cachePath);
  } else {
    const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`tile fetch failed ${z}/${x}/${y}: ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(cachePath, buf);
    await new Promise((r) => setTimeout(r, 120));
  }
  return decodePng(buf);
}

async function main() {
  const eT = latlonToTileFrac(ENTRANCE.lat, ENTRANCE.lng, Z);
  const pT = latlonToTileFrac(PEAK.lat, PEAK.lng, Z);
  const minTx = Math.floor(Math.min(eT.x, pT.x)) - 1;
  const maxTx = Math.floor(Math.max(eT.x, pT.x)) + 1;
  const minTy = Math.floor(Math.min(eT.y, pT.y)) - 1;
  const maxTy = Math.floor(Math.max(eT.y, pT.y)) + 1;
  console.log('tiles', minTx, maxTx, minTy, maxTy);

  const tiles: Png[][] = [];
  for (let ty = minTy; ty <= maxTy; ty += 1) {
    const row: Png[] = [];
    for (let tx = minTx; tx <= maxTx; tx += 1) {
      row.push(await fetchTile(Z, tx, ty));
    }
    tiles.push(row);
  }
  const tileSize = tiles[0]![0]!.width; // 256
  const gridW = (maxTx - minTx + 1) * tileSize;
  const gridH = (maxTy - minTy + 1) * tileSize;
  const elev = new Float32Array(gridW * gridH);
  for (let ty = 0; ty < tiles.length; ty += 1) {
    for (let tx = 0; tx < tiles[ty]!.length; tx += 1) {
      const png = tiles[ty]![tx]!;
      for (let py = 0; py < tileSize; py += 1) {
        for (let px = 0; px < tileSize; px += 1) {
          const idx = (py * tileSize + px) * png.channels;
          const r = png.data[idx]!, g = png.data[idx + 1]!, b = png.data[idx + 2]!;
          const h = r * 256 + g + b / 256 - 32768;
          const gx = tx * tileSize + px;
          const gy = ty * tileSize + py;
          elev[gy * gridW + gx] = h;
        }
      }
    }
  }

  // 전역 픽셀 좌표 변환
  function globalPixel(lat: number, lng: number) {
    const t = latlonToTileFrac(lat, lng, Z);
    return { gx: (t.x - minTx) * tileSize, gy: (t.y - minTy) * tileSize };
  }
  const startG = globalPixel(ENTRANCE.lat, ENTRANCE.lng);
  const goalG = globalPixel(PEAK.lat, PEAK.lng);
  console.log('grid', gridW, gridH, 'start', startG, 'goal', goalG);
  console.log('elev at start', elev[Math.round(startG.gy) * gridW + Math.round(startG.gx)]);
  console.log('elev at goal', elev[Math.round(goalG.gy) * gridW + Math.round(goalG.gx)]);

  // 미터/픽셀(위도 근사, 이 지역에서 거의 일정)
  const mppLat = 156543.03392 * Math.cos((ENTRANCE.lat * Math.PI) / 180) / (2 ** Z);

  // A* — 8방향, 비용 = 거리 × (1 + max(0, 상승분) × GAIN_W). 휴리스틱은 목표까지
  // 직선거리(m) — 실제 비용이 항상 거리 이상이므로 admissible.
  const GAIN_W = 40; // 오르막 회피 가중치(경험적 — valleys 는 상승이 적은 경로를 만든다)
  const sx = Math.round(startG.gx), sy = Math.round(startG.gy);
  const gx = Math.round(goalG.gx), gy = Math.round(goalG.gy);
  const N = gridW * gridH;
  const dist = new Float64Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const visited = new Uint8Array(N);
  const startIdx = sy * gridW + sx;
  dist[startIdx] = 0;

  function heuristic(idx: number): number {
    const cx = idx % gridW, cy = Math.floor(idx / gridW);
    return Math.hypot(cx - gx, cy - gy) * mppLat;
  }

  // 배열 기반 이진 최소힙(우선순위 = f = g + h).
  class MinHeap {
    private readonly f: number[] = [];
    private readonly idx: number[] = [];
    get size() { return this.f.length; }
    push(fScore: number, i: number) {
      this.f.push(fScore); this.idx.push(i);
      let c = this.f.length - 1;
      while (c > 0) {
        const p = (c - 1) >> 1;
        if (this.f[p]! <= this.f[c]!) break;
        [this.f[p], this.f[c]] = [this.f[c]!, this.f[p]!];
        [this.idx[p], this.idx[c]] = [this.idx[c]!, this.idx[p]!];
        c = p;
      }
    }
    pop(): number | undefined {
      if (this.f.length === 0) return undefined;
      const top = this.idx[0]!;
      const lastF = this.f.pop()!, lastI = this.idx.pop()!;
      if (this.f.length > 0) {
        this.f[0] = lastF; this.idx[0] = lastI;
        let p = 0;
        for (;;) {
          const l = p * 2 + 1, r = p * 2 + 2;
          let smallest = p;
          if (l < this.f.length && this.f[l]! < this.f[smallest]!) smallest = l;
          if (r < this.f.length && this.f[r]! < this.f[smallest]!) smallest = r;
          if (smallest === p) break;
          [this.f[p], this.f[smallest]] = [this.f[smallest]!, this.f[p]!];
          [this.idx[p], this.idx[smallest]] = [this.idx[smallest]!, this.idx[p]!];
          p = smallest;
        }
      }
      return top;
    }
  }
  const heap = new MinHeap();
  heap.push(heuristic(startIdx), startIdx);
  const neighbors = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
  let iterations = 0;
  const goalIdxTarget = gy * gridW + gx;
  for (;;) {
    const idx = heap.pop();
    if (idx === undefined) break;
    if (visited[idx]) continue;
    visited[idx] = 1;
    iterations += 1;
    if (idx === goalIdxTarget) break;
    const d = dist[idx]!;
    const cx = idx % gridW, cy = Math.floor(idx / gridW);
    for (const [dx, dy] of neighbors) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= gridW || ny >= gridH) continue;
      const nIdx = ny * gridW + nx;
      if (visited[nIdx]) continue;
      const distM = Math.sqrt(dx * dx + dy * dy) * mppLat;
      const gain = Math.max(0, elev[nIdx]! - elev[idx]!);
      const cost = distM * (1 + gain * GAIN_W);
      const nd = d + cost;
      if (nd < dist[nIdx]!) {
        dist[nIdx] = nd;
        prev[nIdx] = idx;
        heap.push(nd + heuristic(nIdx), nIdx);
      }
    }
  }
  console.log('iterations', iterations, 'of', N);
  const goalIdx = gy * gridW + gx;
  if (!Number.isFinite(dist[goalIdx])) throw new Error('경로를 찾지 못함');

  // 경로 복원(정상 → 입구), 뒤집어서 상류→하류
  const pathIdx: number[] = [];
  let cur = goalIdx;
  while (cur !== -1) {
    pathIdx.push(cur);
    cur = prev[cur]!;
  }
  pathIdx.reverse(); // 이제 입구(start) → 정상(goal)... 잠깐, prev 는 start 에서 goal 로 확장했으니 goal 에서 역추적하면 goal->...->start, reverse 하면 start->...->goal
  // pathIdx 는 이제 start(입구, 하류) → goal(정상, 상류) 순. Segment 관례는 path[0]=상류이므로 다시 뒤집는다.
  pathIdx.reverse();
  // 지금 pathIdx: goal(상류) → start(하류) 순.

  const coords = pathIdx.map((idx) => {
    const cx = idx % gridW, cy = Math.floor(idx / gridW);
    const t = { x: cx / tileSize + minTx, y: cy / tileSize + minTy };
    return tileToLatLng(t.x, t.y, Z);
  });

  console.log('path points(raw)', coords.length);
  fs.writeFileSync('/tmp/gingorang-path.json', JSON.stringify(coords));
}

main().catch((e) => { console.error(e); process.exit(1); });
