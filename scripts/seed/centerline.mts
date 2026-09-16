/**
 * OSM 하천 way 들 → 계곡 점을 지나는 **본류 중심선** 한 줄 → 상류 2 km · 하류 1 km 절단 (결정 (b) B1).
 *
 * 방법
 *   1. 계곡 점에 가장 가까운 way 로 시작한다.
 *   2. 양 끝 노드에서 같은 노드를 공유하는 way 를 이어 붙인다. 갈림(합류점)에서는 같은 `name` 인
 *      가지, 없으면 가장 긴 가지를 고른다(본류 근사). 한쪽 3 km 를 넘으면 멈춘다.
 *   3. 방향은 OSM 규약(하천 way 는 하류 방향으로 그린다)을 따르고, Terrarium 표고로 검증한다 —
 *      시작점이 끝점보다 20 m 넘게 낮으면 뒤집고 경고한다.
 *   4. 계곡 점을 선에 투영한 자리에서 상류 2 km, 하류 1 km 를 잘라 낸다(선이 짧으면 있는 만큼).
 *
 * 결과는 OSM 정점을 그대로 쓴다(단순화 없음). 좌표 소수 6자리(≈ 0.1 m).
 */

import { elevationAt } from './elevation.mts';
import type { Keys } from './env.mts';
import { distanceM, lineLengthM, type Position, projectOnLine, round6, sliceLine } from './geo.mts';
import type { OsmWay } from './overpass.mts';

export const UPSTREAM_M = 2000;
export const DOWNSTREAM_M = 1000;
/** 한쪽으로 이어 붙이는 최대 길이 — 절단 범위보다 넉넉하게. */
const EXTEND_MAX_M = 3000;
/** 표고로 방향을 뒤집는 문턱(m). Terrarium z12 오차(±20~40 m)를 감안해 크게 잡는다. */
const FLIP_MIN_DROP_M = 20;

export interface Centerline {
  /** 상류 → 하류. */
  readonly path: readonly Position[];
  /** 절단 전 이어 붙인 way 들(OSM id). 출처 추적용. */
  readonly wayIds: readonly number[];
  /** 이어 붙인 way 들의 name 집합. */
  readonly names: readonly string[];
  /** 계곡 점에서 선까지 거리(m). */
  readonly offsetM: number;
  /** 잘라 낸 선의 길이(m). */
  readonly lengthM: number;
  /** 표고 검증으로 방향을 뒤집었는가. */
  readonly flipped: boolean;
  /** 상·하류 끝 표고(m). */
  readonly elevation: { readonly start: number; readonly end: number };
}

interface Chain {
  points: Position[];
  /** 체인의 시작 노드·끝 노드(OSM node id). */
  startNode: number;
  endNode: number;
  wayIds: number[];
  names: Set<string>;
}

function firstNode(way: OsmWay): number | undefined {
  return way.nodes[0];
}

function lastNode(way: OsmWay): number | undefined {
  return way.nodes[way.nodes.length - 1];
}

/** `node` 에 닿는 다른 way 들 중 이어 붙일 하나 — 같은 이름 우선, 없으면 가장 긴 것. */
function pickContinuation(
  node: number,
  ways: readonly OsmWay[],
  used: ReadonlySet<number>,
  currentName: string | undefined,
): OsmWay | undefined {
  const candidates = ways.filter(
    (way) => !used.has(way.id) && (firstNode(way) === node || lastNode(way) === node),
  );
  if (candidates.length === 0) return undefined;
  if (currentName !== undefined) {
    const sameName = candidates.find((way) => way.tags['name'] === currentName);
    if (sameName !== undefined) return sameName;
  }
  return candidates.reduce((best, way) =>
    lineLengthM(way.geometry) > lineLengthM(best.geometry) ? way : best,
  );
}

/** 체인 끝(`atEnd`)에 way 를 붙인다. way 의 방향은 접점에 맞춰 뒤집는다. */
function attach(chain: Chain, way: OsmWay, atEnd: boolean): void {
  const forward = atEnd ? firstNode(way) === chain.endNode : lastNode(way) === chain.startNode;
  const points = forward ? [...way.geometry] : [...way.geometry].reverse();
  const nodes = forward ? [...way.nodes] : [...way.nodes].reverse();
  if (atEnd) {
    chain.points.push(...points.slice(1));
    chain.endNode = nodes[nodes.length - 1] ?? chain.endNode;
  } else {
    chain.points.unshift(...points.slice(0, -1));
    chain.startNode = nodes[0] ?? chain.startNode;
  }
  chain.wayIds.push(way.id);
  const name = way.tags['name'];
  if (name !== undefined) chain.names.add(name);
}

