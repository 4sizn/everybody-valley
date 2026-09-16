/**
 * 제보(현장 게시) — F5a. 계정 없이 닉네임 + 비밀번호(해시)로 쓴다(`docs/TODO.md` F5 결정 (a)).
 *
 * `POST /` 는 multipart(사진 0~3장) 또는 JSON(사진 없음) 둘 다 받는다. 사진은 서버가 리사이즈·EXIF
 * 제거(`../../reports/photos`) 후 `uploadsDir` 에 저장하고 원본은 버린다. 비밀번호는 해시로만
 * 저장(`../../reports/passwords`)하고 응답에는 절대 싣지 않는다. 남용 방지는 레이트리밋뿐이다
 * (자동 만료·신고 누적 자동 숨김 없음, 결정 (h)) — `deps.rateLimiter` 가 그 규칙(IP 당 10분 3건·
 * 하루 20건)을 들고, 여기서는 미들웨어로 붙이기만 한다.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  isReportCoordinateInRange,
  isReportType,
  isValidReportBody,
  isValidReportCoordinatePair,
  isValidReportPhotoBytes,
  isValidReportPhotoCount,
  isWithinReportCoordinateRadius,
  LngLat,
  type Logger,
  REPORT_COORDINATE_MAX_DISTANCE_M,
  REPORT_MAX_PHOTOS,
  REPORT_PHOTO_MAX_BYTES,
  type ReportFieldError,
  validateReportDraft,
} from '@modu-valley/core';
import type { Context } from 'hono';
import { Hono } from 'hono';
import type { ReportCursor, ReportWithPhotos, Repos } from '../../db/repos';
import { decodeReportCursor, encodeReportCursor } from '../../db/repos';
import type { EventHub } from '../../events/EventHub';
import type { ReportPhotoRecord, ReportRecord } from '../../records';
import { hashReportPassword, verifyReportPassword } from '../../reports/passwords';
import { processReportPhoto } from '../../reports/photos';
import { clientIp, type RateLimiter, rateLimit } from '../rateLimit';

export interface ReportsRouteDeps {
  readonly repos: Repos;
  readonly hub: EventHub;
  /** 사진 저장 디렉터리(정적 서빙은 `uploadsRoutes`). */
  readonly uploadsDir: string;
  /** `data/valleys/*.geojson` 에서 읽은 유효 계곡 id(`../../valleys`). */
  readonly knownValleyIds: ReadonlySet<string>;
  /** 계곡별 중심선(`../../valleys`) — 제보 좌표(F5d)가 반경 3km 안인지 검증하는 재료. */
  readonly valleyCenterlines: ReadonlyMap<string, readonly LngLat[]>;
  readonly logger: Logger;
  readonly trustProxy: boolean;
  /** 제보 쓰기 전용 레이트리밋(결정 (h)) — `/api/*` 공통 한도와 별개로 `POST /` 에만 붙는다. */
  readonly rateLimiter: RateLimiter;
  readonly now?: () => number;
}

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 50;

/**
 * `includeHidden` 은 관리자 목록(OPS1, `admin.ts`)에서만 참이다 — 일반 응답 모양(F5a)에는
 * `hidden` 필드가 없다는 기존 계약을 그대로 지킨다.
 */
export function toApiReport(
  report: ReportWithPhotos,
  options: { readonly includeHidden?: boolean } = {},
): Record<string, unknown> {
  return {
    id: report.id,
    valleyId: report.valleyId,
    segmentId: report.segmentId,
    type: report.type,
    body: report.body,
    nickname: report.nickname,
    createdAt: report.createdAt,
    // F5d — 둘 다 있거나 둘 다 없다. `null` 이면 필드 자체를 생략해 기존(F5a) 응답 모양과
    // 그대로 호환한다(좌표 없는 제보의 회귀 계약).
    ...(report.lat === null || report.lng === null ? {} : { lat: report.lat, lng: report.lng }),
    ...(options.includeHidden ? { hidden: report.hidden } : {}),
    photos: report.photos.map((p) => ({
      id: p.id,
      url: `/uploads/${p.filename}`,
      width: p.width,
      height: p.height,
      bytes: p.bytes,
      order: p.order,
    })),
  };
}

