import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

export default defineManifest({
  manifest_version: 3,
  name: '【非公式】純正部品 品番ブリッジ (ヤマハ→Webike)',
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
      // Webike 純正部品 見積・注文ページ（転記先）
      matches: ['https://www.webike.net/wbs/genuine-estimate-*'],
      js: ['src/content/webike.ts'],
      run_at: 'document_idle',
    },
  ],
});
