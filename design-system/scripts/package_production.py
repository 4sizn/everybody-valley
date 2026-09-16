"""Reproducible UI handoff archive; never includes local configuration or dependencies."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
out = root / 'public/design/production'
with ZipFile(out / 'design-system-package.zip', 'w', ZIP_DEFLATED) as archive:
    files = [p for folder in ('source', 'library', 'icons') for p in (out / folder).rglob('*') if p.is_file()]
    files += [out / name for name in ('tokens.json', 'IMPLEMENTATION.md', 'CHANGELOG.md', 'QA.md')]
    for path in sorted(files):
        info = ZipInfo(str(path.relative_to(out)), date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        archive.writestr(info, path.read_bytes())
