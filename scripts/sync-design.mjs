import { cp, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
for (const name of ['index.js', 'index.css', 'index.d.ts']) {
  await cp(
    new URL(`design-system/public/design/production/library/${name}`, root),
    new URL(`packages/ui/${name}`, root),
  );
}
// Keep UI 1.1 variables inside the new app; the preserved /firework has its own palette.
const cssFile = new URL('packages/ui/index.css', root);
await writeFile(
  cssFile,
  (await readFile(cssFile, 'utf8'))
    .replaceAll(':root', '.mv-system')
    .replaceAll('[data-theme=', '.mv-system[data-theme='),
);
await cp(
  new URL('design-system/public/design/system/icons', root),
  new URL('apps/valley-map/public/moduvalley/icons', root),
  { recursive: true },
);
process.stdout.write(`Design library synced to ${fileURLToPath(new URL('packages/ui', root))}\n`);