export function parseLimit(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIST_LIMIT;
  return Math.min(Math.floor(n), MAX_LIST_LIMIT);
}

interface CreateReportFields {
  readonly valleyId: string;
  readonly segmentId?: string;
  readonly type: string;
  readonly body: string;
  readonly nickname: string;
  readonly password: string;
  /** 제보 지점(F5d) — 선택 사항. 한쪽만 있으면 이후 검증(`resolveReportCoordinate`)이 거절한다. */
  readonly lat?: number;
  readonly lng?: number;
}

interface RawPhoto {
  readonly data: Buffer;
}

type ParseOutcome =
  | {
      readonly ok: true;
      readonly fields: CreateReportFields;
      readonly photos: readonly RawPhoto[];
    }
  | { readonly ok: false };

function fieldsOf(get: (key: string) => string): Omit<CreateReportFields, 'lat' | 'lng'> {
  const segmentId = get('segmentId');
  return {
    valleyId: get('valleyId'),
    ...(segmentId ? { segmentId } : {}),
    type: get('type'),
    body: get('body'),
    nickname: get('nickname'),
    password: get('password'),
  };
}

/**
 * `lat`/`lng` 를 원시 값(문자열이든 숫자든)에서 읽는다. multipart 는 폼 문자열로, JSON 은
 * 숫자로 온다 — 둘 다 이 한 함수로 좁힌다. 값이 아예 없으면 키를 만들지 않는다(해석 1,
 * "없으면 무효가 아니다"). 있는데 수가 아니면(오입력) `NaN` 을 그대로 남겨 이후 범위 검사
 * (`isReportCoordinateInRange`)가 거절하게 한다 — 여기서 따로 예외를 만들지 않는다.
 */
function coordinateFieldsOf(
  getRaw: (key: string) => unknown,
): Pick<CreateReportFields, 'lat' | 'lng'> {
  const toNumber = (raw: unknown): number | undefined => {
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string' && raw.trim().length > 0) return Number(raw);
    return undefined;
  };
  const lat = toNumber(getRaw('lat'));
  const lng = toNumber(getRaw('lng'));
  return { ...(lat !== undefined ? { lat } : {}), ...(lng !== undefined ? { lng } : {}) };
}

