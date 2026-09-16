"""태양 위치 — R3b `shade.py` 의 `sun_position`/`local` 그대로 (astral 3.2)."""
from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from astral import Observer
from astral.sun import azimuth as sun_azimuth
from astral.sun import elevation as sun_elevation

from shade import settings as S

TZ = ZoneInfo(S.TZ)


def local(date: str, hhmm: str) -> datetime:
    return datetime.fromisoformat(f"{date}T{hhmm}:00").replace(tzinfo=TZ)


def sun_position(lon: float, lat: float, when: datetime) -> tuple[float, float]:
    """(방위각°, 고도°)."""
    obs = Observer(latitude=lat, longitude=lon)
    return float(sun_azimuth(obs, when)), float(sun_elevation(obs, when))
