/**
 * 테이블별 저장소. SQL 은 여기에만 있다. 모든 다중 행 쓰기는 트랜잭션 하나.
 */
import { type Bbox, bboxOf, isPolygonGeometry } from '../geo/pointInPolygon';
import type {
  AlertRecord,
  BasinRecord,
  FetchLogEntry,
  ObservationRecord,
  ReportFlagRecord,
  ReportFlagSummary,
  ReportPhotoRecord,
  ReportRecord,
  StationKind,
  StationRecord,
} from '../records';
import type { Db } from './Database';

const json = (v: unknown | null): string | null => (v === null ? null : JSON.stringify(v));
const parse = <T>(s: string | null): T | null => (s === null ? null : (JSON.parse(s) as T));

interface StationRow {
  kind: StationKind;
  code: string;
  name: string;
  agency: string | null;
  lng: number | null;
  lat: number | null;
  elevation_m: number | null;
  attrs: string | null;
  suspicious: number;
  updated_at: string;
}

const stationOf = (r: StationRow): StationRecord & { updatedAt: string } => ({
  kind: r.kind,
  code: r.code,
  name: r.name,
  agency: r.agency,
  lng: r.lng,
  lat: r.lat,
  elevationM: r.elevation_m,
  attrs: parse<Record<string, unknown>>(r.attrs),
  suspicious: r.suspicious === 1,
  updatedAt: r.updated_at,
});

export class StationsRepo {
  readonly #db: Db;
  constructor(db: Db) {
    this.#db = db;
  }

  upsertMany(stations: readonly StationRecord[], now: string): number {
    const stmt = this.#db.prepare(
      `INSERT INTO stations (kind, code, name, agency, lng, lat, elevation_m, attrs, suspicious, updated_at)
       VALUES (@kind, @code, @name, @agency, @lng, @lat, @elevation_m, @attrs, @suspicious, @updated_at)
       ON CONFLICT (kind, code) DO UPDATE SET name = excluded.name, agency = excluded.agency, lng = excluded.lng,
         lat = excluded.lat, elevation_m = excluded.elevation_m, attrs = excluded.attrs,
         suspicious = excluded.suspicious, updated_at = excluded.updated_at`,
    );
    this.#db.transaction(() => {
      for (const s of stations) {
        stmt.run({
          kind: s.kind,
          code: s.code,
          name: s.name,
          agency: s.agency,
          lng: s.lng,
          lat: s.lat,
          elevation_m: s.elevationM,
          attrs: json(s.attrs),
          suspicious: s.suspicious ? 1 : 0,
          updated_at: now,
        });
      }
    })();
    return stations.length;
  }

  list(kinds: readonly StationKind[], bbox?: Bbox): (StationRecord & { updatedAt: string })[] {
    if (kinds.length === 0) return [];
    const where = [`kind IN (${kinds.map(() => '?').join(',')})`];
    const params: unknown[] = [...kinds];
    if (bbox) {
      where.push('lng BETWEEN ? AND ? AND lat BETWEEN ? AND ?');
      params.push(bbox.minLng, bbox.maxLng, bbox.minLat, bbox.maxLat);
    }
    const rows = this.#db
      .prepare(`SELECT * FROM stations WHERE ${where.join(' AND ')} ORDER BY kind, code`)
      .all(...params) as StationRow[];
    return rows.map(stationOf);
  }

  count(kind: StationKind): number {
    const r = this.#db.prepare('SELECT COUNT(*) AS n FROM stations WHERE kind = ?').get(kind) as {
      n: number;
    };
    return r.n;
  }
}

interface ObservationRow {
  kind: StationKind;
  code: string;
  observed_at: string;
  value: number | null;
  extra: string | null;
  fetched_at: string;
}

const observationOf = (r: ObservationRow): ObservationRecord & { fetchedAt: string } => ({
  kind: r.kind,
  code: r.code,
  observedAt: r.observed_at,
  value: r.value,
  extra: parse<Record<string, unknown>>(r.extra),
  fetchedAt: r.fetched_at,
});

