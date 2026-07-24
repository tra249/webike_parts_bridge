// assets/icon.svg から Chrome拡張用の PNG アイコン(16/48/128)を生成して icons/ に出力する。
// （public/ に置くと Vite の静的コピーと @crxjs のマニフェスト資産コピーで二重化するため、
//   publicDir 外の icons/ に出力し、マニフェストから直接参照する）
// 使い方: npm run gen:icons
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'assets', 'icon.svg');
const outDir = join(root, 'icons');
mkdirSync(outDir, { recursive: true });

const sizes = [16, 48, 128];
await Promise.all(
  sizes.map((size) =>
    sharp(src, { density: 384 })
      .resize(size, size)
      .png()
      .toFile(join(outDir, `icon${size}.png`)),
  ),
);
console.log(`generated: ${sizes.map((s) => `icon${s}.png`).join(', ')} -> public/icons/`);
