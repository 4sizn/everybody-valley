# @modu-valley/server

모두의계곡 서버(`docs/TODO.md` S1). 브이월드 프록시(키 은닉), 정부 API 폴링·캐시, SSE, 제보(F5a).
클라이언트는 정부 API 를 직접 부르지 않고 이 서버만 본다(`docs/references/valley-ds/docs/data-sources.md` 호출 구조).

- 런타임 **Node 22 + Hono + TypeScript**, 저장 **SQLite(better-sqlite3) 단일 파일** `server/data/valley.db`(gitignore).
  제보 사진은 `server/data/uploads/`(gitignore)에 파일로 — `sharp` 로 리사이즈·EXIF 제거, 비밀번호는 `bcryptjs` 해시.
- `@modu-valley/core` 를 그대로 import 한다(도메인 타입·`Logger`). `console` 은 쓰지 않는다 — `ServerLogger` 가 core 의 `Logger` 를 구현한다.
- 단일 인스턴스 전제. 잡(폴러)은 프로세스 안 인터벌 — 시작 시 즉시 1회, 실패는 지수 백오프(30 s → 10분), 매 시도 `fetch_log`.

## 실행

```sh
pnpm install                       # 루트에서 한 번 (better-sqlite3 네이티브 빌드 허용은 pnpm-workspace.yaml allowBuilds)
cp .env.example .env.local         # 키를 채운다 — docs/API_KEYS.md. 이 파일은 커밋되지 않는다
pnpm server:dev                    # tsx watch, http://localhost:8787
pnpm server:test                   # vitest
pnpm server:build                  # esbuild → server/dist/index.mjs (core 소스까지 한 파일)
pnpm server:start                  # node server/dist/index.mjs
```

`pnpm verify`(lint·typecheck·test) 가 이 패키지를 포함한다(`pnpm -r`). 서버만 보려면 `pnpm --filter @modu-valley/server typecheck`.

첫 실행에 `server/data/valley.db` 를 만들고 `server/migrations/NNNN_*.sql` 을 번호 순으로 적용한다(`schema_migrations` 에 기록, 앞으로만).
키가 있으면 폴러가 바로 돈다 — 실측(2026-09-06, 실제 키): 시작 1 s 안에 HRFCO 1,831 행(수위 1,203 + 강우 628)·AWS 8,096 행(736 지점 × 11 분)·제원 2,909 건이 들어오고, 그 뒤 AWS 매분 0.6–1.3 s, HRFCO 10분마다 0.6 s.

```sh
curl -s localhost:8787/healthz | jq
curl -s 'localhost:8787/api/vworld/wfs?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature&TYPENAME=lt_c_wkmsbsn&BBOX=37.83,127.2656,37.8306,127.2662,EPSG:4326&SRSNAME=EPSG:4326&OUTPUT=application/json&MAXFEATURES=1' | jq '.features[0].properties'
```

## 환경변수

키 이름은 저장소 루트 `.env.example` 과 같다. 우선순위는 **프로세스 환경변수 > 루트 `.env.local`**. 값은 로그에 절대 찍히지 않는다 — 로그 한 줄 전체가 `Redactor` 를 거쳐 알고 있는 키 값과 `key=`·`authKey=`·`serviceKey=`·`api.hrfco.go.kr/<key>/` 패턴을 `<KEY>` 로 바꾼다.

