import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

export default defineManifest({
  manifest_version: 3,
  name: '【非公式】純正部品 品番ブリッジ (ヤマハ/カワサキ→Webike)',
  version: pkg.version,
  description: pkg.description,
  icons: {
    16: 'icons/icon16.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png',
  },
  action: {
    default_popup: 'src/popup/popup.html',
    default_title: '純正部品 品番ブリッジ',
    default_icon: {
      16: 'icons/icon16.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
  },
  // 実際に使用するのは storage のみ。ホストアクセスは content_scripts の matches から付与される。
  permissions: ['storage'],
  content_scripts: [
    {
      // ヤマハ パーツカタログ ypec アプリ（選択部品リスト pick_list_preview.html の取込元）
      // 実ホストは ypec-sss.yamaha-motor.co.jp、パスは /ypec/ypec/b2c/html5/app/.../pick_list_preview.html
      matches: ['https://*.yamaha-motor.co.jp/ypec/*'],
      js: ['src/content/yamaha.ts'],
      run_at: 'document_idle',
    },
    {
      // カワサキ Kawasaki ONLINE SHOP（分解図 partsillust / 買い物かご cart の取込元）
      matches: [
        'https://kawasaki-onlineshop.jp/shop/partscatalog/*',
        'https://kawasaki-onlineshop.jp/shop/cart/*',
      ],
      js: ['src/content/kawasaki.ts'],
      run_at: 'document_idle',
    },
    // --- KTM 対応は一旦無効化（2026-07-24） ---
    // 取込自体は動作したが、転記先 Webike には KTM 純正部品の「品番入力による見積」フォームが存在せず
    // （在庫部品の発注のみ）、ブリッジが成立しないため content script の注入を停止する。
    // 検出ロジック(detectKtmSelectedParts)・定数・content/ktm.ts・テストは温存。Webike が品番入力に対応したら
    // 下記ブロックのコメントを外すだけで再有効化できる。
    // {
    //   // KTM / Husqvarna / GAS GAS SparePartsFinder（Selected Items の取込元・3ブランド共通システム）
    //   matches: [
    //     'https://sparepartsfinder.ktm.com/*',
    //     'https://sparepartsfinder.husqvarna-motorcycles.com/*',
    //     'https://sparepartsfinder.gasgas.com/*',
    //   ],
    //   js: ['src/content/ktm.ts'],
    //   run_at: 'document_idle',
    // },
    {
      // Webike 純正部品 見積・注文ページ（転記先）
      matches: ['https://www.webike.net/wbs/genuine-estimate-*'],
      js: ['src/content/webike.ts'],
      run_at: 'document_idle',
    },
  ],
});
