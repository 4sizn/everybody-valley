import React, { useState } from "react";
import {
  SearchField,
  Button,
  IconButton,
  MapTool,
  FacilityRow,
  ValleyCard,
  Chip,
  Tabs,
  MapSheet,
} from "./components.jsx";

export function ReferencePage() {
  const [query, setQuery] = useState("백운계곡");
  const [selected, setSelected] = useState(false);
  const [tab, setTab] = useState("map");
  const [sheet, setSheet] = useState("peek");
  const [message, setMessage] = useState("");
  const item = (title, crop, note, example) => (
    <article className="reference-item" key={crop}>
      <h2>{title}</h2>
      <p>{note}</p>
      <span className="reference-label">
        카카오맵 · 실기기 캡처 / 393px 환산
      </span>
      <img
        className="reference-crop"
        src={`reference/${crop}.png`}
        alt={`카카오맵 ${title} 레퍼런스`}
      />
      <span className="reference-label">
        모두밸리 · 같은 공통 컴포넌트 / 실제 조작
      </span>
      <div className="reference-live">{example}</div>
    </article>
  );
  return (
    <>
      <p className="studio-eyebrow">REFERENCE / COMPONENT ANATOMY</p>
      <h1>
        카카오맵에서 읽은,
        <br />
        가벼운 지도 UI.
      </h1>
      <p className="studio-lead">
        흰 면, 검정 정보, 파란 행동.
        <br />
        박스보다 정보가 먼저 보이도록.
      </p>
      <div className="reference-note">
        2026-09-16에 촬영한 iPhone 화면 1178×2556을 393×852로 환산했습니다. 아래
        치수는 이미지에서 읽은 근삿값입니다. 90%는 유사도 목표이며 측정된
        달성률이 아닙니다. 지도 데이터·사진·브랜드 자산은 복제하지 않았습니다.
      </div>
      <div className="reference-grid">
        {item(
          "01 검색창",
          "search",
          "좌우16 · 높이 약46→48 · radius12 · 1px 중립색 경계. 큰 녹색 테두리를 제거했습니다.",
          <SearchField
            value={query}
            onChange={setQuery}
            onBack={() => setQuery("")}
          />,
        )}
        {item(
          "02 장소·시설 행",
          "rows",
          "카드 외곽선 없이 행 하단만 구분합니다. 36px 회색 아이콘 바탕, 제목16/24, 보조14/20.",
          <>
            <ValleyCard
              name="백운계곡"
              region="경기 포천 · 계곡"
              onClick={() => setMessage("계곡 결과 → 미리보기")}
            />
            <FacilityRow
              name="백운계곡 주차장"
              type="주차장"
              valley="백운계곡"
              onClick={() => setMessage("시설 결과 → 해당 시설 지도")}
            />
          </>,
        )}
        {item(
          "03 주요·보조 행동",
          "actions",
          "작은 pill형 주요 행동과 옅은 파랑 보조 행동. 보이는 면40px, 실제 터치48px로 분리했습니다.",
          <div className="mv-inline">
            <IconButton
              label="구간 정보"
              icon="info"
              onClick={() => setMessage("구간 정보")}
            />
            <Button variant="secondary" onClick={() => setMessage("계곡 지도")}>
              계곡 지도
            </Button>
            <Button onClick={() => setMessage("시설 길찾기")}>길찾기</Button>
          </div>,
        )}
        {item(
          "04 지도 도구",
          "tools",
          "가느다란 검정 아이콘, 흰 원형 면, 작은 그림자. 선택은 파란 아이콘과 점으로 표현합니다.",
          <div className="mv-inline">
            <MapTool
              label="그늘"
              icon="tree-pine"
              selected={selected}
              onClick={() => setSelected(!selected)}
            />
            <MapTool
              label="지도 레이어"
              icon="layers"
              onClick={() => setMessage("지도 레이어")}
            />
            <MapTool
              label="주변 시설"
              icon="square-parking"
              onClick={() => setMessage("주변 시설")}
            />
          </div>,
        )}
        {item(
          "05 조건 칩",
          "chips",
          "보이는 높이 약34px, 좌우12px. 터치44px를 확보하고 칩 사이6px 간격을 적용합니다.",
          <div className="mv-inline">
            <Chip selected={selected} onClick={() => setSelected(!selected)}>
              주차장
            </Chip>
            <Chip>화장실</Chip>
            <Chip>그늘 많음</Chip>
          </div>,
        )}
        {item(
          "06 탭 위계",
          "tabs",
          "선택 항목만 파란 글자와 밑줄로 강조합니다. 모두밸리의3개 정보 탭은48px 높이를 유지합니다.",
          <Tabs
            label="지도 정보"
            options={[
              { value: "map", label: "구간 정보" },
              { value: "facility", label: "주변 시설" },
              { value: "report", label: "현장 제보" },
            ]}
            value={tab}
            onChange={setTab}
          />,
        )}
        {item(
          "07 장소 제목",
          "facility",
          "제목22/30 굵게, 유형·위치14/20 회색. 순위·평점처럼 확인되지 않은 값은 이식하지 않습니다.",
          <div>
            <h2 style={{ fontSize: 22, lineHeight: "30px", fontWeight: 700 }}>
              백운계곡 주차장
            </h2>
            <p style={{ marginTop: 4 }}>백운계곡 · 주차장</p>
            <p style={{ marginTop: 4 }}>운영 정보는 공식 안내를 확인하세요.</p>
          </div>,
        )}
        {item(
          "08 접힌 바텀시트",
          "sheet",
          "상단 radius20, 손잡이36×4, 내부 좌우16. 지도 면적을 확보하고 행동 버튼을 오른쪽으로 묶습니다.",
          <MapSheet
            title="백운계곡"
            subtitle="중류 · 구간별 이용 정보"
            state={sheet}
            onChange={setSheet}
            topInset={0}
            actions={
              <>
                <Button onClick={() => setMessage("그늘 확인")}>
                  그늘 확인
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setSheet(sheet === "peek" ? "half" : "peek")}
                >
                  구간 정보
                </Button>
              </>
            }
          >
            <p>펼친 구간 정보 · 시트 단계 버튼으로 돌아갈 수 있습니다.</p>
          </MapSheet>,
        )}
      </div>
      <p className="reference-note" role="status">
        {message || "각 표본을 눌러 선택·입력·시트 상태를 확인하세요."}
      </p>
      <p className="studio-lead">
        위험 배너, 그늘 시간, 제보 폼은 모두밸리 고유 기능입니다. 같은 토큰으로
        구성하되 카카오맵에 없는 안전 정보까지 축소하지 않습니다.
      </p>
    </>
  );
}
