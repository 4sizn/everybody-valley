import { readdir, readFile, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';

const compressBr = promisify(brotliCompress);
const compressGzip = promisify(gzip);
const root = new URL('../dist/', import.meta.url);
let original = 0;
let compressed = 0;
for (const entry of await readdir(root, { recursive: true })) {
  if (!/\.(js|mjs|css|html|json)$/.test(entry)) continue;
  const file = new URL(entry, root);
  const input = await readFile(file);
  const [br, gz] = await Promise.all([
    compressBr(input, { params: { [constants.BROTLI_PARAM_QUALITY]: 8 } }),
    compressGzip(input, { level: 9 }),
  ]);
  await Promise.all([
    writeFile(new URL(`${entry}.br`, root), br),
    writeFile(new URL(`${entry}.gz`, root), gz),
  ]);
  original += input.length;
  compressed += br.length;
}
process.stdout.write(`Web compression: ${original} → ${compressed} bytes (Brotli)\n`);
