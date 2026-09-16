/**
 * 지연 마커 아이콘 로더
 * spotts.kr/firework의 setupLazyMarkerIconLoader 패턴 재구현.
 *
 * 핵심:
 *  - 스프라이트를 굽지 않는다. 아이콘 ID가 곧 명세이고, 없는 ID가 요청되면 그 자리에서 SVG를 만든다.
 *  - 맵 인스턴스당 resolver 레지스트리를 두고 여러 레이어가 공유한다.
 *  - 테마가 바뀌면 같은 ID로 다시 그려 넣는다 (레이어 스펙은 건드리지 않음).
 *
 * 요구: maplibre-gl v6 (setMissingStyleImageResolver). v5는 아래 폴백 참고.
 */

import type { Map as MapLibreMap } from "maplibre-gl";

export const MARKER_ICON_DP = 40;
export const MARKER_ICON_PIXEL_RATIO = 2;
export const MARKER_ICON_RASTER_PX = MARKER_ICON_DP * MARKER_ICON_PIXEL_RATIO; // 80

export const MARKER_STROKE = { light: "#ffffff", dark: "#1c1c1e" } as const;
export type ThemeMode = keyof typeof MARKER_STROKE;

/** id → SVG 문자열. 모르는 id면 null을 돌려주면 된다. */
export type SvgResolver = (id: string) => string | null;

type Registry = {
  resolvers: Set<(id: string) => Promise<void>>;
  resolve: (id: string) => Promise<void>;
};

const registries = new WeakMap<MapLibreMap, Registry>();

function alive(map: MapLibreMap): boolean {
  // 스타일이 날아간 뒤(언마운트/스타일 교체 중) addImage 하면 터진다
  return Boolean(map && (map as unknown as { style?: unknown }).style);
}

async function svgToBitmap(svg: string): Promise<ImageBitmap> {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  return createImageBitmap(blob);
}

function ensureRegistry(map: MapLibreMap): Registry {
  const existing = registries.get(map);
  if (existing) return existing;

  const resolvers = new Set<(id: string) => Promise<void>>();
  const resolve = async (id: string) => {
    await Promise.all(Array.from(resolvers, (r) => r(id)));
  };
  const registry: Registry = { resolvers, resolve };
  registries.set(map, registry);

  // v6 API. v5라면: map.on("styleimagemissing", (e) => void resolve(e.id))
  map.setMissingStyleImageResolver(resolve);
  return registry;
}

/**
 * 아이콘 resolver 하나를 등록한다.
 * @returns 해제 함수. 언마운트 시 반드시 호출할 것.
 */
export function setupLazyMarkerIcons(
  map: MapLibreMap,
  buildSvg: SvgResolver,
): () => void {
  const pending = new Map<string, Promise<void>>();

  const resolver = async (id: string) => {
    if (!alive(map) || map.hasImage(id)) return;

    const inflight = pending.get(id);
    if (inflight) return inflight; // 같은 id 동시 요청 차단

    const svg = buildSvg(id);
    if (!svg) return; // 내 담당이 아닌 id

    const task = svgToBitmap(svg)
      .then((bitmap) => {
        if (alive(map) && !map.hasImage(id)) {
          map.addImage(id, bitmap, { pixelRatio: MARKER_ICON_PIXEL_RATIO });
        }
      })
      .catch((err) => {
        console.error("failed to build marker icon", id, err);
      });

    pending.set(id, task);
    try {
      await task;
    } finally {
      pending.delete(id);
    }
  };

  const registry = ensureRegistry(map);
  registry.resolvers.add(resolver);

  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    registry.resolvers.delete(resolver);
    if (registry.resolvers.size === 0) {
      if (alive(map)) map.setMissingStyleImageResolver(null);
      registries.delete(map);
    }
  };
}

/** 첫 렌더 전에 확실히 쓸 아이콘만 미리 굽는다. */
export async function preloadMarkerIcons(
  map: MapLibreMap,
  icons: Array<{ id: string; svg: string }>,
): Promise<boolean> {
  let added = false;
  await Promise.all(
    icons.map(async ({ id, svg }) => {
      if (!alive(map) || map.hasImage(id)) return;
      try {
        const bitmap = await svgToBitmap(svg);
        if (alive(map) && !map.hasImage(id)) {
          map.addImage(id, bitmap, { pixelRatio: MARKER_ICON_PIXEL_RATIO });
          added = true;
        }
      } catch (err) {
        console.error("failed to preload marker icon", id, err);
      }
    }),
  );
  return added;
}