export class ObservationsRepo {
  readonly #db: Db;
  constructor(db: Db) {
    this.#db = db;
  }

  /** 10분 격자 행을 넣는다(같은 시각은 덮어쓴다). */
  upsertMany(rows: readonly ObservationRecord[], now: string): number {
    const stmt = this.#db.prepare(
      `INSERT INTO observations (kind, code, observed_at, value, extra, fetched_at)
       VALUES (@kind, @code, @observed_at, @value, @extra, @fetched_at)
       ON CONFLICT (kind, code, observed_at) DO UPDATE SET value = excluded.value, extra = excluded.extra,
         fetched_at = excluded.fetched_at`,
    );
    this.#db.transaction(() => {
      for (const o of rows) {
        stmt.run({
          kind: o.kind,
          code: o.code,
          observed_at: o.observedAt,
          value: o.value,
          extra: json(o.extra),
          fetched_at: now,
        });
      }
    })();
    return rows.length;
  }

  /** `observed_at < before` 를 지운다(보존 7일). 지운 행 수. */
  prune(before: string): number {
    return this.#db.prepare('DELETE FROM observations WHERE observed_at < ?').run(before).changes;
  }

  recent(
    kind: StationKind,
    code: string,
    since: string,
  ): (ObservationRecord & { fetchedAt: string })[] {
    const rows = this.#db
      .prepare(
        'SELECT * FROM observations WHERE kind = ? AND code = ? AND observed_at >= ? ORDER BY observed_at DESC',
      )
      .all(kind, code, since) as ObservationRow[];
    return rows.map(observationOf);
  }

  count(): number {
    return (this.#db.prepare('SELECT COUNT(*) AS n FROM observations').get() as { n: number }).n;
  }
}

export class LatestRepo {
  readonly #db: Db;
  constructor(db: Db) {
    this.#db = db;
  }

  /** 관측 시각이 더 새롭거나 같을 때만 덮어쓴다(늦게 온 옛 값이 최신을 밀어내지 않게). */
  upsertMany(rows: readonly ObservationRecord[], now: string): number {
    const stmt = this.#db.prepare(
      `INSERT INTO latest (kind, code, observed_at, value, extra, fetched_at)
       VALUES (@kind, @code, @observed_at, @value, @extra, @fetched_at)
       ON CONFLICT (kind, code) DO UPDATE SET observed_at = excluded.observed_at, value = excluded.value,
         extra = excluded.extra, fetched_at = excluded.fetched_at
       WHERE excluded.observed_at >= latest.observed_at`,
    );
    let changed = 0;
    this.#db.transaction(() => {
      for (const o of rows) {
        changed += stmt.run({
          kind: o.kind,
          code: o.code,
          observed_at: o.observedAt,
          value: o.value,
          extra: json(o.extra),
          fetched_at: now,
        }).changes;
      }
    })();
    return changed;
  }

  get(
    kinds: readonly StationKind[],
    codes?: readonly string[],
  ): (ObservationRecord & { fetchedAt: string })[] {
    if (kinds.length === 0 || codes?.length === 0) return [];
    const where = [`kind IN (${kinds.map(() => '?').join(',')})`];
    const params: unknown[] = [...kinds];
    if (codes) {
      where.push(`code IN (${codes.map(() => '?').join(',')})`);
      params.push(...codes);
    }
    const rows = this.#db
      .prepare(`SELECT * FROM latest WHERE ${where.join(' AND ')} ORDER BY kind, code`)
      .all(...params) as ObservationRow[];
    return rows.map(observationOf);
  }

  /** 잡별 가장 최근 관측 시각(헬스·SSE payload). */
  maxObservedAt(kinds: readonly StationKind[]): string | null {
    if (kinds.length === 0) return null;
    const r = this.#db
      .prepare(
        `SELECT MAX(observed_at) AS m FROM latest WHERE kind IN (${kinds.map(() => '?').join(',')})`,
      )
      .get(...kinds) as { m: string | null };
    return r.m;
  }
}

interface BasinRow {
  sbsncd: string;
  sbsnnm: string | null;
  mbsncd: string | null;
  bbsncd: string | null;
  geometry: string;
  source: string;
  collected_at: string;
}