| 변수 | 기본 | 뜻 |
| --- | --- | --- |
| `PORT` | `8787` | 리슨 포트(결정 (d)) |
| `HOST` | `0.0.0.0` | 리슨 주소 |
| `ALLOWED_ORIGINS` | `http://localhost:8081,http://localhost:8091` | CORS 허용 오리진(쉼표). Expo web 라이트·다크 개발 포트 |
| `DB_PATH` | `server/data/valley.db` | SQLite 파일. `:memory:` 는 테스트용 |
| `MIGRATIONS_DIR` | `server/migrations` | 마이그레이션 디렉터리 |
| `RATE_LIMIT_PER_MIN` | `60` | `/api/*` IP 별 분당 한도(고정 창). 초과 시 429 + `RateLimit-*`·`Retry-After` |
| `TRUST_PROXY` | `true` | `X-Forwarded-For` 첫 주소를 클라이언트 IP 로 믿는다(리버스 프록시 뒤). 프록시 없이 공개하면 `false` |
| `LOG_LEVEL` | dev `debug` / prod `info` | `debug`·`info`·`warn`·`error` |
| `LOG_FORMAT` | dev `pretty` / prod `json` | 한 줄 JSON(수집기) 또는 사람용 |
| `NODE_ENV` | — | `production` 이면 위 두 기본이 바뀐다 |
| `VWORLD_API_KEY` | — | 브이월드 키. 없으면 `/api/vworld/*` 가 503 |
| `VWORLD_DOMAIN` | `localhost` | 브이월드 `domain` 파라미터(서버 호출은 도메인 검사가 없지만 채운다) |
| `HRFCO_API_KEY` (`_LOCAL`) | — | 한강홍수통제소. S1b 폴러 |
| `KMA_APIHUB_KEY` | — | 기상청 API허브. S1b 폴러 |
| `DATA_GO_KR_KEY_ENCODING` / `_DECODING` | — | 공공데이터포털(현재 서버 미사용, 헬스에 유무만) |
| `JOBS_ENABLED` | `true` | `false` 면 폴러를 만들지 않는다(읽기 전용 인스턴스·테스트) |
| `HRFCO_INTERVAL_MS` | `600000` | 한강홍수통제소 폴링 주기(10분 자료) |
| `AWS_INTERVAL_MS` | `60000` | 기상청 AWS 폴링 주기(매분, 전체 지점 10분 창 1 호출 = 1,440건/일 < 20,000 한도) |
| `BASINS_WFS_URL` | — | 국토부 수자원관리도 WFS GetFeature(GeoJSON) URL. 있으면 시작 시 표준유역을 1회 적재해 저장(공공누리 1유형). 없으면 `/api/basins` 는 브이월드 조회 전용 |
| `UPLOADS_DIR` | `server/data/uploads` | 제보 사진 저장 디렉터리(F5a 결정 (d)). `/uploads/<uuid>.jpg` 로 정적 서빙. 배포 시 영구 볼륨 필요 |
| `VALLEYS_DIR` | 저장소 루트 `data/valleys` | 제보 `valleyId` 검증용 — 이 디렉터리의 `*.geojson` 파일 이름(확장자 제외)이 유효한 계곡 id. 서버 시작 시 한 번 읽는다 |
| `REPORTS_RATE_LIMIT_PER_10MIN` | `3` | 제보 작성(`POST /api/reports`) IP 당 10분 한도(F5a 결정 (h)) |
| `REPORTS_RATE_LIMIT_PER_DAY` | `20` | 제보 작성 IP 당 하루 한도. 10분 한도와 별개로 둘 다 만족해야 통과 |

## 엔드포인트

