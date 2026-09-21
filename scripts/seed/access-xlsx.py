#!/usr/bin/env python3
"""지방산림청 입산통제 고시 xlsx → 시더 입력 CSV.

산림청 게시판 첨부 "입산통제구역 지정 및 등산로 폐쇄현황(○○청).xlsx" 의 두 시트를 읽는다:
  - 산불조심기간 입산통제구역: 관리기관 · 산명 · 시군구 · 읍면동 · 리 · 번지 · 면적
  - 등산로 개방·폐쇄 구분내역:   관리기관 · 산명 · 시군구 · 읍면동 · 리 · 노선번호 · 구간 · 거리 · 개방여부
표 머리 두 줄(병합 셀)과 합계·소계 행은 건너뛴다. 값이 비면 바로 위 행 값을 이어받는다(병합 셀 관행).

  python3 scripts/seed/access-xlsx.py --xlsx <파일> --tag jungbu-2025 \
      --agency 중부지방산림청 --url <고시 URL> \
      --season 2025-01-24:2025-05-15 --season 2025-11-01:2025-12-15

출력: data/seed/access/<tag>/{meta.json,areas.csv,trails.csv}. openpyxl 없이 표준 라이브러리만 쓴다.
"""
import argparse
import csv
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
ROOT = Path(__file__).resolve().parents[2]


def shared_strings(z: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in z.namelist():
        return []
    out = []
    for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS):
        out.append("".join(t.text or "" for t in si.iter(f"{{{NS['m']}}}t")))
    return out


def sheets(z: zipfile.ZipFile) -> dict[str, str]:
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = {
        r.get("Id"): r.get("Target")
        for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    }
    out = {}
    for s in wb.find("m:sheets", NS):
        target = rels[s.get(f"{REL_NS}id")].lstrip("/")
        out[s.get("name")] = target if target.startswith("xl/") else f"xl/{target}"
    return out


def col_index(ref: str) -> int:
    n = 0
    for ch in re.match(r"[A-Z]+", ref).group(0):
        n = n * 26 + ord(ch) - 64
    return n - 1


def rows(z: zipfile.ZipFile, path: str, ss: list[str]) -> list[list[str]]:
    out = []
    for row in ET.fromstring(z.read(path)).iter(f"{{{NS['m']}}}row"):
        cells: list[str] = []
        for c in row.findall("m:c", NS):
            i = col_index(c.get("r"))
            while len(cells) <= i:
                cells.append("")
            v = c.find("m:v", NS)
            text = v.text if v is not None else ""
            if c.get("t") == "s" and text:
                text = ss[int(text)]
            elif c.get("t") == "inlineStr":
                text = "".join(t.text or "" for t in c.iter(f"{{{NS['m']}}}t"))
            cells[i] = re.sub(r"\s+", " ", text or "").strip()
        out.append(cells)
    return out


def cell(r: list[str], i: int) -> str:
    return r[i] if i < len(r) else ""


SKIP = re.compile(r"^(합\s*계|소\s*계|계)$")
NUMERIC = re.compile(r"^[\d.]+$")


def body(rs: list[list[str]], first_col_header: str) -> list[list[str]]:
    """머리 행(첫 칸이 '관리기관')을 찾아 그 뒤 두 줄 아래부터 자료 행. 합계·소계·빈 행 제외."""
    start = next(i for i, r in enumerate(rs) if cell(r, 0).startswith(first_col_header))
    out = []
    for r in rs[start + 2 :]:
        if not any(r):
            continue
        if SKIP.search(cell(r, 0)) or SKIP.search(cell(r, 1)):
            continue
        out.append(r)
    return out


