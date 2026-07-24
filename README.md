# webike_parts_bridge — ヤマハ→Webike 純正部品 転記 Chrome拡張

ヤマハ発動機 **パーツカタログ ypec アプリ**の「選択部品リスト」（`ypec-sss.yamaha-motor.co.jp/ypec/.../pick_list_preview.html`）に集めた純正部品を、
**Webike 純正部品 見積・注文ページ**（`genuine-estimate-input.html`）へワンクリックで転記する Chrome 拡張。

手作業で品番を1件ずつ打ち直す手間とミスを無くすのが目的。
**最後の確認・送信は人間が行う**（誤発注防止のため自動送信はしない）。

> ⚠️ **【非公式】免責事項**
> 本拡張は個人が開発した**非公式ツール**です。ヤマハ発動機株式会社・株式会社ウェビックとは一切関係がなく、
> これらの企業から公認・提携・後援を受けたものではありません。「ヤマハ」「Webike」等は各社の商標です。
> 対象サイトの DOM 構造は非公開かつ予告なく変更されうるため、動作は保証されません。
> **利用は各自の責任で**行ってください。本ツールの利用により生じたいかなる損害（誤発注を含む）についても、
> 作者は責任を負いません。誤発注防止のため、転記後は必ず内容を目視確認してから送信してください。

## インストール（開発者モード）
Chrome ウェブストアでは配布していません。以下いずれかの方法で各自導入してください。
どちらも `chrome://extensions` を開き、右上の **デベロッパーモード** を ON にしてから
「**パッケージ化されていない拡張機能を読み込む**」で対象フォルダを選ぶ、という流れは共通です。

### 方法A: ビルド済み ZIP をダウンロード（推奨・Node 不要）
1. リポジトリ右側の [**Releases**](https://github.com/tra249/webike_parts_bridge/releases) を開く。
2. 最新版の **Assets** から `webike_parts_bridge-v<version>.zip` をダウンロード。
3. ZIP を任意の場所に**解凍**する（フォルダ内に `manifest.json` が直下にあることを確認）。
4. `chrome://extensions` → **デベロッパーモード** ON →
   「パッケージ化されていない拡張機能を読み込む」で**解凍したフォルダ**を選択。
   - ※ ZIP のまま/解凍先を移動や削除すると拡張が無効になるため、置き場所は固定推奨。

### 方法B: ソースからビルド（開発者向け）
1. このリポジトリを clone（または「Code → Download ZIP」で取得して展開）。
2. `npm install` → `npm run build`（`dist/` に拡張が出力される）。
3. `chrome://extensions` → **デベロッパーモード** ON →
   「パッケージ化されていない拡張機能を読み込む」で `dist/` フォルダを選択。

## 使い方
1. **取込**: ヤマハ パーツカタログで部品を選び「選択部品リスト」（pick_list_preview）を表示 →
   画面右下の **「📥 選択部品を取込」** をクリック（件数トーストが出る）。
2. **転記**: Webike の純正部品ページを開き、右下の **「📤 取込部品を転記」** をクリック →
   メーカー=ヤマハと全品番・数量が入力される。**内容を確認して手動で送信**。
3. ツールバーの拡張アイコンから **ポップアップ** を開くと、取込リストの確認・数量編集・削除・全クリアができる。

## 開発
- `npm run dev` — Vite 開発サーバ（HMR）。
- `npm run build` — 型チェック（`tsc --noEmit`）＋本番ビルド。
- `npm test` — 検出ロジックの単体テスト（jsdom、ログイン不要）。
- `npm run gen:icons` — `assets/icon.svg` から `icons/` に PNG(16/48/128) を生成。
- `npm run pack` — `dist/` を `release/*.zip`（ストア提出用）に固める。
- `npm run release` — アイコン生成 → ビルド → zip を一括実行。
- スタック: Manifest V3 / TypeScript / Vite / @crxjs/vite-plugin / Vitest。

## Chrome ウェブストア公開
限定公開（Unlisted）での提出を想定。掲載フォームの記入内容・手順は [STORE_LISTING.md](STORE_LISTING.md)、
プライバシーポリシーは [PRIVACY.md](PRIVACY.md) を参照。
1. `npm run release` で `release/webike_parts_bridge-v<version>.zip` を生成。
2. デベロッパー ダッシュボードで新規アイテム作成 → zip アップロード。
3. STORE_LISTING.md のコピペ用テキストで掲載情報・権限説明・プライバシー申告を記入。
4. PRIVACY.md を URL 公開してポリシー URL に設定 → 限定公開で審査提出。
- 権限は `storage` のみ（未使用の activeTab/scripting は削除済み）。ホストアクセスは対象2サイトの
  content_scripts から付与。自動送信はしない設計（誤発注防止）。

## 構成
| パス | 役割 |
|---|---|
| `manifest.config.ts` | MV3 マニフェスト（対象URL・権限・content script） |
| `src/shared/detect.ts` | **検出の核**。テーブル/品番/入力欄の多段フォールバック検出 |
| `src/shared/constants.ts` | 品番正規表現・ヘッダ語彙・URLパターン |
| `src/shared/dom.ts` | 値設定（React互換 setter）・イベント発火・要素待機・トースト |
| `src/shared/storage.ts` | `chrome.storage.local` の型付きラッパ |
| `src/content/yamaha.ts` | ヤマハ側: 選択部品一覧を検出→保存 |
| `src/content/webike.ts` | Webike側: 保存リストをフォームへ一括入力 |
| `src/popup/` | 取込リストの確認・編集・セレクタ上書き設定 |
| `test/` | fixture HTML ＋ 検出ロジックの単体テスト |

## 品番フォーマット（検出対象）
検出正規表現 `PART_NUMBER_RE` は3系統をカバー:
- 標準部品（ボルト/ワッシャ等）: `90105-06027`
- モデル部品: `1WS-E1311-00`
- 詳細指定付き（末尾カラーコード等）: `BME-21711-00-P3`

## 制限・注意
- 両対象ページは**ログイン必須のJS動的アプリ**。DOM構造は非公開で変更されうる。
  拡張は「ヘッダ語彙 → 品番正規表現 → ユーザー上書き」の多段フォールバックで検出するが、
  サイト改修で外れる場合がある。
- **自動検出が外れたとき**は、拡張ポップアップの「詳細設定」で
  各要素のCSSセレクタを手動上書きできる（DevToolsで実要素のセレクタを確認して入力）。
- fixture（`test/fixtures/*.html`）は実DOM未確認の**推定構造**。
  実機確認後、実物のHTMLに合わせて更新し、`constants.ts`/`detect.ts` の暫定値を確定させること。
- **自動送信はしない**。転記後は必ず内容を目視確認してから送信すること。

## ライセンス
[MIT License](LICENSE)。ただし上記の**免責事項**（非公式・無保証・自己責任）に同意した上で利用すること。
「ヤマハ」「Webike」等の名称・商標は各権利者に帰属し、本ライセンスの対象外です。
