/**
 * 서버 설정 — 환경변수에서 읽는다.
 *
 * 키 이름은 저장소 루트 `.env.example` 과 같다(`docs/API_KEYS.md` §5). 값은 절대 로그에 쓰지 않는다 —
 * `secretValues()` 가 마스킹 대상 목록을 준다. 우선순위는 프로세스 환경변수 > 루트 `.env.local`.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { LogLevel } from '@modu-valley/core';

export type Env = Readonly<Record<string, string | undefined>>;

export interface ServerConfig {
  readonly webDir: string | undefined;
  readonly port: number;
  readonly host: string;
  /** CORS 허용 오리진. 기본 Expo web 개발 포트 두 개(라이트 8081·다크 8091). */
  readonly allowedOrigins: readonly string[];
  readonly dbPath: string;
  readonly migrationsDir: string;
  /** IP 별 분당 요청 한도 (`/api/*`). */
  readonly rateLimitPerMinute: number;
  /** `X-Forwarded-For` 의 첫 주소를 클라이언트 IP 로 믿는다(리버스 프록시 뒤). */
  readonly trustProxy: boolean;
  readonly logLevel: LogLevel;
  readonly logFormat: 'json' | 'pretty';
  readonly vworld: {
    readonly key: string | undefined;
    /** VWorld 가 요구하는 `domain` 파라미터. 서버 호출은 도메인 검사가 없지만 파라미터는 채운다. */
    readonly domain: string;
  };
  readonly hrfcoKey: string | undefined;
  readonly kmaKey: string | undefined;
  readonly dataGoKrKey: string | undefined;
  /** 폴러 on/off(테스트·읽기 전용 인스턴스). */
  readonly jobsEnabled: boolean;
  readonly hrfcoIntervalMs: number;
  readonly awsIntervalMs: number;
  /** 경보 재판정 주기(F3b). HTTP 를 부르지 않으므로 hrfco·aws 보다 짧아도 된다. */
  readonly alertsIntervalMs: number;
  /** 수자원관리도 WFS GetFeature(GeoJSON) URL. 없으면 표준유역은 브이월드 조회 전용. */
  readonly basinsWfsUrl: string | undefined;
  /** 제보 사진 저장 디렉터리(F5a 결정 (d)). `/uploads/<id>.jpg` 로 정적 서빙한다. */
  readonly uploadsDir: string;
  /** `valleyId` 검증용 — `data/valleys/*.geojson` 파일 이름(확장자 제외)이 유효한 계곡 id 다. */
  readonly valleysDir: string;
  /** IP 당 10분 제보 작성 한도(F5a 결정 (h)). */
  readonly reportsRateLimitPer10Min: number;
  /** IP 당 하루 제보 작성 한도. */
  readonly reportsRateLimitPerDay: number;
  /**
   * 관리자 API 토큰(OPS1). `undefined` 면 관리자 API 전체가 비활성(404) — 빈 토큰이
   * 통과하는 경로를 만들지 않는다. `openssl rand -base64 32` 로 생성(`docs/API_KEYS.md`).
   */
  readonly adminToken: string | undefined;
  /** IP 당 분당 관리자 API 한도(토큰 추측 방어). `/api/*` 공통 한도와 별개로 더 엄격하다. */
  readonly adminRateLimitPerMinute: number;
}

export const DEFAULT_PORT = 8787;
export const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:8081', 'http://localhost:8091'] as const;

/**
 * `.env.local` 을 dotenv 없이 읽는다. 값 뒤의 `  # 주석` 을 떼고 따옴표를 벗긴다.
 * 빈 값은 넣지 않는다(`.env.example` 을 그대로 복사한 상태와 구분하기 위해).
 */
export function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(raw);
    if (!m) continue;
    const key = m[1] ?? '';
    let value = (m[2] ?? '').replace(/\s+#.*$/, '').trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    if (value) out[key] = value;
  }
  return out;
}

/** 파일이 없으면 빈 객체. 파일의 값은 프로세스 환경변수를 덮지 않는다. */
export function readEnvLocal(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {};
  return parseEnvFile(fs.readFileSync(file, 'utf8'));
}

export function mergeEnv(processEnv: Env, fileEnv: Record<string, string>): Env {
  const merged: Record<string, string | undefined> = { ...fileEnv };
  for (const [k, v] of Object.entries(processEnv)) if (v !== undefined && v !== '') merged[k] = v;
  return merged;
}