/** 테마 전환 — 같은 ID에 다시 그려 넣는다. */
export async function refreshMarkerIcons(
  map: MapLibreMap,
  icons: Array<{ id: string; svg: string }>,
): Promise<void> {
  await Promise.all(
    icons.map(async ({ id, svg }) => {
      if (!alive(map)) return;
      try {
        const bitmap = await svgToBitmap(svg);
        if (!alive(map)) return;
        if (map.hasImage(id)) map.updateImage(id, bitmap);
        else map.addImage(id, bitmap, { pixelRatio: MARKER_ICON_PIXEL_RATIO });
      } catch (err) {
        console.error("failed to refresh marker icon", id, err);
      }
    }),
  );
  if (alive(map)) map.triggerRepaint();
}

/** 접두사로 등록된 아이콘을 전부 다시 굽는다. */
export async function refreshMarkerIconsByPrefix(
  map: MapLibreMap,
  prefix: string,
  buildSvg: SvgResolver,
): Promise<void> {
  if (!alive(map)) return;
  const targets = map
    .listImages()
    .filter((id) => id.startsWith(prefix))
    .flatMap((id) => {
      const svg = buildSvg(id);
      return svg ? [{ id, svg }] : [];
    });
  await refreshMarkerIcons(map, targets);
}

/**
 * 아이콘 로딩이 끝난 뒤 심볼 레이어의 필터를 강제 재평가시킨다.
 * (아이콘이 늦게 들어오면 이미 배치가 끝난 심볼이 갱신되지 않는 경우가 있음)
 */
export function revalidateSymbolLayers(map: MapLibreMap, layerIds: string[]): void {
  if (!alive(map)) return;
  for (const id of layerIds) {
    if (map.getLayer(id)) map.setFilter(id, map.getFilter(id) ?? null);
  }
}

/* ────────────────────────────────────────────────────────────
   아이콘 ID 규약 예시 — 계곡용
   ────────────────────────────────────────────────────────────

   valley-marker:spot
   valley-marker:spot-selected
   valley-marker:facility:parking
   valley-marker:facility:restroom
   crowd-marker:available | crowd-marker:low | crowd-marker:busy
   crowd-marker:selected:busy

   레이어에서:
     "icon-image": ["concat", "valley-marker:facility:",
        ["match", ["get","facilityType"],
          "parking","parking", "restroom","restroom", "food","food", "etc"]]
   ──────────────────────────────────────────────────────────── */

export const FACILITY_COLOR: Record<string, string> = {
  parking: "#4b5563",
  restroom: "#16a36a",
  food: "#e58b20",
  cafe: "#a66b3d",
  store: "#7b61ff",
  station: "#1597d1",
  access: "#6b5dd3",
  safety: "#d65a5a",
  etc: "#3d7ab8",
};

export const CROWD_COLOR = {
  available: "#2f9e64",
  low: "#e79b38",
  busy: "#d64545",
} as const;

/** 원형 상태 마커 SVG — 40dp 뷰박스를 80px로 렌더 */
export function crowdMarkerSvg(
  level: keyof typeof CROWD_COLOR,
  selected: boolean,
  theme: ThemeMode,
): string {
  const fill = CROWD_COLOR[level];
  const ring = theme === "light" ? "#ffffff" : "#aaaaaa";
  const r = selected ? 16 : 15;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MARKER_ICON_DP} ${MARKER_ICON_DP}"`,
    ` width="${MARKER_ICON_RASTER_PX}" height="${MARKER_ICON_RASTER_PX}">`,
    `<defs><filter id="sd" x="-60%" y="-60%" width="220%" height="220%">`,
    `<feDropShadow dx="0" dy="0.6" stdDeviation="1.5" flood-color="#1c2530" flood-opacity="0.24"/>`,
    `</filter></defs>`,
    `<circle cx="20" cy="20" r="${r}" fill="${ring}" filter="url(#sd)"/>`,
    `<circle cx="20" cy="20" r="${r - 3}" fill="${fill}"/>`,
    `</svg>`,
  ].join("");
}
