# webike_parts_bridge — 純正部品 品番ブリッジ (ヤマハ/カワサキ→Webike) Chrome拡張

各メーカーの純正部品カタログで集めた品番を、**Webike 純正部品 見積・注文ページ**（`genuine-estimate-input.html`）へワンクリックで転記する Chrome 拡張。

**取込元（対応メーカー）**:
- **ヤマハ** — パーツカタログ（[トップ: https://www.yamaha-motor.co.jp/parts-search/pc/](https://www.yamaha-motor.co.jp/parts-search/pc/)）の ypec アプリ「選択部品リスト」（`ypec-sss.yamaha-motor.co.jp/ypec/.../pick_list_preview.html`）
- **カワサキ** — Kawasaki ONLINE SHOP（[トップ: https://kawasaki-onlineshop.jp/shop/partscatalog/search.aspx](https://kawasaki-onlineshop.jp/shop/partscatalog/search.aspx)）の分解図 `partsillust.aspx`（部品の「選択」ボタンから取込）。※買い物かご `cart.aspx` からの取込は現状未対応。

手作業で品番を1件ずつ打ち直す手間とミスを無くすのが目的。転記時は取込元に合わせて Webike のメーカーも自動選択する。
**最後の確認・送信は人間が行う**（誤発注防止のため自動送信はしない）。

> ⚠️ **【非公式】免責事項**
> 本拡張は個人が開発した**非公式ツール**です。ヤマハ発動機株式会社・株式会社カワサキモータースジャパン・株式会社ウェビック等とは一切関係がなく、
> これらの企業から公認・提携・後援を受けたものではありません。「ヤマハ」「カワサキ」「Webike」等は各社の商標です。
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
1. **取込**: 対応メーカーのカタログで部品リストを表示 → 画面右下の取込ボタンをクリック（件数トーストが出る）。

   <img src="docs/images/btn_capture.png" alt="選択部品を取込ボタン" width="180" />

   - ヤマハ: 「選択部品リスト」（pick_list_preview）
   - カワサキ: 分解図（partsillust）で「選択」した部品
2. **転記**: Webike の純正部品ページを開き、右下の転記ボタンをクリック →
   取込元メーカーが自動選択され、全品番・数量が入力される。**内容を確認して手動で送信**。

   <img src="docs/images/btn_fill.png" alt="取込部品を転記ボタン" width="180" />

3. ツールバーの拡張アイコンから **ポップアップ** を開くと、取込元メーカー・取込リストの確認・数量編集・削除・全クリアができる。

## 開発
- `npm run dev` — Vite 開発サーバ（HMR）。
- `npm run build` — 型チェック（`tsc --noEmit`）＋本番ビルド（`dist/` を生成）。
- `npm run build:direct` — 回避策なしの素の `tsc --noEmit && vite build`（下記が不要な環境向け）。
- `npm test` — 検出ロジックの単体テスト（jsdom、ログイン不要）。
- `npm run gen:icons` — `assets/icon.svg` から `icons/` に PNG(16/48/128) を生成。
- `npm run pack` — `dist/` を `release/*.zip`（配布用）に固める。
- `npm run release` — アイコン生成 → ビルド → zip を一括実行。
- スタック: Manifest V3 / TypeScript / Vite / @crxjs/vite-plugin / Vitest。

### ビルド環境の注意（Windows）
`@crxjs/vite-plugin` は Windows 上で 2 つの非互換があり、`npm run build`（[scripts/build.mjs](scripts/build.mjs)）が自動で回避する:
- **Node のバージョン**: Node **18〜22** が必要（Node 23/24 系ではビルドがクラッシュする）。現行 Node が新しすぎる場合、
  `build.mjs` は [fnm](https://github.com/Schniz/fnm) が導入した 18〜22 系（例: `fnm install 22`）を自動検出してそれでビルドする。
- **非ASCIIパス**: プロジェクトのパスに日本語等が含まれるとビルドがクラッシュするため、その場合のみ ASCII の
  一時ディレクトリにソースをコピー（`node_modules` はジャンクション共有）してビルドし、生成物を `dist/` へ戻す。

一般的な clone 先（ASCII パス）＋ Node 18〜22 なら回避策は発動せず、そのままビルドされる。

## リリース（配布用 ZIP）
Chrome ウェブストアには申請せず、**GitHub Releases でビルド済み ZIP を配布**する（導入は上記「方法A」）。
1. 更新時は `package.json` の `version` を上げる。
2. `npm run release` で `release/webike_parts_bridge-v<version>.zip` を生成。
3. GitHub の Releases で新規タグ（例 `v0.1.0`）を作成し、その zip を Assets に添付。
- 権限は `storage` のみ（未使用の activeTab/scripting は削除済み）。ホストアクセスは対象2サイトの
  content_scripts から付与。自動送信はしない設計（誤発注防止）。データ収集・外部送信なし（[PRIVACY.md](PRIVACY.md)）。

## 構成
| パス | 役割 |
|---|---|
| `manifest.config.ts` | MV3 マニフェスト（対象URL・権限・content script） |
| `src/shared/detect.ts` | **検出の核**。テーブル/品番/入力欄の多段フォールバック検出（メーカー別） |
| `src/shared/constants.ts` | メーカー別品番正規表現・ヘッダ語彙・メーカーラベル・URLパターン |
| `src/shared/dom.ts` | 値設定（React互換 setter）・イベント発火・要素待機・トースト |
| `src/shared/storage.ts` | `chrome.storage.local` の型付きラッパ |
| `src/content/yamaha.ts` | ヤマハ側: 選択部品一覧を検出→保存（maker=yamaha） |
| `src/content/kawasaki.ts` | カワサキ側: 分解図の `data-part-number` を検出→保存（maker=kawasaki） |
| `src/content/webike.ts` | Webike側: 保存リストをフォームへ一括入力（取込元メーカーを自動選択） |
| `src/popup/` | 取込リストの確認・編集・セレクタ上書き設定 |
| `test/` | fixture HTML ＋ 検出ロジックの単体テスト |

## 品番フォーマット（検出対象）
品番書式はメーカーで異なるため `PART_NUMBER_RE_BY_MAKER`（`constants.ts`）にメーカー別で持つ:
- **ヤマハ**（ハイフン式・3系統）: 標準 `90105-06027` / モデル `1WS-E1311-00` / 詳細指定付き `BME-21711-00-P3`
- **カワサキ**: 標準 `92150-1327`（5桁-3〜4桁＋末尾枝番英字任意）/ 汎用ハードウェア `600A1000`（3桁+英字+4桁）。フレームNo `BJ250F-123456` は弾く。※分解図の取込は `data-part-number` 属性値をそのまま使うため正規表現非依存。

## 制限・注意
- 各対象ページは**JS動的アプリ**。DOM構造は非公開で変更されうる。
  拡張は「ヘッダ語彙 → 品番正規表現 → ユーザー上書き」の多段フォールバック（カワサキは `data-part-number` 属性を最優先）で検出するが、
  サイト改修で外れる場合がある。
- **自動検出が外れたとき**は、拡張ポップアップの「詳細設定」で
  各要素のCSSセレクタ（ヤマハ/カワサキ のテーブル、Webike の各欄）を手動上書きできる（DevToolsで実要素のセレクタを確認して入力）。
- **カワサキの買い物かご（cart.aspx）からの取込は現状未対応**（実機で機能せず）。分解図 `partsillust.aspx` の「選択」ボタン経由を使うこと。
- カワサキの fixture（`test/fixtures/kawasaki_*.html`）と一部品番正規表現は実DOM未確認の推定を含む。回帰は `npm test` で担保する。
- **自動送信はしない**。転記後は必ず内容を目視確認してから送信すること。

## ライセンス
[MIT License](LICENSE)。ただし上記の**免責事項**（非公式・無保証・自己責任）に同意した上で利用すること。
「ヤマハ」「Webike」等の名称・商標は各権利者に帰属し、本ライセンスの対象外です。
