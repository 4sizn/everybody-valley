# 디자인 구현 비교

final result: passed

모바일·데스크톱 웹 대상. 네이티브·공개 배포·실관측의 완료를 뜻하지 않는다.

## 비교 조건

- 원본: `/Users/hsshin/Documents/lotus/mockup2`, UI Library1.1, `http://localhost:4317/design/production/preview.html`.
- 구현: `http://localhost:8085/`, production export+Hono+기존 MapLibre.
- 홈 및 백운계곡 선택/peek, light, CSS390×844, DPR1. 양쪽 PNG390×844.
- 기존127.0.0.1 탭의80% 줌 캡처는 제외하고 localhost origin에서1:1로 재캡처.
- 원본: `.proof/integration/reference-home-390-light.png`, `reference-map-390-light.png`.
- 구현: `.proof/integration/home-390-light.png`, `map-390-light.png`.
- 같은 입력에 나란히 합친 `home-comparison.png`, `map-comparison.png`를 직접 열람했다. 390px 원본 크기에서 헤더·글자·버튼이 읽혀 별도 확대 crop은 불필요했다.

## 발견·수정 이력

| 단계 | 발견 | 수정/재검증 |
| --- | --- | --- |
| 1 blocked | P2 중복 지도 컨트롤, footer순서, Metric 열 배치 | 새 UI 범위만 중복 숨김, 원본 footer, 빈 아이콘 열 유지 |
| 2 blocked | P2 홈33개로 원본 정보 밀도 변화 | 홈3곳+전체33곳 탐색, 예시 순위는 실제 목록 |
| 3 blocked | P2 헤더66px, full-width footer, 제목18px | 원본 헤더48px/안내13px/제목22px/내용 폭 버튼 적용 |
| 4 blocked | P1 뒤로가기 초안 유실, P2 초점 부재 | navigation guard와 계속 쓰기 초점, 실제 입력 보존 확인 |
| 5 blocked | P2 그늘 패널과 지도 출처 겹침 | 패널 하단 간격 확대, 출처 유지, 재캡처 |
| 최종 passed | 위 수정 후 같은 상태 재캡처·직접 비교 | 최종 비교와 workflow-proof.png에 잔여 P0/P1/P2 없음 |

## 필수 시각 요소

- 글꼴: 원본 폰트 스택·굵기·행간, 제목/작은 안내/시트 줄바꿈 비교.
- 간격: 원본 검색·필터·행·하단 메뉴·모서리·음영 유지. 시연용 상단 설명줄 제거에 따른 세로 차이는 의도적.
- 색상: 원본 light/dark 의미 토큰, 대비22쌍 통과. 기존 `/firework` 영향 방지 위해 `.mv-system` 범위 적용.
- 자산: 원본 아이콘. 목업 지도는 요구사항에 따라 실제 기존 MapLibre로 교체. 사진은 테스트 아이콘으로 업로드 동작을 검증했고 실사진 품질 평가와 구분.
- 내용: 예시 순위/안전 수치 대신 실제 카탈로그·미확인·지연·오류. 원본 용어와 정보 우선순위 유지.

## 추가 검증

- `workflow-proof.png`: dark그늘16시, 초안 이탈, 사진 등록, 합성 대피 관측.
- `responsive-proof.png`:591/592경계와1440데스크톱.360전체 시트/경보 간격도 확인.
- 직접 링크 hydration 오류를 발견해 복원 시점을 초기 렌더 후로 변경. 새 탭 오류 로그 없음.
- 상세 흐름은 [VALIDATION.md](docs/migration/VALIDATION.md).

실 API 키·도메인·운영자/정책 정보 미제공으로 공개 운영 검증은 미수행. iOS/Android는 원본 보존 범위.
