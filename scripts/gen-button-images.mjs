import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * README 用のボタン説明画像を生成する。
 * content script が注入するフローティングボタン(.wpb-fab, src/content/ui.css)の見た目を
 * 忠実に再現（青 #0b63ce・白ボールド・角丸ピル・ドロップシャドウ）。
 * 実行: node scripts/gen-button-images.mjs  → docs/images/*.png
 */

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'docs', 'images');
mkdirSync(OUT, { recursive: true });

function svg(label, w) {
  const h = 44;
  const bw = w - 16;
  const bh = 36;
  const bx = 8;
  const by = 4;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 2}" height="${h * 2}" viewBox="0 0 ${w} ${h}">
  <defs>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity="0.3"/>
    </filter>
  </defs>
  <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="18" ry="18" fill="#0b63ce" filter="url(#sh)"/>
  <text x="${w / 2}" y="${by + bh / 2}" fill="#ffffff" font-size="14" font-weight="700"
        font-family="'Segoe UI','Yu Gothic UI','Meiryo',system-ui,sans-serif"
        text-anchor="middle" dominant-baseline="central">${label}</text>
</svg>`;
}

const jobs = [
  { name: 'btn_capture.png', label: '📥 選択部品を取込', w: 180 },
  { name: 'btn_fill.png', label: '📤 取込部品を転記', w: 180 },
];

for (const j of jobs) {
  await sharp(Buffer.from(svg(j.label, j.w))).png().toFile(join(OUT, j.name));
  console.log('wrote', join('docs', 'images', j.name));
}