export class BasinsRepo {
  readonly #db: Db;
  constructor(db: Db) {
    this.#db = db;
  }

  /** 폴리곤이 아닌 geometry 는 건너뛴다. 넣은 행 수. */
  replaceAll(basins: readonly BasinRecord[]): number {
    const stmt = this.#db.prepare(
      `INSERT INTO basins (sbsncd, sbsnnm, mbsncd, bbsncd, geometry, min_lng, min_lat, max_lng, max_lat, source, collected_at)
       VALUES (@sbsncd, @sbsnnm, @mbsncd, @bbsncd, @geometry, @min_lng, @min_lat, @max_lng, @max_lat, @source, @collected_at)
       ON CONFLICT (sbsncd) DO UPDATE SET sbsnnm = excluded.sbsnnm, mbsncd = excluded.mbsncd, bbsncd = excluded.bbsncd,
         geometry = excluded.geometry, min_lng = excluded.min_lng, min_lat = excluded.min_lat, max_lng = excluded.max_lng,
         max_lat = excluded.max_lat, source = excluded.source, collected_at = excluded.collected_at`,
    );
    let n = 0;
    this.#db.transaction(() => {
      for (const b of basins) {
        if (!isPolygonGeometry(b.geometry)) continue;
        const bb = bboxOf(b.geometry);
        stmt.run({
          sbsncd: b.sbsncd,
          sbsnnm: b.sbsnnm,
          mbsncd: b.mbsncd,
          bbsncd: b.bbsncd,
          geometry: JSON.stringify(b.geometry),
          min_lng: bb.minLng,
          min_lat: bb.minLat,
          max_lng: bb.maxLng,
          max_lat: bb.maxLat,
          source: b.source,
          collected_at: b.collectedAt,
        });
        n += 1;
      }
    })();
    return n;
  }

  /** bbox 가 점을 덮는 후보. point-in-polygon 은 호출자가 한다. */
  candidates(lng: number, lat: number): BasinRecord[] {
    const rows = this.#db
      .prepare(
        'SELECT sbsncd, sbsnnm, mbsncd, bbsncd, geometry, source, collected_at FROM basins WHERE min_lng <= ? AND max_lng >= ? AND min_lat <= ? AND max_lat >= ?',
      )
      .all(lng, lng, lat, lat) as BasinRow[];
    return rows.map((r) => ({
      sbsncd: r.sbsncd,
      sbsnnm: r.sbsnnm,
      mbsncd: r.mbsncd,
      bbsncd: r.bbsncd,
      geometry: JSON.parse(r.geometry) as unknown,
      source: r.source,
      collectedAt: r.collected_at,
    }));
  }

  count(): number {
    return (this.#db.prepare('SELECT COUNT(*) AS n FROM basins').get() as { n: number }).n;
  }
}

export class FetchLogRepo {
  readonly #db: Db;
  constructor(db: Db) {
    this.#db = db;
  }

  record(e: FetchLogEntry): void {
    this.#db
      .prepare(
        `INSERT INTO fetch_log (job, started_at, finished_at, ok, status, rows, duration_ms, error)
         VALUES (@job, @started_at, @finished_at, @ok, @status, @rows, @duration_ms, @error)`,
      )
      .run({
        job: e.job,
        started_at: e.startedAt,
        finished_at: e.finishedAt,
        ok: e.ok ? 1 : 0,
        status: e.status,
        rows: e.rows,
        duration_ms: e.durationMs,
        error: e.error,
      });
  }

  recent(limit = 20): (FetchLogEntry & { id: number })[] {
    const rows = this.#db
      .prepare('SELECT * FROM fetch_log ORDER BY id DESC LIMIT ?')
      .all(limit) as {
      id: number;
      job: string;
      started_at: string;
      finished_at: string;
      ok: number;
      status: number | null;
      rows: number | null;
      duration_ms: number;
      error: string | null;
    }[];
    return rows.map((r) => ({
      id: r.id,
      job: r.job,
      startedAt: r.started_at,
      finishedAt: r.finished_at,
      ok: r.ok === 1,
      status: r.status,
      rows: r.rows,
      durationMs: r.duration_ms,
      error: r.error,
    }));
  }

