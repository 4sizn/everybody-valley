/**
 * 잡 조립. 키가 있는 소스만 폴러를 만든다. 시작 순서: 유역 1회 적재 → 제원 → HRFCO → AWS.
 */
import type { Logger } from '@modu-valley/core';
import type { ServerConfig } from '../config';
import type { Repos } from '../db/repos';
import type { EventHub } from '../events/EventHub';
import type { Redactor } from '../logging/redact';
import type { SourceHttp } from '../sources/http';
import { createAlertsRun } from './alertsJob';
import { createAwsRun } from './awsJob';
import { loadBasinsOnce } from './basinsJob';
import { createHrfcoRun } from './hrfcoJob';
import { PollJob } from './PollJob';
import { createStationsRun, STATIONS_INTERVAL_MS } from './stationsJob';

export interface JobsDeps {
  readonly config: ServerConfig;
  readonly repos: Repos;
  readonly hub: EventHub;
  readonly http: SourceHttp;
  readonly logger: Logger;
  readonly redact: Redactor;
  readonly now?: () => number;
}

export interface Jobs {
  readonly jobs: readonly PollJob[];
  start(): Promise<void>;
  stop(): void;
}

export function createJobs(deps: JobsDeps): Jobs {
  const { config, repos, hub, http, redact } = deps;
  const logger = deps.logger.child('jobs');
  const common = {
    fetchLog: repos.fetchLog,
    logger,
    redact,
    ...(deps.now ? { now: deps.now } : {}),
  };
  const jobs: PollJob[] = [];

  if (config.hrfcoKey || config.kmaKey) {
    jobs.push(
      new PollJob({
        ...common,
        name: 'stations',
        intervalMs: STATIONS_INTERVAL_MS,
        run: createStationsRun({ hrfcoKey: config.hrfcoKey, kmaKey: config.kmaKey, http, repos }),
      }),
    );
  }
  if (config.hrfcoKey) {
    jobs.push(
      new PollJob({
        ...common,
        name: 'hrfco',
        intervalMs: config.hrfcoIntervalMs,
        run: createHrfcoRun({ key: config.hrfcoKey, http, repos, hub }),
      }),
    );
  } else {
    logger.warn('HRFCO_API_KEY 없음 — hrfco 폴러를 만들지 않는다');
  }
  if (config.kmaKey) {
    jobs.push(
      new PollJob({
        ...common,
        name: 'aws',
        intervalMs: config.awsIntervalMs,
        run: createAwsRun({
          key: config.kmaKey,
          http,
          repos,
          hub,
          intervalMs: config.awsIntervalMs,
        }),
      }),
    );
  } else {
    logger.warn('KMA_APIHUB_KEY 없음 — aws 폴러를 만들지 않는다');
  }
  // 경보 판정(F3b)은 외부 API 를 부르지 않는다 — hrfco·aws 가 쌓은 값만 본다. 키 유무와 무관하게 돈다.
  jobs.push(
    new PollJob({
      ...common,
      name: 'alerts',
      intervalMs: config.alertsIntervalMs,
      run: createAlertsRun({ repos, hub, ...(deps.now ? { now: deps.now } : {}) }),
    }),
  );

  return {
    jobs,
    async start() {
      await loadBasinsOnce({ wfsUrl: config.basinsWfsUrl, http, repos, logger, redact });
      for (const job of jobs) job.start();
      logger.info('jobs started', { jobs: jobs.map((j) => j.name) });
    },
    stop() {
      for (const job of jobs) job.stop();
    },
  };
}
