# modu-valley

`docs/references/firework-map-clone.html` 데모 페이지를 **Expo(React Native for web)** 로
옮긴 프로젝트입니다. web·android·ios 세 타겟이 같은 도메인·상태·컴포넌트
트리를 쓰고, 지도 SDK 만 플랫폼별 어댑터로 갈립니다.

```
├─ apps/valley-map          Expo 앱 (web·android·ios 한 코드베이스)
├─ packages/core            플랫폼 무관 공용 모듈 (도메인·유즈케이스·상태)
├─ packages/map-style       MapLibre 스타일 명세 — 두 어댑터가 함께 쓰는 순수 데이터
├─ packages/adapter-web     maplibre-gl · DOM · localStorage 어댑터
├─ packages/adapter-native  maplibre-native · AsyncStorage 어댑터
└─ docs/references          원본 데모 HTML — 파리티 기준
```

## 실행

### web

```bash
pnpm install
pnpm web          # http://localhost:8081 (Expo web)
```

기본 라우트 `/` 는 계곡 화면, `/firework` 는 원본 데모(파리티 기준)입니다.

`pnpm web` 은 실행 전에 두 복사 스크립트를 돌립니다(`pnpm sync`).
`scripts/sync-valley-data.mjs` 는 저장소 루트 `data/*.geojson` 을
`apps/valley-map/assets/valley/*.json` 으로 복사하고, 그늘 산출물 `data/shade/**` 를
`assets/valley/shade-bundle.json` 한 파일로 합칩니다 — Metro 가 `.geojson` 을
모르고 정적 import 만 받기 때문이며, 산출물은 커밋하지 않습니다(`typecheck`·`ios`·`android`
앞에도 걸려 있습니다). 그늘 산출물이 없으면 빈 합본을 써 앱은 그대로 뜹니다. `scripts/sync-maplibre-worker.mjs` 는
maplibre-gl 워커 스크립트를 `public/maplibre/` 로 복사합니다. maplibre-gl 6 은
ESM 전용이고 워커를 별도 파일로 띄우는데 Metro 가 그 파일을 번들에 담지 않기
때문입니다. **이 단계를 건너뛰면 지도는 뜨지만 타일과 마커가 하나도 그려지지
않습니다** (워커 없이는 GeoJSON 파싱과 타일 로딩이 일어나지 않습니다).

### android / ios

지도(`@maplibre/maplibre-react-native`)와 저장소(AsyncStorage)가 네이티브
모듈이므로 **Expo Go 로는 뜨지 않습니다.** 개발 빌드를 만들어야 합니다.

```bash
pnpm prebuild     # android/ ios/ 네이티브 프로젝트 생성 (config plugin 적용)
pnpm ios          # expo run:ios      — Xcode 필요
pnpm android      # expo run:android  — Android SDK 필요
```

`pnpm prebuild` 는 `app.json` 의 `@maplibre/maplibre-react-native` config
plugin 을 적용해 iOS 는 SPM 으로 maplibre-gl-native-distribution 을, Android 는
`org.maplibre.gl:android-sdk-*` 를 걸어 줍니다. 이 단계 없이 `expo start` 로
붙으면 지도 컴포넌트를 찾지 못해 화면이 비어 나옵니다.

플랫폼별로 무엇이 다른지는 [docs/PARITY.md](docs/PARITY.md) 의
"네이티브에서 다른 것" 절에 모아 두었습니다.

## 검사

```bash
pnpm verify       # lint + typecheck + test 한 번에
pnpm lint         # biome check .
pnpm lint:fix     # biome check --write .  (안전한 수정 적용)
pnpm typecheck    # 모든 패키지 tsc --noEmit
pnpm test         # 단위·통합 테스트 (vitest, core 77 + adapter-native 22)
pnpm --filter valley-map build:web
```

린트·포매팅은 **biome 하나**로 처리합니다(ESLint·Prettier 없음).

* `biome.json` — 포매터·린터 규칙. `noConsole` 이 로깅 경계를 강제하고
  (`ConsoleLogger` 만 예외), `useLiteralKeys` 는 tsconfig 의
  `noPropertyAccessFromIndexSignature` 와 충돌해 꺼두었습니다.
* `.vscode/settings.json` — biome 을 기본 포매터로, 저장 시 포맷·import 정리.
  권장 확장은 `biomejs.biome` 이며 Prettier·ESLint 확장은 비권장으로 표시했습니다.
* `.editorconfig` — biome 포매터와 같은 값(2칸, LF, 100컬럼).
* `.githooks/pre-commit` — 스테이징된 파일만 `biome check --staged` 로 검사합니다.
  자동 수정은 하지 않습니다. `pnpm install` 시 `prepare` 스크립트가
  `core.hooksPath` 를 걸어 주고, 끄려면 `git config --unset core.hooksPath` 입니다.

## 읽을 순서

1. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 계층 구조와 의존 규칙, 플랫폼별 어댑터
2. [docs/PARITY.md](docs/PARITY.md) — 데모의 어느 코드가 어디로 갔는지, 무엇이 다른지
3. `packages/core/src/index.ts` — 공용 모듈의 공개 표면

## 상태

| 플랫폼 | 지도 | 3D 건물·한국어 라벨 | 핀치·줌 | 불꽃 파티클 | 2D UI | 영속 저장 |
| --- | --- | --- | --- | --- | --- | --- |
| web | ✅ maplibre-gl 6 | ✅ | ✅ 공유 정책 + `NavigationControl` | ✅ 커스텀 WebGL 레이어 | ✅ | ✅ localStorage |
| ios / android | ✅ maplibre-native | ✅ | ✅ 공유 정책 + 앱 `[− +]` 필 | ⛔ 불가 (아래 참고) | ✅ | ✅ AsyncStorage |

제스처(핀치 줌·더블탭 줌·기울이기·팬)는 코어의 `DEFAULT_MAP_GESTURES` 한
곳에서 정하고 두 어댑터가 각자 SDK 로 번역합니다 — SDK 기본값에 맡기면
플랫폼마다 동작이 갈립니다. 남는 차이는 [docs/PARITY.md](docs/PARITY.md) 의
"제스처" 절에 적어 두었습니다.

네이티브에서 불꽃 파티클을 **같은 방식으로는 옮길 수 없습니다.**
데모는 MapLibre 커스텀 레이어에서 카메라 MVP 행렬을 직접 받아 메르카토르
좌표의 정점을 그리는데, `@maplibre/maplibre-react-native` 는 렌더 콜백과 카메라
행렬을 노출하지 않습니다. 그래서 능력 매트릭스가 `particleLayer: false` 이고,
불꽃 버튼은 네이티브에서 흐리게 표시되며 누르면 지원하지 않는다고 알립니다.
자세한 사정과 대안은 `packages/adapter-native/src/NativeMapCapabilities.ts`
주석에 적어 두었습니다.

그 밖의 네이티브 차이(globe 투영, 최대 pitch, 목록 배치 전환 애니메이션,
Pretendard 폰트)는 [docs/PARITY.md](docs/PARITY.md) 에 정리돼 있습니다.
