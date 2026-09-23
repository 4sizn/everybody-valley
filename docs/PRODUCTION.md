# 프로덕션 실행·운영

## 환경

Node 24.20.0 / pnpm 11.25.0. 공개 웹과 API는 같은 출처로 운영하는 구성이 기본이다. 빌드 때 `.env.local`이 번들에 섞이지 않게 `EXPO_NO_DOTENV=1`을 사용한다. 개발용 `EXPO_PUBLIC_API_BASE`는 운영 빌드에 넣지 않는다.

```sh
cp .env.example .env.local
# 실제 origin, 운영용 API 키, ADMIN_TOKEN을 .env.local에 설정
pnpm install --frozen-lockfile
pnpm verify
EXPO_NO_DOTENV=1 pnpm build
WEB_DIR="$PWD/apps/valley-map/dist" NODE_ENV=production pnpm server:start
```

단일 서버가 `/`, `/firework`, 지도 워커/아이콘, `/api/*`, `/uploads/*`를 제공한다. 정적 파일은 Brotli/gzip 사전 압축, HTML은 no-cache다. 잘못된 API 경로는 HTML 대신 JSON 404를 반환한다.

## 컨테이너

```sh
docker compose up -d --build
curl --fail http://127.0.0.1:8787/healthz
docker compose logs --tail=80 app
```

- 기본 바인딩 `127.0.0.1:8787`; 운영 HTTPS reverse proxy가 이 주소로 전달한다. 자동으로 외부 공개하지 않는다.
- `/data` named volume에 DB와 사진을 함께 보존한다. 컨테이너 교체 때 이 볼륨을 삭제하지 않는다.
- `TRUST_PROXY=false` 기본. 프록시가 외부의 전달 헤더를 덮어쓰고 서버 직접 접근이 차단된 경우에만 true로 바꾼다.
- `ALLOWED_ORIGINS`는 실제 서비스 origin을 정확히 입력한다.
- `/api/events`는 SSE이므로 reverse proxy 응답 버퍼링을 끄고 읽기 타임아웃을 하트비트(15초)보다 길게 둔다.
- 컨테이너는 비루트 node 사용자, init, 자동 재시작, healthcheck를 사용한다.

## 외부 API

키 발급/출처 목록은 [API_KEYS.md](API_KEYS.md). 서버만 비밀키를 읽는다. 현재 런타임 설정이 실제로 쓰는 이름은 `VWORLD_API_KEY`, `HRFCO_API_KEY`(없으면 `_LOCAL`), `KMA_APIHUB_KEY`, `DATA_GO_KR_KEY_ENCODING/DECODING`이다. VWorld 운영키를 발급받았다면 런타임의 `VWORLD_API_KEY`에 넣는다.

`daily_temps` 표(마이그레이션 0007)는 **미사용**이다 — 2026-09-23 단풍 판정을 기상청 계절관측 API 로 바꾸며 접기·백필을 걷어냈고, 마이그레이션은 되돌리지 않는 규칙이라 표만 남았다. 운영 DB 의 행은 같은 날 비웠다(16,728행, 백업 `server/data/valley.db.bak-20260923-1421`). 새로 채우는 코드는 없다.

단풍 판정(`/api/foliage`)은 **기상청 API허브 계절관측**(`sfc_ssn.php` 관측 · `sfc_ssn_norm.php` 평년)만 근거로 한다. `KMA_APIHUB_KEY`에 두 API의 **활용신청**이 있어야 `season` 폴러(4시간마다)가 `season_obs`·`season_norm`을 채운다. 신청 전에는 403으로 실패하고 배지는 "관측 지점 없음"으로 숨는다.

이 맥의 로컬 운영 서버(8788)는 launchd 사용자 에이전트 `server/launchd/kr.moduvalley.server.plist` 로 상주한다(로그인 시 시작, 죽으면 10초 뒤 재시작, 로그 `~/Library/Logs/moduvalley/server-8788.log`). 새 빌드를 반영하려면 `pnpm build` 뒤 `launchctl kickstart -k gui/$(id -u)/kr.moduvalley.server`. 설치·해제 명령은 plist 머리말에 있다. Docker 데몬(colima)이 늘 떠 있지 않아 compose 대신 쓴다.

토지 조회 `/api/land/:valleyId`는 `VWORLD_API_KEY`가 없으면 `503 vworld_key_missing`을 반환한다. 로컬 서버는 루트 `.env.local`, 8086 미리보기 컨테이너는 `--env-file .env.preview.local`로 키와 `VWORLD_DOMAIN`을 읽는다. 두 파일은 Git에서 제외한다. 환경 파일 수정 후 로컬 서버를 재시작하거나 컨테이너를 같은 데이터 볼륨으로 재생성해야 반영된다. `/healthz`의 `keys.vworld: true`와 실제 토지 API의 `200` 응답을 모두 확인한다. 키 값은 클라이언트 코드나 `EXPO_PUBLIC_*`에 넣지 않는다.

`JOBS_ENABLED=false`는 격리된 UI 검증용이다. 운영은 true로 두고 `/healthz`의 키 존재 여부와 `lastPoll`, 실제 관측시각을 확인한다. 관측소가 연결되지 않은 계곡이나 지연 자료를 안전하다고 표시하지 않는다. 키 없이 수행한 로컬 검증은 실관측 검증이 아니다.

## 백업·복원

DB와 사진은 같은 시점으로 묶어 보관한다. 단일 인스턴스의 일관된 백업을 위해 쓰기를 잠시 중단하고 실행한다.

```sh
docker compose stop app
mkdir -p backups
docker compose cp app:/data ./backups/data
# 백업 파일을 다른 보관 위치로 복제한 뒤
docker compose start app
```

다른 복원용 인스턴스에서 데이터 디렉터리 전체를 복원하고 `/healthz`, 기존 제보와 사진을 확인한 뒤 트래픽을 전환한다. `docker compose down -v`는 영속 데이터 삭제이므로 운영 재배포 절차에 사용하지 않는다. 스키마 변경 전 백업을 만든다. 자동 마이그레이션은 시작 시 실행된다.

## 릴리스·롤백

1. `pnpm verify`, `pnpm design:check`, 프로덕션 빌드 및 주요 브라우저 흐름 통과.
2. 같은 커밋으로 이미지를 생성하고 staging의 별도 DB에서 확인.
3. 운영 설정과 백업을 확인하고 이미지를 교체.
4. 건강 상태, 관측 갱신, 제보/사진/관리자 인증을 확인.
5. 이상 시 이전 이미지로 되돌린다. DB 스키마가 바뀐 릴리스는 이전 DB 백업과의 호환성을 먼저 확인한다.

현재 GitHub Actions는 디자인 생성물 일치, lint/typecheck/테스트, 웹/API export, Docker build와 부팅을 검사한다. 실제 HTTPS 서비스 주소 및 클라우드 자원은 임의로 생성하지 않는다.