| 경로 | 설명 |
| --- | --- |
| `GET /healthz` | `{ ok, now, uptimeSec, db: { ok, path, schemaVersion }, lastPoll: { hydro, aws }, keys: { vworld, hrfco, kma, dataGoKr } }`. DB 가 죽으면 503. `keys` 는 **있는지 여부만**. 레이트리밋 밖 |
| `ALL /api/vworld/{wfs\|wms\|search\|address}` | 브이월드 프록시. `GET`·`HEAD`·`POST` 만. 클라이언트가 보낸 `key`·`domain`·`apiKey` 는 버리고 서버 것을 넣는다. 응답은 **저장·캐시하지 않고** 스트림으로 되돌리며 `Cache-Control: no-store`, `Set-Cookie` 제거(브이월드 약관 §19). 그 밖 경로(`data`·`image`…)는 404, 업스트림 실패 502, 키 없음 503. `geocoder` 는 `address` 의 별칭, `req/wfs` 도 받는다 |
| `GET /api/hydro/stations?kind=waterlevel,rainfall&bbox=minLng,minLat,maxLng,maxLat` | 한강홍수통제소 관측소 제원(수위 1,420 · 강우 744). 좌표는 **십진도**(제원의 도분초를 변환), `attrs` 에 수위 4단계 `attwl/wrnwl/almwl/srswl`·`pfh`·`fstnyn`·주소. `suspicious` 는 도분초 오기 표시 |
| `GET /api/hydro/latest?stations=code,code&kind=` | 관측소별 최신 10분 값. `value` = 수위 m / 10분 강우 mm, 수위는 `extra.fw`(유량). `observedAt` UTC. `stations` 생략 시 전체 |
| `GET /api/aws/stations?bbox=` · `GET /api/aws/latest?stns=code,code` | 기상청 AWS 지점(745)·최신 분 값. `value` = RN-60m(1시간 강우 mm), `extra` = `{ rn15, rn12h, rnDay, ta, re }` |
| `GET /api/basins?lng&lat[&geometry=1]` | 점이 속한 표준유역. 저장된 수자원관리도 폴리곤(bbox 후보 → point-in-polygon)이면 `source: 'db'`·하루 캐시, 없으면 브이월드 WFS 를 서버 키로 조회해 **저장하지 않고** `source: 'vworld'`·`no-store` 로 응답(BBOX 위도,경도 순서, 0.0003° → 0.002° 두 단계) |
| `GET /api/events?channel=hydro,aws` | SSE. 연결 직후 `hello`, 폴링 성공마다 채널 이벤트(`{ channel, at, observedAt, … }`, `id` 증가), **15 s `heartbeat`**. 채널 생략 시 둘 다(`report` 포함 4채널) |
| `GET /api/reports?valleyId=&limit=&cursor=` | 제보 목록(F5a), **최신순**, `hidden` 제외. `limit` 기본 20·최대 50, `cursor` 는 이전 응답의 `nextCursor`(불투명 문자열) |
| `GET /api/reports/:id` | 제보 상세(사진 포함). 없거나 숨김이면 404 |
| `POST /api/reports` | 제보 생성. `multipart/form-data`(사진 0~3장, 필드명 `photos` 반복) 또는 `application/json`(사진 없음). 필드 `valleyId`(`data/valleys/*` 존재해야 함)·`type`(6종)·`body`(1~500자)·`nickname`(1~20자)·`password`(4자 이상)·`segmentId`(선택). 사진은 서버가 리사이즈(장변 1600)·EXIF 제거 후 저장, 응답은 `passwordHash` 를 뺀 제보(사진 URL 포함). IP 당 `REPORTS_RATE_LIMIT_PER_10MIN`·`_PER_DAY` 레이트리밋(`/api/*` 공통 60/분과 별개로 추가 적용) |
| `PATCH /api/reports/:id` | 본문·유형 수정. body `{ password, type?, body? }` — 비밀번호가 그 제보 해시와 맞을 때만(결정 (a)), 틀리면 403 |
| `DELETE /api/reports/:id` | 삭제. body `{ password }` — 맞을 때만. 사진 파일도 함께 지운다(DB 는 CASCADE) |
| `POST /api/reports/:id/flag` | `신고하기` — 접수 기록만(자동 숨김 없음, 결정 (h)). body `{ reason? }` 선택 |
| `GET /uploads/:file` | 제보 사진 정적 서빙(`<uuid>.jpg`). `Cache-Control: public, max-age=31536000, immutable` |

응답 예(실제 키, 2026-09-06 13:42 KST):