/**
 * 하류 끝이 다른 way 의 **중간 노드**에 닿는 경우(지류가 본류 옆구리로 합류) — 본류 way 를 그 노드에서
 * 잘라 하류 쪽 절반을 이어 붙인다. OSM 하천 way 는 하류 방향이므로 노드 뒤쪽이 하류다.
 * 상류 쪽에서는 하지 않는다 — 합류점 위로 어느 지류가 본류인지 이 자료만으로는 모른다.
 */
function attachDownstreamFromInterior(
  chain: Chain,
  ways: readonly OsmWay[],
  used: Set<number>,
): number {
  for (const way of ways) {
    if (used.has(way.id)) continue;
    const index = way.nodes.indexOf(chain.endNode);
    if (index <= 0 || index >= way.nodes.length - 1) continue;
    const tail: OsmWay = {
      id: way.id,
      nodes: way.nodes.slice(index),
      geometry: way.geometry.slice(index),
      tags: way.tags,
    };
    used.add(way.id);
    attach(chain, tail, true);
    return lineLengthM(tail.geometry);
  }
  return 0;
}

function extend(chain: Chain, ways: readonly OsmWay[], used: Set<number>, atEnd: boolean): void {
  let extended = 0;
  const name = [...chain.names][0];
  while (extended < EXTEND_MAX_M) {
    const node = atEnd ? chain.endNode : chain.startNode;
    const next = pickContinuation(node, ways, used, name);
    if (next === undefined) {
      const interior = atEnd ? attachDownstreamFromInterior(chain, ways, used) : 0;
      if (interior === 0) break;
      extended += interior;
      continue;
    }
    used.add(next.id);
    extended += lineLengthM(next.geometry);
    attach(chain, next, atEnd);
  }
}

/** 계곡 점을 지나는 본류 중심선. way 가 없으면 `undefined`. */
export async function buildCenterline(
  ways: readonly OsmWay[],
  center: Position,
  keys: Keys,
): Promise<Centerline | undefined> {
  const usable = ways.filter(
    (way) => way.geometry.length >= 2 && way.nodes.length === way.geometry.length,
  );
  if (usable.length === 0) return undefined;
  const seed = usable.reduce((best, way) =>
    projectOnLine(way.geometry, center).distance < projectOnLine(best.geometry, center).distance
      ? way
      : best,
  );
  const chain: Chain = {
    points: [...seed.geometry],
    startNode: firstNode(seed) ?? -1,
    endNode: lastNode(seed) ?? -1,
    wayIds: [seed.id],
    names: new Set(seed.tags['name'] === undefined ? [] : [seed.tags['name']]),
  };
  const used = new Set<number>([seed.id]);
  extend(chain, usable, used, false);
  extend(chain, usable, used, true);

  // OSM 규약: 하천 way 는 하류 방향. 표고로 검증한다.
  let path = chain.points;
  const startElevation = await elevationAt(path[0] as Position, keys);
  const endElevation = await elevationAt(path[path.length - 1] as Position, keys);
  const flipped = endElevation - startElevation > FLIP_MIN_DROP_M;
  if (flipped) path = [...path].reverse();

  const projection = projectOnLine(path, center);
  const cut = sliceLine(path, projection.along - UPSTREAM_M, projection.along + DOWNSTREAM_M).map(
    (point): Position => [round6(point[0]), round6(point[1])],
  );
  // 절단 후 같은 점이 연속되면(보간 끝점이 정점과 겹침) 하나로.
  const deduped = cut.filter(
    (point, index) => index === 0 || distanceM(point, cut[index - 1] as Position) > 0.05,
  );
  const finalPath = deduped.length >= 2 ? deduped : cut;
  return {
    path: finalPath,
    wayIds: chain.wayIds,
    names: [...chain.names],
    offsetM: Math.round(projection.distance),
    lengthM: Math.round(lineLengthM(finalPath)),
    flipped,
    elevation: {
      start: flipped ? endElevation : startElevation,
      end: flipped ? startElevation : endElevation,
    },
  };
}
