# 모두밸리 UI Library 1.0 · Design QA

**final result: passed**

## 비교 대상과 범위

- Source visual truth: `public/design/system/B10-360.svg`, 캡처 `public/design/production/source-B10-360.png`.
- Implementation: `http://127.0.0.1:4317/design/production/preview.html`, `public/design/production/facility-360.png`.
- 동일 상태: light, 백운계곡 공영주차장 선정, 자료 없음, 접힌 시트.
- 두 캡처 모두360×844px, CSS viewport360×844, 출력밀도1x, 추가 리사이즈 없음.
- Full-view combined evidence: `public/design/production/comparison-facility.png`(744×884).
- Focused header combined evidence: `public/design/production/comparison-header.png`(744×320). 원본·구현 상단300px씩 병치.
- 기존 B06는 제보 상세여서 시설 비교 대상으로 사용할 수 없음을 확인하고 B10으로 교정. 상태 불일치 캡처로 판단하지 않음.

사용자 요청은 기존 Excalidraw 화면의 픽셀 복제가 아니라 제품용 시스템으로 확장하는 것이다. 기존 지도 중심 위계·대상 유지·위험 지속 노출·핵심 행동을 비교 기준으로 삼았다. 화면 프레임의 가짜 상태바·홈 표시줄 제거, 실제 폰트와 줄바꿈, 조작 가능한 시트 추가는 의도한 변화다. 새 시스템으로 원래15개 화면을 모두 다시 구현한 것으로 주장하지 않는다.

## Findings

비교한 최종 캡처에서 남아 있는 실행 가능한 P0/P1/P2 차이는 없음.

| 필수 표면 | 관찰과 판단 |
|---|---|
| Fonts / typography | 기존 Arial+Apple SD Gothic Neo 골격에서 플랫폼 시스템폰트 우선 스택으로 전환. 본문16/24, 보조14/20, 제목 역할별 크기. 시설명 상단은18px보다 작은16px label 역할로 조정해 ‘선택한 시설’ 맥락과 공존. 시트 제목·핀에 같은 이름 반복. 의도한 위계 변경이며 읽기 가능 |
| Spacing / layout | 지도와 상단 선택대상·경보, 우측 도구, 하단 시트의 구조 유지. 48px 조작 영역과52px 행동,16px 안쪽 여백. 접힌 시트는 실제 펼침 버튼 때문에 원본보다 높으며 지도 지점은 가려지지 않음 |
| Colors / tokens | 숲색 accent#246653 유지. surface/canvas/위험 의미를 분리하고 다크 대응. 보조 색 대비 수정 후22개 핵심 텍스트 조합 검사 통과 |
| Image / icons | 같은 프로젝트 지도 SVG를 배경 도식으로 사용. 실제 지도나 계산 결과라고 표시하지 않음. 기존 Lucide SVG34개와 LICENSE 재사용. 이모지·글리프 대체 없음. 도식 확대에 따라 물길 크롭은 달라지지만 픽셀 이미지 열화 없음 |
| Copy / content | 공영주차장 이름이 헤더·핀·시트·길찾기 시연 대상에 일치. 자료 없음 문구를 ‘안전을 뜻하지 않습니다’로 명료화. 순위·시설 데이터는 명시적으로 시연 표시. 실측 시설·실시간 경보라고 주장하지 않음 |

## 수정 이력 및 후속 비교

구현 중 발견한 아래 항목을 수정한 뒤 최종 캡처로 확인했다. 초기 비교 전 캡처를 모두 보존한 것은 아니므로 이전 화면의 픽셀 차이 수치는 주장하지 않는다.

1. [P1] full 시트가 긴 상단과 경보를 가릴 수 있는 고정값 → ResizeObserver로 상단 하단+12px을 topInset에 반영. 후속 근거: sheet-full-360.png / dark-long-risk-390.png. 최종 경보 하단184px, full 시트 시작196px.
2. [P1] 대피 상황에도 일반 행동이 우선 → 대피 안내 CTA와 제보 폼 내 위험 요약. 후속 근거: dark-long-risk-390.png / report-error-dark-390.png.
3. [P2] 긴 이름 시나리오에서 다른 계곡명이 노출 → 선택된 이름에 긴 구간명만 추가. 후속 근거: dark-long-risk-390.png의 백운계곡.
4. [P2] light 보조 텍스트 대비 부족 → text-muted#607168로 수정, 두 테마 surface/canvas 대비 검사. 후속 근거: check-results.json과 facility-360.png.

## 실제 조작 검수

- 360: 시설 검색→정확한 시설 선택→선정 해제→검색어 복원. 계곡 결과→미리보기→구간 선정.
- 360: 시트3단계 버튼, 제보 필수 오류→내용 입력→이탈 확인→계속 쓰기→등록 성공.
- 390 dark: 긴 이름, 대피, 제보 실패 시 본문 유지, 폼 내부 대피 안내.
- 사진3장→추가 숨김→삭제→추가 복귀. 파일은 브라우저 메모리에서만 처리.
- 문서360: 가로 페이지 넘침 없음. 1440: 문서와 모바일 UI를 함께 검토.
- 브라우저 errors 기록 없음. 빌드 성공, 색·검색·필터·제보 검증 스크립트 통과.

## Open questions / residual gaps

실제 SDK·공식 데이터·Native 포팅·OS 보조기술·글자 확대 검증은 소비 제품 연결 시점의 작업이다. 이번 모바일 목업/디자인시스템 작업을 그 범위로 확대하지 않았다. CSS의 폰트 fallback으로 iOS/Android의 광학적 차이는 남는다. 전체 서비스 페이지가 아니라 재사용 UI와 핵심 적용 패턴을 제공한다.

## Implementation checklist

- [x] 원본과 구현을 동일 시설 상태로 캡처하고 병치 검토.
- [x] 타입/간격/색/자산/콘텐츠 확인.
- [x] 발견한 P1/P2 수정 후 재캡처.
- [x] 360/390, light/dark 및 주요 오류 복구 확인.
- [x] 빌드 소스·타입·토큰·사용 계약과 검수 범위 제공.

## Follow-up polish

제품에서 지도 SDK를 연결하면 실제 라벨 밀도와 카메라 패딩을 다시 맞춘다. 기기별 시스템 글꼴의 줄바꿈을 미세 조정한다.