def forward_fill(rs: list[list[str]], cols: list[int]) -> list[list[str]]:
    prev: dict[int, str] = {}
    out = []
    for r in rs:
        r = list(r) + [""] * (max(cols) + 1 - len(r))
        for i in cols:
            if r[i]:
                prev[i] = r[i]
            elif i in prev:
                r[i] = prev[i]
        out.append(r)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--xlsx", required=True)
    ap.add_argument("--tag", required=True)
    ap.add_argument("--agency", required=True)
    ap.add_argument("--url", required=True)
    ap.add_argument("--season", action="append", required=True, help="YYYY-MM-DD:YYYY-MM-DD")
    a = ap.parse_args()

    z = zipfile.ZipFile(a.xlsx)
    ss = shared_strings(z)
    sh = sheets(z)
    area_sheet = next(n for n in sh if "입산통제구역" in n and "연중" not in n)
    trail_sheet = next(n for n in sh if "등산로" in n)

    out_dir = ROOT / "data" / "seed" / "access" / a.tag
    out_dir.mkdir(parents=True, exist_ok=True)

    # 통제구역 시트: A 관리기관 · B 산명 · C 시군구 · D 읍면동 · E 리 · F 번지(요약, 첫 행만) ·
    #   G 구역내 지번(필지마다) · H 필지 면적(ha) · K 비고. 소계 행은 B 가 숫자다.
    jibun_re = re.compile(r"^산?\d+(-\d+)?[가-힣]?$")
    areas = forward_fill(body(rows(z, sh[area_sheet], ss), "관리기관"), [0, 1, 2, 3, 4])
    n = 0
    with (out_dir / "areas.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["agency", "mountain", "sigungu", "eupmyeon", "ri", "jibun", "areaHa", "note"])
        for r in areas:
            jibun = cell(r, 6).replace(" ", "")
            # 소계 행: 산명·시군구 칸에 개수(숫자)가 들어 있다
            if NUMERIC.match(cell(r, 1)) or NUMERIC.match(cell(r, 4)) or not cell(r, 4):
                continue
            if not jibun_re.match(jibun):
                continue
            w.writerow([cell(r, 0), cell(r, 1), cell(r, 2), cell(r, 3), cell(r, 4), jibun, cell(r, 7), cell(r, 10)])
            n += 1
    # 등산로 시트: A 관리기관(소계 행에만 '○○관리소(계)') · B 산명(구간 첫 행) · C 시군구 · D 읍면동 · E 리 ·
    #   F 지번(구간을 지나는 필지, 행마다) · G 구간 · H 거리(km) · I 개방여부 · J 비고. 이어지는 필지 행은 C~F 만 있다.
    trails = body(rows(z, sh[trail_sheet], ss), "관리기관")
    m = 0
    agency = ""
    group: dict[int, str] = {}
    with (out_dir / "trails.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["agency", "mountain", "sigungu", "eupmyeon", "ri", "jibun", "section", "km", "open", "note"])
        for r in trails:
            first = cell(r, 0)
            if "관리소" in first:
                agency = first.replace("(계)", "").strip()
            if first or NUMERIC.match(cell(r, 1)) or "개소" in cell(r, 1):
                continue  # 소계 행(관리소(계) · 개방(소계) · N개소)
            # 구간 머리 행이 산명·구간·거리·개방여부를 들고 있고, 하위 구간 행은 구간만 새로 적는다 —
            # 있는 칸만 갈아끼워 없는 칸(개방여부·산명)은 위 구간에서 이어받는다.
            if cell(r, 1):
                group = {1: cell(r, 1)}
            for i in (6, 7, 8, 9):
                if cell(r, i):
                    group[i] = cell(r, i)
            jibun = cell(r, 5).replace(" ", "")
            if not jibun_re.match(jibun) or not cell(r, 2):
                continue
            w.writerow([agency, group.get(1, ""), cell(r, 2), cell(r, 3), cell(r, 4), jibun,
                        group.get(6, ""), group.get(7, ""), group.get(8, ""), group.get(9, "")])
            m += 1
    meta = {
        "tag": a.tag,
        "agency": a.agency,
        "sourceUrl": a.url,
        "sourceFile": Path(a.xlsx).name,
        "seasons": [dict(zip(("from", "to"), s.split(":"))) for s in a.season],
        "sheets": {"areas": area_sheet, "trails": trail_sheet},
    }
    (out_dir / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    sys.stdout.write(f"{out_dir.relative_to(ROOT)}: 통제구역 필지 {n}행 · 등산로 {m}행\n")


if __name__ == "__main__":
    main()