function intOf(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function boolOf(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return !/^(0|false|no|off)$/i.test(value);
}

function levelOf(value: string | undefined, fallback: LogLevel): LogLevel {
  return value === 'debug' || value === 'info' || value === 'warn' || value === 'error'
    ? value
    : fallback;
}

function nonEmpty(value: string | undefined): string | undefined {
  return value !== undefined && value !== '' ? value : undefined;
}

export interface LoadConfigOptions {
  /** `server/` 디렉터리. 기본 DB·마이그레이션 경로의 기준. */
  readonly serverDir: string;
  readonly env: Env;
}

export function loadConfig({ serverDir, env }: LoadConfigOptions): ServerConfig {
  const origins = (env['ALLOWED_ORIGINS'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const isProd = env['NODE_ENV'] === 'production';
  return {
    webDir: nonEmpty(env['WEB_DIR']),
    port: intOf(env['PORT'], DEFAULT_PORT),
    host: env['HOST'] ?? '0.0.0.0',
    allowedOrigins: origins.length > 0 ? origins : [...DEFAULT_ALLOWED_ORIGINS],
    dbPath: env['DB_PATH'] ?? path.join(serverDir, 'data', 'valley.db'),
    migrationsDir: env['MIGRATIONS_DIR'] ?? path.join(serverDir, 'migrations'),
    rateLimitPerMinute: intOf(env['RATE_LIMIT_PER_MIN'], 60),
    trustProxy: boolOf(env['TRUST_PROXY'], true),
    logLevel: levelOf(env['LOG_LEVEL'], isProd ? 'info' : 'debug'),
    logFormat:
      env['LOG_FORMAT'] === 'pretty' || (!isProd && env['LOG_FORMAT'] !== 'json')
        ? 'pretty'
        : 'json',
    vworld: {
      key: nonEmpty(env['VWORLD_API_KEY']),
      domain: env['VWORLD_DOMAIN'] ?? 'localhost',
    },
    hrfcoKey: nonEmpty(env['HRFCO_API_KEY']) ?? nonEmpty(env['HRFCO_API_KEY_LOCAL']),
    kmaKey: nonEmpty(env['KMA_APIHUB_KEY']),
    dataGoKrKey:
      nonEmpty(env['DATA_GO_KR_KEY_ENCODING']) ?? nonEmpty(env['DATA_GO_KR_KEY_DECODING']),
    jobsEnabled: boolOf(env['JOBS_ENABLED'], true),
    hrfcoIntervalMs: intOf(env['HRFCO_INTERVAL_MS'], 10 * 60_000),
    awsIntervalMs: intOf(env['AWS_INTERVAL_MS'], 60_000),
    alertsIntervalMs: intOf(env['ALERTS_INTERVAL_MS'], 60_000),
    basinsWfsUrl: nonEmpty(env['BASINS_WFS_URL']),
    uploadsDir: env['UPLOADS_DIR'] ?? path.join(serverDir, 'data', 'uploads'),
    valleysDir: env['VALLEYS_DIR'] ?? path.join(path.resolve(serverDir, '..'), 'data', 'valleys'),
    reportsRateLimitPer10Min: intOf(env['REPORTS_RATE_LIMIT_PER_10MIN'], 3),
    reportsRateLimitPerDay: intOf(env['REPORTS_RATE_LIMIT_PER_DAY'], 20),
    adminToken: nonEmpty(env['ADMIN_TOKEN']),
    adminRateLimitPerMinute: intOf(env['ADMIN_RATE_LIMIT_PER_MIN'], 20),
  };
}

/** 로그·오류 메시지에서 가려야 하는 값. 비어 있는 키는 제외. */
export function secretValues(config: ServerConfig): readonly string[] {
  return [
    config.vworld.key,
    config.hrfcoKey,
    config.kmaKey,
    config.dataGoKrKey,
    config.adminToken,
  ].filter((v): v is string => typeof v === 'string' && v.length > 0);
}

/** 헬스 응답용 — 어느 키가 채워졌는지만(값은 절대 아님). */
export function keyPresence(config: ServerConfig): Readonly<Record<string, boolean>> {
  return {
    vworld: config.vworld.key !== undefined,
    hrfco: config.hrfcoKey !== undefined,
    kma: config.kmaKey !== undefined,
    dataGoKr: config.dataGoKrKey !== undefined,
  };
}