  /** `fetch_log` 를 오래 쌓지 않는다. */
  prune(before: string): number {
    return this.#db.prepare('DELETE FROM fetch_log WHERE finished_at < ?').run(before).changes;
  }
}

interface AlertRow {
  valley_id: string;
  level: string;
  source: string;
  confidence: string;
  observed_at: string;
  issued_at: string;
  station_code: string | null;
  rainfall_10m_mm: number | null;
  rainfall_1h_mm: number | null;
  rainfall_3h_mm: number | null;
  basin_rain_mm_per_h: number | null;
  water_level_stage: string | null;
  water_level_delta_m: number | null;
  lead_time_min: number | null;
  cleared_at: string | null;
  verified: number | null;
  updated_at: string;
}

const alertOf = (r: AlertRow): AlertRecord & { updatedAt: string } => ({
  valleyId: r.valley_id,
  level: r.level,
  source: r.source,
  confidence: r.confidence,
  observedAt: r.observed_at,
  issuedAt: r.issued_at,
  stationCode: r.station_code,
  rainfall10mMm: r.rainfall_10m_mm,
  rainfall1hMm: r.rainfall_1h_mm,
  rainfall3hMm: r.rainfall_3h_mm,
  basinRainMmPerH: r.basin_rain_mm_per_h,
  waterLevelStage: r.water_level_stage,
  waterLevelDeltaM: r.water_level_delta_m,
  leadTimeMin: r.lead_time_min,
  clearedAt: r.cleared_at,
  verified: r.verified === null ? null : r.verified === 1,
  updatedAt: r.updated_at,
});

/** 계곡별 경보 상태(F3b). 행은 지우지 않는다 — 해제도 `clearedAt` 을 채운 upsert 다. */
export class AlertsRepo {
  readonly #db: Db;
  constructor(db: Db) {
    this.#db = db;
  }

  upsert(record: AlertRecord, now: string): void {
    this.#db
      .prepare(
        `INSERT INTO alerts (valley_id, level, source, confidence, observed_at, issued_at, station_code,
           rainfall_10m_mm, rainfall_1h_mm, rainfall_3h_mm, basin_rain_mm_per_h, water_level_stage,
           water_level_delta_m, lead_time_min, cleared_at, verified, updated_at)
         VALUES (@valley_id, @level, @source, @confidence, @observed_at, @issued_at, @station_code,
           @rainfall_10m_mm, @rainfall_1h_mm, @rainfall_3h_mm, @basin_rain_mm_per_h, @water_level_stage,
           @water_level_delta_m, @lead_time_min, @cleared_at, @verified, @updated_at)
         ON CONFLICT (valley_id) DO UPDATE SET level = excluded.level, source = excluded.source,
           confidence = excluded.confidence, observed_at = excluded.observed_at, issued_at = excluded.issued_at,
           station_code = excluded.station_code, rainfall_10m_mm = excluded.rainfall_10m_mm,
           rainfall_1h_mm = excluded.rainfall_1h_mm, rainfall_3h_mm = excluded.rainfall_3h_mm,
           basin_rain_mm_per_h = excluded.basin_rain_mm_per_h, water_level_stage = excluded.water_level_stage,
           water_level_delta_m = excluded.water_level_delta_m, lead_time_min = excluded.lead_time_min,
           cleared_at = excluded.cleared_at, verified = excluded.verified, updated_at = excluded.updated_at`,
      )
      .run({
        valley_id: record.valleyId,
        level: record.level,
        source: record.source,
        confidence: record.confidence,
        observed_at: record.observedAt,
        issued_at: record.issuedAt,
        station_code: record.stationCode,
        rainfall_10m_mm: record.rainfall10mMm,
        rainfall_1h_mm: record.rainfall1hMm,
        rainfall_3h_mm: record.rainfall3hMm,
        basin_rain_mm_per_h: record.basinRainMmPerH,
        water_level_stage: record.waterLevelStage,
        water_level_delta_m: record.waterLevelDeltaM,
        lead_time_min: record.leadTimeMin,
        cleared_at: record.clearedAt,
        verified: record.verified === null ? null : record.verified ? 1 : 0,
        updated_at: now,
      });
  }

