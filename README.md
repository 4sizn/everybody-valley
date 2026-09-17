# 모두밸리 · everybody-valley

`mockup2` UI Library 1.1의 디자인·사용자 흐름과 `modu-valley`의 실제 지도·계곡·제보·서버를 통합한 저장소입니다.

- **UI/UX 기준:** `design-system/` → `packages/ui/` → `apps/valley-map/src/journey/`.
- **기능 기준:** 기존 `packages/core`, MapLibre web/native 어댑터, `server`, 계곡·시설·그늘 데이터.
- **현재 출시 검증 대상:** 모바일/데스크톱 웹. 네이티브 원본과 환경은 보존했으며 원본의 네이티브 미구현 항목은 [기능 대응표](docs/migration/FEATURES.md)에 구분했습니다.
- **iOS/Android 앱:** 같은 웹 화면을 `WebShell`(WebView)로 띄웁니다. 주소는 서버 주소와 같습니다(`EXPO_PUBLIC_API_BASE`). 네이티브 원본 화면 `apps/valley-map/src/components/shell/MapScreen.tsx` 는 그대로 두었고, `apps/valley-map/src/app/index.tsx` 에서 다시 부르면 예전 화면으로 돌아갑니다.
- 원본 저장소와 운영 DB는 수정하지 않았습니다. 사용자 요청으로 연결한 VWorld 키는 Git에서 제외한 서버 환경 파일에만 보관합니다.

## 실행

Node **24.20.0**, pnpm **11.25.0**을 사용합니다.

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
# 로컬 개발: .env.local의 ALLOWED_ORIGINS=http://localhost:8084
# 외부 관측 API 없이 UI를 검증하려면 JOBS_ENABLED=false
pnpm server:dev
```

다른 터미널에서:

```sh
EXPO_PUBLIC_API_BASE=http://localhost:8787 pnpm web --port 8084
```

[앱](http://localhost:8084/) · [보존된 불꽃 데모](http://localhost:8084/firework)

## 디자인 수정

```sh
npm ci --prefix design-system
pnpm design:build
pnpm design:check
npm --prefix design-system run preview
```

[UI Library 1.1](http://localhost:4318/design/production/index.html?revision=1.1#handoff)

`design:build`는 토큰·컴포넌트·다운로드 ZIP을 만들고 앱의 UI 패키지와 아이콘을 동기화합니다. 생성물은 직접 수정하지 않습니다.

## 검증·프로덕션

```sh
pnpm verify
EXPO_NO_DOTENV=1 pnpm build
WEB_DIR="$PWD/apps/valley-map/dist" NODE_ENV=production pnpm server:start
# 또는 웹/API를 함께 실행:
docker compose up -d --build
```

운영 웹은 같은 출처의 `/api`와 `/uploads`를 사용합니다. SQLite와 사진은 영속 볼륨에 저장합니다. 컨테이너는 기본적으로 로컬 주소에만 바인딩합니다.

- [배포·백업·운영 절차](docs/PRODUCTION.md)
- [홈 배너·블로그 운영과 관심 순위](docs/CONTENT.md)
- [기능·환경 이관 대응표](docs/migration/FEATURES.md)
- [실제 브라우저 검증 기록](docs/migration/VALIDATION.md)
- [원본/구현 시각 비교](design-qa.md)
- [출시 전 설정 항목](docs/RELEASE-CHECKLIST.md)

공개 서비스 주소·TLS·실제 정부 API 키·운영자 정보/정책은 운영 환경에 맞게 설정해야 합니다. 로컬 컨테이너 검증을 공개 배포나 실관측 검증으로 표시하지 않습니다. 기존 `docs/RELEASE_V1.md`, `docs/TODO.md` 등은 **modu-valley 이관 당시 기록**이며, 이 저장소의 최신 기준은 위 문서입니다.