async function parseMultipartCreateRequest(c: Context): Promise<ParseOutcome> {
  const body = await c.req.parseBody({ all: true });
  const raw = (key: string): unknown => {
    const value = body[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const str = (key: string): string => {
    const first = raw(key);
    return typeof first === 'string' ? first : '';
  };
  const files = (
    Array.isArray(body['photos'])
      ? body['photos']
      : body['photos'] === undefined
        ? []
        : [body['photos']]
  ).filter((v): v is File => v instanceof File);
  const photos: RawPhoto[] = [];
  for (const file of files) photos.push({ data: Buffer.from(await file.arrayBuffer()) });
  return { ok: true, fields: { ...fieldsOf(str), ...coordinateFieldsOf(raw) }, photos };
}

async function parseJsonCreateRequest(c: Context): Promise<ParseOutcome> {
  try {
    const json = (await c.req.json()) as Record<string, unknown>;
    const str = (key: string): string =>
      typeof json[key] === 'string' ? (json[key] as string) : '';
    return {
      ok: true,
      fields: { ...fieldsOf(str), ...coordinateFieldsOf((key) => json[key]) },
      photos: [],
    };
  } catch {
    return { ok: false };
  }
}

function parseCreateRequest(c: Context): Promise<ParseOutcome> {
  const contentType = c.req.header('content-type') ?? '';
  return contentType.includes('multipart/form-data')
    ? parseMultipartCreateRequest(c)
    : parseJsonCreateRequest(c);
}

/** `invalid_photo_count`·`invalid_photo_size` 판정만 — 필드 검증은 core `validateReportDraft`. */
function validatePhotos(photos: readonly RawPhoto[]): Record<string, unknown> | null {
  if (!isValidReportPhotoCount(photos.length)) {
    return { error: 'invalid_photo_count', max: REPORT_MAX_PHOTOS };
  }
  const oversize = photos.find((p) => !isValidReportPhotoBytes(p.data.byteLength));
  if (oversize) return { error: 'invalid_photo_size', maxBytes: REPORT_PHOTO_MAX_BYTES };
  return null;
}

/** 사진을 리사이즈·EXIF 제거해 디스크에 쓰고 그 결과를 레코드로 돌려준다(순서 그대로). */
async function saveProcessedPhotos(
  reportId: string,
  photos: readonly RawPhoto[],
  uploadsDir: string,
): Promise<ReportPhotoRecord[]> {
  const processed = await Promise.all(photos.map((p) => processReportPhoto(p.data)));
  await fs.mkdir(uploadsDir, { recursive: true });
  const records: ReportPhotoRecord[] = [];
  for (const [order, p] of processed.entries()) {
    const photoId = randomUUID();
    const filename = `${photoId}.jpg`;
    await fs.writeFile(path.join(uploadsDir, filename), p.data);
    records.push({
      id: photoId,
      reportId,
      filename,
      width: p.width,
      height: p.height,
      bytes: p.bytes,
      order,
    });
  }
  return records;
}

/** 계곡 중심선에서 반경 밖이면 오류 본문, 안이면 `null`(F5d 해석 4). */
function coordinateRadiusError(
  lat: number,
  lng: number,
  valleyId: string,
  centerlines: ReadonlyMap<string, readonly LngLat[]>,
): Record<string, unknown> | null {
  const centerline = centerlines.get(valleyId) ?? [];
  const point = LngLat.create(lng, lat);
  if (point.ok && isWithinReportCoordinateRadius(point.value, centerline)) return null;
  return { error: 'invalid_coordinate_radius', maxDistanceM: REPORT_COORDINATE_MAX_DISTANCE_M };
}

type CoordinateOutcome =
  | { readonly ok: true; readonly lat: number | null; readonly lng: number | null }
  | { readonly ok: false; readonly body: Record<string, unknown> };

/**
 * 좌표 짝 여부·한국 범위·계곡 반경(F5d 해석 1·4)을 한 곳에서 검증한다. `lat`/`lng` 가 둘
 * 다 없으면 유효한 "좌표 없음" — `{ lat: null, lng: null }`(POST 전용, `valleyId` 는 이미
 * `invalid_valley` 검사를 통과했다고 가정한다).
 */
function resolveReportCoordinate(
  lat: number | undefined,
  lng: number | undefined,
  valleyId: string,
  centerlines: ReadonlyMap<string, readonly LngLat[]>,
): CoordinateOutcome {
  if (!isValidReportCoordinatePair(lat, lng)) {
    return { ok: false, body: { error: 'invalid_coordinate_pair' } };
  }
  if (lat === undefined || lng === undefined) return { ok: true, lat: null, lng: null };
  if (!isReportCoordinateInRange(lat, lng)) {
    return { ok: false, body: { error: 'invalid_coordinate_range' } };
  }
  const radiusError = coordinateRadiusError(lat, lng, valleyId, centerlines);
  if (radiusError) return { ok: false, body: radiusError };
  return { ok: true, lat, lng };
}

function publishReportCreated(hub: EventHub, report: ReportWithPhotos): void {
  hub.publish('report', {
    report: {
      id: report.id,
      valleyId: report.valleyId,
      type: report.type,
      nickname: report.nickname,
      createdAt: report.createdAt,
    },
  });
}

type PasswordAuth = 'not_found' | 'mismatch' | 'ok';

/** 삭제·수정 공통 인증 — 해시 대조는 여기서만 한다. */
async function authorizeByPassword(
  repos: Repos,
  id: string,
  password: string,
): Promise<PasswordAuth> {
  const storedHash = repos.reports.passwordHashOf(id);
  if (storedHash === undefined) return 'not_found';
  if (!password || !(await verifyReportPassword(password, storedHash))) return 'mismatch';
  return 'ok';
}

type PatchFields = {
  readonly type?: string;
  readonly body?: string;
  /** `null` 이면 좌표를 지운다(둘 다 함께). 반경 검증은 여기가 아니라 라우트가 한다
   * (그 계곡 중심선을 알려면 기존 레코드의 `valleyId` 가 필요해서 — F5d). */
  readonly lat?: number | null;
  readonly lng?: number | null;
};
type PatchOutcome =
  | { readonly ok: true; readonly patch: PatchFields }
  | { readonly ok: false; readonly body: Record<string, unknown> };

function fieldError(field: ReportFieldError['field'], reason: string): Record<string, unknown> {
  const errors: ReportFieldError[] = [{ field, reason }];
  return { error: 'invalid_field', errors };
}

type PatchCoordinateOutcome =
  | { readonly present: false }
  | {
      readonly present: true;
      readonly ok: true;
      readonly lat: number | null;
      readonly lng: number | null;
    }
  | { readonly present: true; readonly ok: false; readonly body: Record<string, unknown> };

/**
 * PATCH 페이로드의 `lat`/`lng` 만 떼어 짝 여부·한국 범위를 본다(반경은 그 계곡을 알아야 해서
 * 라우트가 마저 한다 — F5d). 키가 아예 없으면 `present: false`(좌표는 건드리지 않는다).
 */
function readPatchCoordinate(payload: {
  readonly lat?: unknown;
  readonly lng?: unknown;
}): PatchCoordinateOutcome {
  if (payload.lat === undefined && payload.lng === undefined) return { present: false };
  const latOk = payload.lat === null || typeof payload.lat === 'number';
  const lngOk = payload.lng === null || typeof payload.lng === 'number';
  if (!latOk || !lngOk) {
    return { present: true, ok: false, body: { error: 'invalid_coordinate_pair' } };
  }
  const lat = payload.lat === null ? null : (payload.lat as number);
  const lng = payload.lng === null ? null : (payload.lng as number);
  if (!isValidReportCoordinatePair(lat, lng)) {
    return { present: true, ok: false, body: { error: 'invalid_coordinate_pair' } };
  }
  if (lat !== null && lng !== null && !isReportCoordinateInRange(lat, lng)) {
    return { present: true, ok: false, body: { error: 'invalid_coordinate_range' } };
  }
  return { present: true, ok: true, lat, lng };
}

/**
 * 본문·유형(결정 (g)) + 좌표(F5d)를 수정 대상으로 받는다 — 반경 검증만 빠져 있다(라우트가
 * DB 를 조회해 마저 한다). 아무 필드도 없으면 `nothing_to_update`.
 */
function buildReportPatch(payload: {
  readonly type?: unknown;
  readonly body?: unknown;
  readonly lat?: unknown;
  readonly lng?: unknown;
}): PatchOutcome {
  const patch: { type?: string; body?: string; lat?: number | null; lng?: number | null } = {};
  if (typeof payload.type === 'string') {
    if (!isReportType(payload.type)) {
      return { ok: false, body: fieldError('type', '유형이 올바르지 않습니다') };
    }
    patch.type = payload.type;
  }
  if (typeof payload.body === 'string') {
    if (!isValidReportBody(payload.body)) {
      return { ok: false, body: fieldError('body', '본문 길이가 올바르지 않습니다') };
    }
    patch.body = payload.body.trim();
  }
  const coordinate = readPatchCoordinate(payload);
  if (coordinate.present) {
    if (!coordinate.ok) return { ok: false, body: coordinate.body };
    patch.lat = coordinate.lat;
    patch.lng = coordinate.lng;
  }
  if (Object.keys(patch).length === 0) return { ok: false, body: { error: 'nothing_to_update' } };
  return { ok: true, patch };
}

type PatchCoordinateGuard =
  | { readonly ok: true }
  | { readonly ok: false; readonly status: 400 | 404; readonly body: Record<string, unknown> };

/**
 * 좌표를 새로 설정하는 patch(지우거나 건드리지 않는 patch 는 대상 없음)만 반경을 본다 —
 * 그 계곡을 알아야 해서(F5d) 기존 레코드가 있어야 한다.
 */
function guardPatchCoordinateRadius(
  patch: PatchFields,
  existing: { readonly valleyId: string } | undefined,
  centerlines: ReadonlyMap<string, readonly LngLat[]>,
): PatchCoordinateGuard {
  if (patch.lat === undefined || patch.lat === null) return { ok: true };
  if (!existing) return { ok: false, status: 404, body: { error: 'not_found' } };
  const radiusError = coordinateRadiusError(
    patch.lat,
    patch.lng as number,
    existing.valleyId,
    centerlines,
  );
  return radiusError ? { ok: false, status: 400, body: radiusError } : { ok: true };
}

type PatchPrepareOutcome =
  | { readonly ok: true; readonly patch: PatchFields }
  | {
      readonly ok: false;
      readonly status: 400 | 403 | 404;
      readonly body: Record<string, unknown>;
    };

/** PATCH 한 요청의 인증·검증·반경 확인을 전부 묶는다 — 라우트 핸들러는 결과만 적용한다. */
async function preparePatch(
  deps: ReportsRouteDeps,
  id: string,
  payload: PatchPayload,
): Promise<PatchPrepareOutcome> {
  const password = typeof payload.password === 'string' ? payload.password : '';
  const auth = await authorizeByPassword(deps.repos, id, password);
  if (auth === 'not_found') return { ok: false, status: 404, body: { error: 'not_found' } };
  if (auth === 'mismatch') {
    return { ok: false, status: 403, body: { error: 'password_mismatch' } };
  }

  const outcome = buildReportPatch(payload);
  if (!outcome.ok) return { ok: false, status: 400, body: outcome.body };

  // 좌표를 새로 설정하는 경우만(지우는 경우·건드리지 않는 경우는 대상 없음) 반경을 본다 —
  // 그 계곡을 알아야 해서(F5d) 기존 레코드를 한 번 더 읽는다.
  const needsExisting = outcome.patch.lat !== undefined && outcome.patch.lat !== null;
  const existing = needsExisting ? deps.repos.reports.get(id) : undefined;
  const guard = guardPatchCoordinateRadius(outcome.patch, existing, deps.valleyCenterlines);
  if (!guard.ok) return { ok: false, status: guard.status, body: guard.body };

  return { ok: true, patch: outcome.patch };
}

async function removePhotoFiles(
  logger: Logger,
  uploadsDir: string,
  photos: readonly { readonly filename: string }[],
): Promise<void> {
  await Promise.all(
    photos.map(async (p) => {
      try {
        await fs.rm(path.join(uploadsDir, p.filename), { force: true });
      } catch (error) {
        logger.warn('제보 사진 파일 삭제 실패', { filename: p.filename, error: String(error) });
      }
    }),
  );
}

async function readPasswordPayload(c: Context): Promise<string> {
  try {
    const payload = (await c.req.json()) as { password?: unknown };
    return typeof payload.password === 'string' ? payload.password : '';
  } catch {
    return '';
  }
}

type PatchPayload = {
  readonly password?: unknown;
  readonly type?: unknown;
  readonly body?: unknown;
  readonly lat?: unknown;
  readonly lng?: unknown;
};

/** JSON 이 아니면(파싱 실패) `null` — 호출자는 `bad_request` 로 다룬다. */
async function readPatchPayload(c: Context): Promise<PatchPayload | null> {
  try {
    return (await c.req.json()) as PatchPayload;
  } catch {
    return null;
  }
}

export function reportsRoutes(deps: ReportsRouteDeps): Hono {
  const app = new Hono();
  const now = deps.now ?? Date.now;

  app.get('/', (c) => {
    const valleyId = c.req.query('valleyId') || undefined;
    const limit = parseLimit(c.req.query('limit'));
    const cursorRaw = c.req.query('cursor');
    let before: ReportCursor | undefined;
    if (cursorRaw) {
      const decoded = decodeReportCursor(cursorRaw);
      if (!decoded) return c.json({ error: 'bad_cursor' }, 400);
      before = decoded;
    }
    const rows = deps.repos.reports.list({
      ...(valleyId ? { valleyId } : {}),
      limit: limit + 1,
      ...(before ? { before } : {}),
    });
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    const nextCursor =
      rows.length > limit && last
        ? encodeReportCursor({ createdAt: last.createdAt, id: last.id })
        : null;
    return c.json({ count: page.length, reports: page.map((r) => toApiReport(r)), nextCursor });
  });

  app.get('/:id', (c) => {
    const report = deps.repos.reports.get(c.req.param('id'));
    if (!report || report.hidden) return c.json({ error: 'not_found' }, 404);
    return c.json(toApiReport(report));
  });

  app.post(
    '/',
    rateLimit({ limiter: deps.rateLimiter, trustProxy: deps.trustProxy }),
    async (c) => {
      const parsed = await parseCreateRequest(c);
      if (!parsed.ok) return c.json({ error: 'bad_request' }, 400);
      const { fields, photos } = parsed;

      if (!fields.valleyId || !deps.knownValleyIds.has(fields.valleyId)) {
        return c.json({ error: 'invalid_valley' }, 400);
      }
      const photoError = validatePhotos(photos);
      if (photoError) return c.json(photoError, 400);
      const fieldErrors = validateReportDraft({
        type: fields.type,
        body: fields.body,
        nickname: fields.nickname,
        password: fields.password,
        photoCount: photos.length,
      });
      if (fieldErrors.length > 0) {
        return c.json({ error: 'invalid_field', errors: fieldErrors }, 400);
      }
      const coordinate = resolveReportCoordinate(
        fields.lat,
        fields.lng,
        fields.valleyId,
        deps.valleyCenterlines,
      );
      if (!coordinate.ok) return c.json(coordinate.body, 400);

      const id = randomUUID();
      const passwordHash = await hashReportPassword(fields.password);
      const photoRecords = await saveProcessedPhotos(id, photos, deps.uploadsDir);
      const record: ReportRecord = {
        id,
        valleyId: fields.valleyId,
        segmentId: fields.segmentId ?? null,
        type: fields.type,
        body: fields.body.trim(),
        nickname: fields.nickname.trim(),
        passwordHash,
        lat: coordinate.lat,
        lng: coordinate.lng,
        createdAt: new Date(now()).toISOString(),
        ip: clientIp(c, deps.trustProxy),
        hidden: false,
      };
      deps.repos.reports.create(record, photoRecords);
      const created = deps.repos.reports.get(id);
      if (!created) {
        deps.logger.error('제보 저장 직후 조회 실패', undefined, { id });
        return c.json({ error: 'internal' }, 500);
      }
      publishReportCreated(deps.hub, created);
      return c.json(toApiReport(created), 201);
    },
  );

  app.patch('/:id', async (c) => {
    const id = c.req.param('id');
    const payload = await readPatchPayload(c);
    if (payload === null) return c.json({ error: 'bad_request' }, 400);

    const prepared = await preparePatch(deps, id, payload);
    if (!prepared.ok) return c.json(prepared.body, prepared.status);

    deps.repos.reports.update(id, prepared.patch);
    const updated = deps.repos.reports.get(id);
    if (!updated) return c.json({ error: 'not_found' }, 404);
    return c.json(toApiReport(updated));
  });

  app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const password = await readPasswordPayload(c);
    const auth = await authorizeByPassword(deps.repos, id, password);
    if (auth === 'not_found') return c.json({ error: 'not_found' }, 404);
    if (auth === 'mismatch') return c.json({ error: 'password_mismatch' }, 403);

    const existing = deps.repos.reports.get(id);
    deps.repos.reports.delete(id);
    if (existing) await removePhotoFiles(deps.logger, deps.uploadsDir, existing.photos);
    return c.json({ ok: true });
  });

  app.post('/:id/flag', async (c) => {
    const id = c.req.param('id');
    const existing = deps.repos.reports.get(id);
    if (!existing) return c.json({ error: 'not_found' }, 404);
    let reason: string | null = null;
    try {
      const payload = (await c.req.json()) as { reason?: unknown };
      if (typeof payload.reason === 'string' && payload.reason.trim().length > 0) {
        reason = payload.reason.trim();
      }
    } catch {
      // 본문 없이도 접수만 하면 된다.
    }
    deps.repos.reports.addFlag({
      reportId: id,
      reason,
      createdAt: new Date(now()).toISOString(),
      ip: clientIp(c, deps.trustProxy),
    });
    return c.json({ ok: true }, 201);
  });

  return app;
}