  get(valleyId: string): (AlertRecord & { updatedAt: string }) | undefined {
    const row = this.#db.prepare('SELECT * FROM alerts WHERE valley_id = ?').get(valleyId) as
      | AlertRow
      | undefined;
    return row === undefined ? undefined : alertOf(row);
  }

  /** 전부(해제된 것 포함) — `/api/alerts` 가 계곡마다 있으면 이걸 쓰고 없으면 평시로 낸다. */
  all(): (AlertRecord & { updatedAt: string })[] {
    const rows = this.#db.prepare('SELECT * FROM alerts ORDER BY valley_id').all() as AlertRow[];
    return rows.map(alertOf);
  }
}

interface ReportRow {
  id: string;
  valley_id: string;
  segment_id: string | null;
  type: string;
  body: string;
  nickname: string;
  password_hash: string;
  created_at: string;
  ip: string;
  hidden: number;
  lat: number | null;
  lng: number | null;
}

const reportOf = (r: ReportRow): ReportRecord => ({
  id: r.id,
  valleyId: r.valley_id,
  segmentId: r.segment_id,
  type: r.type,
  body: r.body,
  nickname: r.nickname,
  passwordHash: r.password_hash,
  createdAt: r.created_at,
  ip: r.ip,
  hidden: r.hidden === 1,
  lat: r.lat,
  lng: r.lng,
});

interface ReportPhotoRow {
  id: string;
  report_id: string;
  filename: string;
  width: number;
  height: number;
  bytes: number;
  photo_order: number;
}

const reportPhotoOf = (r: ReportPhotoRow): ReportPhotoRecord => ({
  id: r.id,
  reportId: r.report_id,
  filename: r.filename,
  width: r.width,
  height: r.height,
  bytes: r.bytes,
  order: r.photo_order,
});

export type ReportWithPhotos = ReportRecord & { readonly photos: readonly ReportPhotoRecord[] };

/** 최신순 페이지 커서 — `(createdAt, id)` 튜플을 감싼 불투명 문자열. */
export interface ReportCursor {
  readonly createdAt: string;
  readonly id: string;
}

export function encodeReportCursor(cursor: ReportCursor): string {
  return Buffer.from(`${cursor.createdAt} ${cursor.id}`, 'utf8').toString('base64url');
}

