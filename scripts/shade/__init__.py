"""modu-valley 그늘 빌드 파이프라인 (P1).

R3c(`scripts/research/shade-pilot/canopy/`)가 확정한 방법을 그대로 구현한다:
지형(Copernicus GLO-30) + 수관(Meta/WRI 1 m CHM) → 대표일 KST 10~18 정시 9개 시각의 그늘 마스크 →
구간 속성(`shadeByHour`, `canopyCover`, `shadeRatio`) 역기입 + 계곡별 폴리곤 레이어(`data/shade/<valleyId>/`).

실행: 저장소 루트에서 `pnpm shade:build` 또는 `PYTHONPATH=scripts scripts/shade/.venv/bin/python -m shade build ...`.
"""

__version__ = "0.1.0"