```json
// GET /api/hydro/latest?stations=1022670,10224050
{"count":2,"observedAt":"2026-09-06T04:30:00.000Z","observations":[
  {"kind":"hrfco-rainfall","code":"10224050","observedAt":"2026-09-06T04:30:00.000Z","value":0,"extra":null,"fetchedAt":"2026-09-06T04:37:59.973Z"},
  {"kind":"hrfco-waterlevel","code":"1022670","observedAt":"2026-09-06T04:30:00.000Z","value":0.88,"extra":{"fw":3.47},"fetchedAt":"2026-09-06T04:37:59.973Z"}]}
// GET /api/aws/latest?stns=454
{"count":1,"observedAt":"2026-09-06T04:42:00.000Z","observations":[
  {"kind":"aws","code":"454","observedAt":"2026-09-06T04:42:00.000Z","value":0,"extra":{"rn15":0,"rn12h":0,"rnDay":0,"ta":28.7,"re":null},"fetchedAt":"2026-09-06T04:42:03.370Z"}]}
// GET /api/basins?lng=127.2659&lat=37.8303   (cache-control: no-store)
{"source":"vworld","stored":false,"attribution":"브이월드(국토교통부) 표준유역 — 저장·재배포 금지","basin":{"sbsncd":"101802","sbsnnm":"퇴계원수위표","mbsncd":"1018","bbsncd":"10"}}
```

제보(F5a) 실측(2026-09-07, `curl -F` 로 사진 2장 업로드):

```json
// POST /api/reports (multipart, photos=@a.jpg&photos=@b.jpg)
{"id":"9d9d17ca-...","valleyId":"baegun-pocheon","segmentId":null,"type":"valley-info",
 "body":"계곡 물이 오늘 아주 맑고 시원합니다","nickname":"산꾼철수","createdAt":"2026-09-07T00:08:40.835Z",
 "photos":[{"id":"1cd04ad9-...","url":"/uploads/1cd04ad9-....jpg","width":1200,"height":800,"bytes":5893,"order":0},
           {"id":"ab1d9b52-...","url":"/uploads/ab1d9b52-....jpg","width":1200,"height":800,"bytes":5893,"order":1}]}
// GET /uploads/1cd04ad9-....jpg 를 sharp 로 다시 읽으면 exif 필드가 없다 — 원본에 넣은 GPS 태그가 사라진 것을 확인함.
// DELETE /api/reports/:id  {"password":"wrong"}   → 403 {"error":"password_mismatch"}
// DELETE /api/reports/:id  {"password":"<맞는 값>"} → 200 {"ok":true}, 사진 파일도 함께 삭제됨
```

브이월드 BBOX 는 EPSG:4326 에서 **위도,경도** 순서다(`docs/API_KEYS.md` §6).

## 잡 (`src/jobs/`)

| 잡 | 주기 | 호출 | 하는 일 |
| --- | --- | --- | --- |
| `stations` | 시작 시 + 24 h | HRFCO `waterlevel/info`·`rainfall/info` + API허브 `stn_inf.php?inf=AWS`(EUC-KR) | `stations` upsert. 도분초 → 십진도 |
| `hrfco` | 시작 시 + 10분 | `waterlevel/list/10M.json`·`rainfall/list/10M.json` **일괄 2 호출**(전 관측소 최신값, 분당 1,000건 한도와 무관) | `latest` upsert, `observations`(10분 격자) 적재, 7일 밖 정리, SSE `hydro` |
| `aws` | 시작 시 + 1분 | `nph-aws2_min?tm1=now-10m&tm2=now&stn=0&disp=1` **1 호출**(736 지점 × 11 분 ≈ 8,100 행, 0.6 s) | `latest` 는 전부, `observations` 는 10분 격자 행만, SSE `aws`. `#7777END` 가 없으면 잘린 응답 → 실패 처리(백오프 재시도) |
| `basins` | 시작 시 1회 | `BASINS_WFS_URL`(있을 때만) | 표준유역 폴리곤 저장. 이미 있으면 건너뜀 |

실패한 시도는 `fetch_log.error` 에 마스킹된 메시지로 남고, 다음 시도는 30 s·60 s·120 s… 최대 10분 뒤. `/healthz` 의 `lastPoll` 은 잡별 마지막 **성공** 시각이다.

