// dist/ を Chrome Web Store アップロード用の zip に固める。
// 使い方: npm run pack （事前に npm run build が必要）
import { createWriteStream, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// archiver は CommonJS のため createRequire 経由で読み込む
const require = createRequire(import.meta.url);
const archiver = require('archiver');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
if (!existsSync(join(dist, 'manifest.json'))) {
  console.error('dist/manifest.json が見つかりません。先に `npm run build` を実行してください。');
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
const outDir = join(root, 'release');
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `${pkg.name}-v${pkg.version}.zip`);

const output = createWriteStream(outFile);
const archive = archiver('zip', { zlib: { level: 9 } });
output.on('close', () => {
  console.log(`packed: ${outFile} (${archive.pointer()} bytes)`);
});
archive.on('warning', (err) => {
  if (err.code !== 'ENOENT') throw err;
});
archive.on('error', (err) => {
  throw err;
});
archive.pipe(output);
// dist の中身をzipのルートに入れる（Chrome Web Storeは manifest.json がzip直下にある必要がある）
archive.directory(dist, false);
await archive.finalize();
