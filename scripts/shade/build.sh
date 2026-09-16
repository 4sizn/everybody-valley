#!/bin/sh
# pnpm shade:build — scripts/shade 파이썬 파이프라인을 호출한다. 환경이 없으면 설치 방법을 안내하고 멈춘다.
# 추가 인자는 CLI 로 넘어간다: pnpm shade:build -- --valley sample --no-backfill
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PY="$ROOT/scripts/shade/.venv/bin/python"
if [ ! -x "$PY" ]; then
  cat >&2 <<'MSG'
shade:build — 파이썬 환경(scripts/shade/.venv)이 없습니다. 먼저 한 번:

  python3 -m venv scripts/shade/.venv
  scripts/shade/.venv/bin/pip install -r scripts/shade/requirements.txt

  # uv 가 있으면
  uv venv scripts/shade/.venv && uv pip install --python scripts/shade/.venv/bin/python -r scripts/shade/requirements.txt

자세한 것은 scripts/shade/README.md 를 보세요.
MSG
  exit 1
fi
cd "$ROOT"
exec env PYTHONPATH="$ROOT/scripts" "$PY" -m shade build \
  --segments data/examples/example-valley.geojson \
  --facilities data/examples/example-facilities.geojson \
  --out data/shade "$@"