`observations` 는 `kind, code, observed_at` 이 키인 10분 격자(HRFCO 는 원래 10분, AWS 는 분 자료 중 10분 정각만) — 하루 약 (1,831 + 736) × 144 ≈ 37만 행, 7일 ≈ 260만 행. `latest` 는 관측소당 1행.

## 구조

```
server/
  migrations/           0001_init.sql (stations, fetch_log) · 0002_observations.sql (observations, latest, basins)
                        · 0003_alerts.sql (alerts, F3b) · 0004_reports.sql (reports, report_photos, report_flags, F5a)
  src/
    index.ts            진입점: 설정 → 로거 → DB·마이그레이션 → 앱 → 리슨, SIGINT/SIGTERM 정리
    app.ts              Hono 조립(요청 로그 → CORS → /api/* 레이트리밋 → 라우트). 테스트는 app.request()
    config.ts           환경변수·.env.local 파싱, secretValues()·keyPresence()
    valleys.ts           `data/valleys/*.geojson` 파일명 → 유효 계곡 id 집합(제보 valleyId 검증)
    logging/            ServerLogger(core Logger 구현), redact(마스킹)
    db/                 Database(better-sqlite3, WAL), migrate(번호 SQL 러너), repos.ts(테이블별 저장소, ReportsRepo 포함)
    http/               rateLimit(순수 FixedWindowRateLimiter·TieredRateLimiter + 미들웨어), requestLog,
                        routes/{healthz,vworld,hydro,aws,basins,events,alerts,reports,uploads}
    reports/            passwords.ts(bcrypt 해시), photos.ts(sharp 리사이즈·EXIF 제거) — F5a
    vworld/allowlist.ts  /api/vworld/* → api.vworld.kr/req/* 순수 매핑(허용목록·키 주입)
    sources/            hrfco·kmaAws 파서(순수), http(잡용 fetch, 타임아웃·마스킹)
    jobs/               PollJob(주기·백오프·fetch_log), hrfcoJob·awsJob·stationsJob·basinsJob·alertsJob, index(조립)
    events/EventHub.ts  SSE 허브(채널 hydro·aws·alert·report, 15 s heartbeat), geo/pointInPolygon.ts
    records.ts · time.ts  레코드 타입, KST ↔ UTC
  scripts/build.mts     esbuild 번들(core 소스 포함, better-sqlite3·sharp 는 external — 둘 다 네이티브 프리빌트)
  Dockerfile            node:22-alpine 멀티스테이지
```

## Docker

빌드 콘텍스트는 저장소 루트(core 소스가 번들에 들어가야 한다).

```sh
docker build -f server/Dockerfile -t modu-valley-server .
docker run --rm -p 8787:8787 -v mv-data:/data --env-file .env.local \
  -e ALLOWED_ORIGINS=https://app.example modu-valley-server
```

실행 이미지는 `dist/index.mjs` + `migrations/` + `data/valleys/`(제보 valleyId 검증용, 읽기 전용) + better-sqlite3·sharp(alpine 프리빌트)만.
DB 는 `/data/valley.db`, 제보 사진은 `/data/uploads/` — 둘 다 `/data` 볼륨 안(`VOLUME`). `VALLEYS_DIR` 은 이미지 안 경로(`/app/data/valleys`)로 고정 —
`serverDir` 기준 기본값은 빌드 레이아웃과 안 맞아 반드시 env 로 준다. `HEALTHCHECK` 는 `/healthz`.

## 앱에서 쓰기

`@modu-valley/core` 의 `ApiPort`(계약) 와 `FetchApiClient`(fetch·EventSource 주입, web/native 공용) 가 이 서버의 DTO 를 그대로 든다.
앱은 `apps/valley-map/src/api/createApiClient.ts` 가 `EXPO_PUBLIC_API_BASE`(기본 `http://localhost:8787`) 로 클라이언트를 만든다 — UI 배선은 F2·F3b.
`ApiPort` 의 제보 읽기·쓰기 시그니처(`reports`·`report`·`createReport`·`updateReport`·`deleteReport`·`flagReport`, F5a)는
지금은 기본 구현(`repository/load-failed`)만 있다 — `FetchApiClient` 오버라이드와 폼 UI 는 F5b.
RN 런타임에는 `EventSource` 가 없어 `subscribeEvents` 가 빈 `Disposable` 을 돌려준다(REST 폴링으로 대신하거나 폴리필 주입).

## 배포 후보 비교 (결정 (c) — 사용자 결정, 2026-09 공개 가격 기준·결정 전 재확인)

세 곳 모두 이 Dockerfile 그대로 올라간다. 갈리는 것은 **리전(서울 지연)** 과 **SQLite 파일을 붙일 수 있는 영구 디스크** 두 가지다.

| | Fly.io (Tokyo `nrt`) | Cloud Run (Seoul `asia-northeast3`) | Railway (Singapore `asia-southeast1`) |
| --- | --- | --- | --- |
| 리전·지연 | 도쿄. 서울 왕복 ≈ 30–40 ms. 서울 리전 없음 | **서울**. 가장 가깝다 | 싱가포르. 서울 왕복 ≈ 70–90 ms. 도쿄·서울 없음 |
| SQLite 볼륨 | **가능** — Fly Volumes(머신에 붙는 NVMe, 단일 머신 부착). 스냅샷 자동. 볼륨은 머신 1대와 묶이므로 단일 인스턴스 전제와 맞다 | **어렵다** — 로컬 디스크는 인메모리·휘발성. GCS FUSE 마운트는 SQLite 잠금·WAL 에 부적합(동시 쓰기·fsync 보장 없음). 사실상 Cloud SQL/Turso 등 외부 DB 로 바꿔야 한다 | **가능** — Railway Volumes(서비스 1개에 1개, 재배포 시 유지) |
| 상시 실행(폴러·SSE) | 머신은 기본 상시. `auto_stop_machines` 를 끄면 된다 | 기본 scale-to-zero → 폴러가 멎는다. `min-instances=1` 필수(비용의 대부분) | 서비스는 상시 실행 |
| 대략 비용(월) | shared-cpu-1x 256 MB ≈ $2 + 볼륨 1 GB ≈ $0.15 + 트래픽. **≈ $3~5** | min-instance 1 (1 vCPU·512 MB 상시) ≈ $10~15 + 외부 DB. 무료 등급은 요청 기준이라 상시 인스턴스엔 거의 안 걸린다 | Hobby $5(사용량 $5 포함) — 이 규모는 포함분 안. **≈ $5** |
| 배포 방법 | `fly launch` → `fly.toml`(internal_port 8787, `[mounts] destination=/data`) → `fly deploy`. 시크릿 `fly secrets set` | `gcloud run deploy --source .`(Dockerfile 인식) 또는 Artifact Registry 이미지. 시크릿은 Secret Manager | GitHub 연동 또는 `railway up`. 볼륨 마운트 `/data`, 변수는 대시보드 |
| 계정·과금 | 카드 등록, 사용량 과금(무료 할당 없음) | GCP 계정·프로젝트. 무료 크레딧 있음 | 카드 등록, Hobby 정액 |
| 맞는 경우 | **SQLite 를 그대로 쓰고 지연도 괜찮은 최저 비용안** | 서울 지연이 꼭 필요하고 DB 를 외부로 뺄 각오가 있을 때 | 설정이 가장 쉬운 정액안. 지연은 셋 중 가장 크다 |

**권고(참고용, 결정은 사용자)**: 결정 (b) SQLite 단일 파일을 유지하려면 **Fly.io Tokyo** 가 가장 자연스럽다(볼륨 + 상시 머신 + 최저 비용). 서울 지연이 중요해지면 Cloud Run 이지만 그때는 저장소 결정 (b) 를 함께 바꿔야 한다. 어느 쪽이든 실제 배포는 결정 뒤 별도 작업이고, 배포 시 한강홍수통제소는 **운영 도메인용 키를 따로** 받아야 한다(`docs/API_KEYS.md` §1 5번).
