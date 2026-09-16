"""Prettier/Biome 식 JSON 출력 — `data/*.geojson` 의 기존 포맷을 그대로 재현해 역기입한다.

규칙(관찰): 들여쓰기 2, 객체는 항상 여러 줄, 원시값 배열은 한 줄(폭 100 안이면), 원소가 둘 이상인 배열/객체들의
배열(좌표열 등)은 원소마다 줄바꿈, float 는 최단 표기. 역기입 전 원본을 이 규칙으로 재출력해 바이트가 같은지 확인한다.
"""
from __future__ import annotations

import json

WIDTH = 100
INDENT = 2


def _scalar(v) -> str:
    if isinstance(v, bool) or v is None:
        return json.dumps(v)
    if isinstance(v, float):
        s = repr(v)
        if "e" in s or "E" in s:
            s = format(v, ".10f").rstrip("0").rstrip(".")
        return s
    if isinstance(v, int):
        return str(v)
    return json.dumps(v, ensure_ascii=False)


def _is_scalar(v) -> bool:
    return not isinstance(v, (dict, list))


def _fits_inline(v) -> bool:
    """원시값만 담은 배열, 또는 그런 배열을 하나만 담은 배열은 한 줄 후보."""
    if isinstance(v, list):
        if all(_is_scalar(x) for x in v):
            return True
        if len(v) == 1:
            return _fits_inline(v[0])
        return False
    return _is_scalar(v)


def _inline(v) -> str:
    if isinstance(v, list):
        return "[" + ", ".join(_inline(x) for x in v) + "]"
    return _scalar(v)


def dumps(v, level: int = 0) -> str:
    pad = " " * (INDENT * level)
    pad_in = " " * (INDENT * (level + 1))
    if isinstance(v, dict):
        if not v:
            return "{}"
        items = [f"{pad_in}{json.dumps(k, ensure_ascii=False)}: {dumps(x, level + 1)}" for k, x in v.items()]
        return "{\n" + ",\n".join(items) + f"\n{pad}}}"
    if isinstance(v, list):
        if not v:
            return "[]"
        if _fits_inline(v):
            one = _inline(v)
            if len(one) + INDENT * level <= WIDTH:
                return one
        return "[\n" + ",\n".join(f"{pad_in}{dumps(x, level + 1)}" for x in v) + f"\n{pad}]"
    return _scalar(v)


def dumps_file(v) -> str:
    return dumps(v) + "\n"