/** 형식이 아니면 `null`(호출자는 400 으로 다룬다). */
export function decodeReportCursor(raw: string): ReportCursor | null {
  try {
    const [createdAt, id] = Buffer.from(raw, 'base64url').toString('utf8').split(' ');
    if (!createdAt || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

export interface ReportsListQuery {
  readonly valleyId?: string;
  /** 이 개수만큼 돌려준다 — 다음 페이지 존재 여부는 호출자가 `limit + 1` 로 물어 판단한다. */
  readonly limit: number;
  readonly before?: ReportCursor;
  /** 관리자 목록(OPS1) 전용 — 참이면 `hidden` 행도 포함한다. 기본(생략)은 일반 조회와 같이 제외. */
  readonly includeHidden?: boolean;
}

/** 제보(F5a). `hidden` 행은 `includeHidden` 을 주지 않는 한 어떤 조회에도 나오지 않는다. */
export class ReportsRepo {
  readonly #db: Db;
  constructor(db: Db) {
    this.#db = db;
  }

  /** 제보 + 사진을 한 트랜잭션으로 넣는다. */
  create(report: ReportRecord, photos: readonly ReportPhotoRecord[]): void {
    this.#db.transaction(() => {
      this.#db
        .prepare(
          `INSERT INTO reports (id, valley_id, segment_id, type, body, nickname, password_hash, created_at, ip, hidden, lat, lng)
           VALUES (@id, @valley_id, @segment_id, @type, @body, @nickname, @password_hash, @created_at, @ip, @hidden, @lat, @lng)`,
        )
        .run({
          id: report.id,
          valley_id: report.valleyId,
          segment_id: report.segmentId,
          type: report.type,
          body: report.body,
          nickname: report.nickname,
          password_hash: report.passwordHash,
          created_at: report.createdAt,
          ip: report.ip,
          hidden: report.hidden ? 1 : 0,
          lat: report.lat,
          lng: report.lng,
        });
      const insertPhoto = this.#db.prepare(
        `INSERT INTO report_photos (id, report_id, filename, width, height, bytes, photo_order)
         VALUES (@id, @report_id, @filename, @width, @height, @bytes, @photo_order)`,
      );
      for (const p of photos) {
        insertPhoto.run({
          id: p.id,
          report_id: p.reportId,
          filename: p.filename,
          width: p.width,
          height: p.height,
          bytes: p.bytes,
          photo_order: p.order,
        });
      }
    })();
  }

  /** hidden 이어도 돌려준다(삭제·수정 인증은 라우트가 비밀번호로 따로 막는다) — 목록에만 hidden 을 뺀다. */
  get(id: string): ReportWithPhotos | undefined {
    const row = this.#db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as
      | ReportRow
      | undefined;
    if (!row) return undefined;
    return { ...reportOf(row), photos: this.#photosOf([id]).get(id) ?? [] };
  }

  /** 최신순. `includeHidden` 이 없으면 hidden 제외. `limit + 1` 로 부르면 다음 페이지 존재 여부를 알 수 있다. */
  list(query: ReportsListQuery): ReportWithPhotos[] {
    const where: string[] = [];
    if (!query.includeHidden) where.push('hidden = 0');
    const params: unknown[] = [];
    if (query.valleyId) {
      where.push('valley_id = ?');
      params.push(query.valleyId);
    }
    if (query.before) {
      where.push('(created_at < ? OR (created_at = ? AND id < ?))');
      params.push(query.before.createdAt, query.before.createdAt, query.before.id);
    }
    params.push(query.limit);
    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const rows = this.#db
      .prepare(`SELECT * FROM reports ${whereClause} ORDER BY created_at DESC, id DESC LIMIT ?`)
      .all(...params) as ReportRow[];
    const photosByReport = this.#photosOf(rows.map((r) => r.id));
    return rows.map((r) => ({ ...reportOf(r), photos: photosByReport.get(r.id) ?? [] }));
  }

  /** 숨김·복구(OPS1) — `hidden` 을 세우는 유일한 경로. 행이 없으면 `false`. */
  setHidden(id: string, hidden: boolean): boolean {
    return (
      this.#db.prepare('UPDATE reports SET hidden = ? WHERE id = ?').run(hidden ? 1 : 0, id)
        .changes > 0
    );
  }

  /**
   * `신고하기` 접수를 제보별로 묶는다(OPS1) — 최근 신고 순. CASCADE 로 제보가 지워지면
   * 그 신고 행도 같이 지워지므로 조인은 항상 살아 있는 제보만 짚는다.
   */
  flagsSummary(): ReportFlagSummary[] {
    const rows = this.#db
      .prepare(
        `SELECT rf.report_id AS report_id, COUNT(*) AS count, MAX(rf.created_at) AS last_created_at,
                r.valley_id AS valley_id, r.type AS type, r.body AS body, r.nickname AS nickname,
                r.hidden AS hidden
         FROM report_flags rf
         JOIN reports r ON r.id = rf.report_id
         GROUP BY rf.report_id
         ORDER BY last_created_at DESC`,
      )
      .all() as {
      report_id: string;
      count: number;
      last_created_at: string;
      valley_id: string;
      type: string;
      body: string;
      nickname: string;
      hidden: number;
    }[];
    return rows.map((r) => ({
      reportId: r.report_id,
      count: r.count,
      lastCreatedAt: r.last_created_at,
      valleyId: r.valley_id,
      type: r.type,
      body: r.body,
      nickname: r.nickname,
      hidden: r.hidden === 1,
    }));
  }

  /** 비밀번호 대조는 라우트가 한다 — 여기서는 해시만 돌려준다. hidden 행도 포함(삭제·수정은 막지 않는다). */
  passwordHashOf(id: string): string | undefined {
    const row = this.#db.prepare('SELECT password_hash FROM reports WHERE id = ?').get(id) as
      | { password_hash: string }
      | undefined;
    return row?.password_hash;
  }

  /**
   * 본문·유형(결정 (g)) + 좌표(F5d) 를 수정한다. `lat`/`lng` 가 `null` 이면 좌표를 지운다
   * (둘 다 오거나 둘 다 없어야 한다는 짝 규칙·범위·반경 검증은 라우트의 몫 — 여기는 그대로 쓴다).
   * 행이 없으면 `false`.
   */
  update(
    id: string,
    patch: {
      readonly type?: string;
      readonly body?: string;
      readonly lat?: number | null;
      readonly lng?: number | null;
    },
  ): boolean {
    const sets: string[] = [];
    const params: Record<string, unknown> = { id };
    if (patch.type !== undefined) {
      sets.push('type = @type');
      params['type'] = patch.type;
    }
    if (patch.body !== undefined) {
      sets.push('body = @body');
      params['body'] = patch.body;
    }
    if (patch.lat !== undefined) {
      sets.push('lat = @lat');
      params['lat'] = patch.lat;
    }
    if (patch.lng !== undefined) {
      sets.push('lng = @lng');
      params['lng'] = patch.lng;
    }
    if (sets.length === 0)
      return this.#db.prepare('SELECT 1 FROM reports WHERE id = ?').get(id) !== undefined;
    return (
      this.#db.prepare(`UPDATE reports SET ${sets.join(', ')} WHERE id = @id`).run(params).changes >
      0
    );
  }

  /** 사진 파일 자체는 라우트가 지운다(디스크 I/O) — 여기는 행만(CASCADE 로 사진·신고 행도 지워진다). */
  delete(id: string): boolean {
    return this.#db.prepare('DELETE FROM reports WHERE id = ?').run(id).changes > 0;
  }

  addFlag(flag: Omit<ReportFlagRecord, 'id'>): void {
    this.#db
      .prepare(
        `INSERT INTO report_flags (report_id, reason, created_at, ip) VALUES (@report_id, @reason, @created_at, @ip)`,
      )
      .run({
        report_id: flag.reportId,
        reason: flag.reason,
        created_at: flag.createdAt,
        ip: flag.ip,
      });
  }

  count(): number {
    return (this.#db.prepare('SELECT COUNT(*) AS n FROM reports').get() as { n: number }).n;
  }

  #photosOf(reportIds: readonly string[]): Map<string, ReportPhotoRecord[]> {
    const byReport = new Map<string, ReportPhotoRecord[]>();
    if (reportIds.length === 0) return byReport;
    const rows = this.#db
      .prepare(
        `SELECT * FROM report_photos WHERE report_id IN (${reportIds.map(() => '?').join(',')}) ORDER BY report_id, photo_order`,
      )
      .all(...reportIds) as ReportPhotoRow[];
    for (const row of rows) {
      const photo = reportPhotoOf(row);
      const list = byReport.get(photo.reportId);
      if (list) list.push(photo);
      else byReport.set(photo.reportId, [photo]);
    }
    return byReport;
  }
}

export interface Repos {
  readonly stations: StationsRepo;
  readonly observations: ObservationsRepo;
  readonly latest: LatestRepo;
  readonly basins: BasinsRepo;
  readonly alerts: AlertsRepo;
  readonly reports: ReportsRepo;
  readonly fetchLog: FetchLogRepo;
}

export function createRepos(db: Db): Repos {
  return {
    stations: new StationsRepo(db),
    observations: new ObservationsRepo(db),
    latest: new LatestRepo(db),
    basins: new BasinsRepo(db),
    alerts: new AlertsRepo(db),
    reports: new ReportsRepo(db),
    fetchLog: new FetchLogRepo(db),
  };
}
