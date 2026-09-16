"""CLI — `python -m shade build --segments data/examples/example-valley.geojson [--facilities data/examples/example-facilities.geojson] --out data/shade/`."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from shade.build import run_build

DEFAULT_CACHE = Path(__file__).resolve().parent / ".cache"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m shade", description="계곡 그늘 빌드 파이프라인 (P1)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build", help="구간 컬렉션 → data/shade/<valleyId>/*.geojson + 구간 속성 역기입 + index.json")
    b.add_argument("--segments", required=True, type=Path, help="구간 LineString GeoJSON (valleys.schema.json)")
    b.add_argument("--facilities", type=Path, default=None, help="시설 Point GeoJSON — 회랑에 시설 반경 200 m 를 더한다(선택)")
    b.add_argument("--out", required=True, type=Path, help="출력 디렉터리 (data/shade/)")
    b.add_argument("--cache", type=Path, default=DEFAULT_CACHE, help=f"자산 캐시 (기본 {DEFAULT_CACHE})")
    b.add_argument("--valley", action="append", default=None, help="이 valleyId 만 (여러 번 가능)")
    b.add_argument("--no-backfill", action="store_true", help="입력 geojson 의 구간 속성을 갱신하지 않는다")
    args = ap.parse_args(argv)
    if args.cmd == "build":
        run_build(args.segments, args.facilities, args.out, args.cache, args.valley, backfill=not args.no_backfill)
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
