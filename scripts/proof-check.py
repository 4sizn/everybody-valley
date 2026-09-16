# -*- coding: utf-8 -*-
"""
시각 증명 이미지 사전 선별 (visual-e2e-proof 게이트 보조).

메인 세션이 눈으로 보기 **전에** 명백한 실패를 걸러낸다 — 빈 화면, 단색,
로딩 중, 너무 작은 캡처. 표준 라이브러리만 쓴다(zlib 로 PNG 를 직접 디코드).

  python3 proof_check.py <디렉터리 또는 PNG...>

판정
  FAIL  단색에 가깝다(고유색 ≤ 8 또는 채널 표준편차 < 6) → 빈 화면·로딩 의심
  WARN  한쪽 변이 200px 미만, 또는 한 색이 화면의 92% 이상 차지
  OK    위에 해당하지 않음 — 사람이 열어 확인할 대상

주의: OK 는 "내용이 맞다" 는 뜻이 아니다. 사람이 여는 단계를 대체하지 않는다.
"""

import sys
import zlib
import struct
import pathlib
import collections


def read_png(path):
    """PNG → (width, height, [ (r,g,b), ... ]). 8bit RGB/RGBA·grayscale 만."""
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("PNG 아님")
    pos, idat, meta = 8, bytearray(), None
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos : pos + 4])
        ctype = data[pos + 4 : pos + 8]
        body = data[pos + 8 : pos + 8 + length]
        if ctype == b"IHDR":
            w, h, depth, color = struct.unpack(">IIBB", body[:10])
            meta = (w, h, depth, color)
        elif ctype == b"IDAT":
            idat += body
        elif ctype == b"IEND":
            break
        pos += 12 + length
    if meta is None:
        raise ValueError("IHDR 없음")
    w, h, depth, color = meta
    if depth != 8:
        raise ValueError(f"8bit 아님(depth={depth})")
    channels = {0: 1, 2: 3, 4: 2, 6: 4}.get(color)
    if channels is None:
        raise ValueError(f"팔레트/미지원 컬러타입({color})")

    raw = zlib.decompress(bytes(idat))
    stride = w * channels
    prev = bytearray(stride)
    pixels = []
    off = 0
    # 큰 이미지는 행을 건너뛰며 표본만 본다(판정에 충분하다).
    row_step = max(1, h // 240)
    for y in range(h):
        ft = raw[off]
        off += 1
        line = bytearray(raw[off : off + stride])
        off += stride
        # PNG 필터 역변환
        if ft == 1:
            for i in range(channels, stride):
                line[i] = (line[i] + line[i - channels]) & 0xFF
        elif ft == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 0xFF
        elif ft == 3:
            for i in range(stride):
                left = line[i - channels] if i >= channels else 0
                line[i] = (line[i] + ((left + prev[i]) >> 1)) & 0xFF
        elif ft == 4:
            for i in range(stride):
                a = line[i - channels] if i >= channels else 0
                b = prev[i]
                c = prev[i - channels] if i >= channels else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 0xFF
        if y % row_step == 0:
            col_step = max(1, w // 240)
            for x in range(0, w, col_step):
                i = x * channels
                if channels >= 3:
                    pixels.append((line[i], line[i + 1], line[i + 2]))
                else:
                    g = line[i]
                    pixels.append((g, g, g))
        prev = line
    return w, h, pixels


def judge(path):
    try:
        w, h, px = read_png(path)
    except Exception as exc:  # noqa: BLE001 — 판정 도구라 원인만 보고한다
        return "FAIL", f"읽지 못했다: {exc}", None
    n = len(px)
    counts = collections.Counter(px)
    uniq = len(counts)
    top_color, top_n = counts.most_common(1)[0]
    top_ratio = top_n / n
    # 채널별 표준편차
    devs = []
    for ch in range(3):
        vals = [p[ch] for p in px]
        mean = sum(vals) / n
        devs.append((sum((v - mean) ** 2 for v in vals) / n) ** 0.5)
    max_dev = max(devs)
    info = f"{w}×{h} · 고유색 {uniq} · 최다색 {top_ratio:.0%} · 편차 {max_dev:.1f}"
    if uniq <= 8 or max_dev < 6:
        return "FAIL", f"단색에 가깝다(빈 화면·로딩 의심) — {info}", info
    if w < 200 or h < 200:
        return "WARN", f"캡처가 너무 작다 — {info}", info
    if top_ratio >= 0.92:
        return "WARN", f"한 색이 화면을 거의 덮는다 — {info}", info
    return "OK", info, info


def main(argv):
    targets = []
    for arg in argv:
        p = pathlib.Path(arg)
        if p.is_dir():
            targets += sorted(p.glob("*.png"))
        elif p.suffix.lower() == ".png":
            targets.append(p)
    if not targets:
        print("PNG 를 찾지 못했다")
        return 2
    worst = 0
    for p in targets:
        verdict, msg, _ = judge(p)
        mark = {"OK": "  OK ", "WARN": " WARN", "FAIL": " FAIL"}[verdict]
        print(f"{mark}  {p.name:44s} {msg}")
        worst = max(worst, {"OK": 0, "WARN": 1, "FAIL": 2}[verdict])
    print()
    print(f"총 {len(targets)}장 · 최악 판정 {['OK','WARN','FAIL'][worst]}")
    print("OK 는 내용이 맞다는 뜻이 아니다 — 사람이 여는 단계를 대체하지 않는다.")
    return worst

if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
