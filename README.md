# everybody-valley · 모두밸리

계곡을 발견·비교한 뒤 선택한 계곡의 지도에서 현장 정보를 이용하는 앱.

## 기준과 적용 순서

1. GitHub `4sizn/everybody-valley`의 `main`에 저장소를 연결한다.
2. `mockup2` UI Library 1.1의 디자인 시스템·컴포넌트·선정 전/후 사용자 흐름을 먼저 구성한다.
3. `modu-valley`의 기능·환경 스펙·MapLibre 지도 컴포넌트를 연결하고 검증한다.

디자인과 사용자 흐름은 `mockup2`가 우선이다. 기능과 지도 구현은 `modu-valley`를 기준으로 유지한다.
원본 저장소는 수정하지 않는다. 비밀키, 로컬 DB, 의존성 및 임시 빌드 결과는 커밋하지 않는다.

## 작업 검증

`ponytail`, `i-have-adhd`, `visual-e2e-proof`를 적용한다.
빌드·타입·테스트와 실제 브라우저 사용자 흐름을 검증하고, 최종 화면 증거를 직접 확인해 채팅과 OS 미리보기로 제공한다.
