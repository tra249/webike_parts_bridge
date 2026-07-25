# 新メーカー対応調査 — KTM グループ / カワサキ

> **実装ステータス（2026-07-24 実機検証後・更新）**:
> - **カワサキ = 有効**。分解図 `partsillust.aspx` の「選択」ボタン（`data-part-number` 方式・案A）からの取込→Webike転記が**実機で動作確認済み**。
>   - ⚠️ **買い物かご `cart.aspx` からの取込は NG（案B は実機で機能せず）**。当面はカワサキの取込元は「分解図の購入フォーム」に限る運用。cart 経路を活かすには `cart.aspx` の実DOM確認（§2-7-1）が必須。manifest の `cart/*` match と `detectKawasakiParts` の案Bフォールバックはコード上は温存。
> - **KTM = 一旦コメントアウト（無効化）**。取込自体（`SelectedItems` 検出）は動いたが、**転記先 Webike に KTM 純正部品の「品番入力による見積」フォームが存在しない（在庫部品の発注のみ）**ことが実機で判明し、ブリッジが成立しない。→ manifest の KTM content_scripts エントリ・popup の KTM 上書き欄・empty案内をコメントアウト。`detectKtmSelectedParts`・`constants` の KTM 定義・`content/ktm.ts`・KTMテストは温存（Webike が品番入力に対応したら manifest ブロックのコメントを外すだけで再有効化可）。§3-7-7 の「Webikeメーカー選択に存在するか」は「メーカー選択肢はあるが品番見積フォームが無い」が結論。
> - fixture と品番正規表現は依然 §5 の「⚠️推定」。カワサキ標準品番（data属性方式なので取込自体は属性値をそのまま使い正規表現非依存）は動作したが、`cart` 経路や偽陽性判定用の正規表現は実データで未確定。
> - `npm run build`＋`npm test`（22件）通過。
>
> 目的: webike_parts_bridge 拡張の「取込元メーカー」を **ヤマハ以外**へ拡張するための調査結果と実装方針。
> 対象読者: 後でこのファイルを読んで実装に入る担当（Claude/opus）。
> 調査日: 2026-07-22。一次情報は WebFetch / curl の生HTML・生成PDFで確認。**推定と確認済みを必ず区別**して記述している。
> 前提ルール: `.claude/rules/webike_parts_bridge.md`（自動送信しない／手動ボタン方式維持／多段フォールバック／`storage`のみ権限／【非公式】表記維持／fixtureは実機HTMLで確定）を厳守すること。

---

## 0. 現状の拡張の仕組み（前提のおさらい）

- **フロー**: ヤマハ `ypec` の「選択部品リスト」HTMLテーブルを [src/content/yamaha.ts](../src/content/yamaha.ts) が読み、`{partNumber, partName, quantity}` を抽出 → `chrome.storage.local` の `captureSession` に保存 → Webike 純正部品ページで [src/content/webike.ts](../src/content/webike.ts) がフォームへ一括入力。**送信は人間が手動**。
- **検出の核** [src/shared/detect.ts](../src/shared/detect.ts): テーブルを (a) ヘッダ語彙一致 → (b) 品番正規表現一致列 → (c) ユーザー上書きセレクタ の多段で拾う。
- **品番判定** [src/shared/constants.ts](../src/shared/constants.ts): `PART_NUMBER_RE = /^[0-9A-Z]{3,5}(?:-[0-9A-Z]{2,5}){1,3}$/`（ヤマハ専用。**ハイフン区切り前提**）。
- **型** [src/shared/types.ts](../src/shared/types.ts): `CapturedPart` / `CaptureSession` / `SelectorOverrides`。※現状 `CaptureSession` に「どのメーカーか」を示すフィールドが無い。多メーカー化では必要（後述）。
- **manifest** [manifest.config.ts](../manifest.config.ts): `content_scripts.matches` はヤマハ ypec と Webike の2つ。権限は `storage` のみ。

### 多メーカー化で共通して必要になる変更（両メーカー共通）
1. **`CaptureSession` に `maker` フィールドを追加**（`'yamaha' | 'ktm' | 'kawasaki'`）。Webike 側の「メーカー選択」をどれにするか決めるため。
2. **Webike 側メーカー選択を汎用化**。今は `YAMAHA_MAKER_LABELS` 決め打ち → `maker` に応じたラベル集合を引くマップに。
   - Webike 純正部品はヤマハ/カワサキ/海外（KTM含む）に対応済み（[genuine-estimate-input.html](https://www.webike.net/wbs/genuine-estimate-input.html) 記載を確認済み）。**KTM が Webike のメーカー選択肢に実在するか**は実機で要確認（未確認）。
3. **品番正規表現をメーカー別に持つ**。KTM はハイフン無し、カワサキは 5-4桁＋汎用英数コード混在で、**ヤマハの `PART_NUMBER_RE` では拾えない**。`PART_NUMBER_RE_BY_MAKER` のようなマップ化を推奨。
4. **取込元 content script をメーカーごとに追加**（`src/content/ktm.ts`, `src/content/kawasaki.ts`）。検出関数も `detectKtmSelectedParts` / `detectKawasakiParts` を `detect.ts` に追加。

---

## 1. 結論サマリ

| メーカー | 公式サービス | リスト作成 | 取込の作りやすさ | Webike転記 |
|---|---|---|---|---|
| **カワサキ** | [Kawasaki ONLINE SHOP](https://kawasaki-onlineshop.jp/shop/partscatalog/search.aspx)（カワサキモータースジャパン公式・ASP.NET） | カート（自社EC・注文まで可） | **◎ 最易**（サーバレンダHTML＋`data-part-number`属性あり） | 国内メーカーなので確実 |
| **KTM / Husqvarna / GAS GAS** | [SparePartsFinder](https://sparepartsfinder.ktm.com/)（KTM AG公式・3ブランド共通・ASP.NET MVC） | Selected Items（カート的画面）＋ Print(PDF) | ○（URL構造は明快。ただし選択部品リストの実DOMは未確認） | 海外メーカー枠。Webike側の対応可否は要確認 |

- **カワサキが最優先候補**。`partsillust.aspx` の「選択」ボタンに `data-part-number` / `data-unit-qty` が付いており、テキストパース不要で最も堅牢に取れる。URL もクエリ付き GET でブックマーク可能＝`matches` が書きやすい。
- **KTM は URL 構造・品番体系まで判明済み**だが、肝心の「Selected Items（選択部品リスト）」に部品が入った状態の実DOM（列見出し・エクスポート）が未確認。実装前に実機 DevTools で1回確認が必要。
- 注意: カワサキ・KTM とも**公式サイト自体がカート/注文まで完結する EC**。この拡張の役割は「公式カタログで組んだ部品リストを Webike へ転記して発注する」用途（＝Webike で買いたい人向け）である点を再確認しておくこと。用途がユーザーの意図と合っているかは念のため確認推奨。

---

## 2. カワサキ（最優先・実装しやすい）

### 2-1. 重要な前提訂正（確認済み）
- 当初候補だった `https://www.kawasaki-motors.com/for_users/partscatalog/kmj/html/PCSearch.html` は **現在404**（旧JSP版は廃止）。`kawasaki-motors.com` 側の「パーツ検索」「パーツリスト」リンクはすべて下記オンラインショップへのリンクのみ。
- **現行の実体は `kawasaki-onlineshop.jp`（ASP.NET, `.aspx`）に一本化**。拡張の対象はこのドメイン。
- 公式性: フッターに `Copyright (C) Kawasaki Motors Corporation Japan All rights reserved.` を確認（＝株式会社カワサキモータースジャパン）。**確認済み**。

### 2-2. URL構造（確認済み・`matches` 候補）
| 画面 | URL | 方式 |
|---|---|---|
| パーツ検索トップ | `https://kawasaki-onlineshop.jp/shop/partscatalog/search.aspx` | GET（URL不変のフォーム） |
| 機種選択 AJAX | `/shop/partscatalog/modelyearajax.aspx`, `/shop/partscatalog/modelnameajax.aspx` | POST(JSON) |
| 分解図グループ一覧 | `/shop/partscatalog/partsillustlist.aspx?booknumber=99911-1210-54&marketingcode=ZR250-A2` | GET |
| **分解図＋部品リスト本体** | `/shop/partscatalog/partsillust.aspx?booknumber=...&marketingcode=...&illustnumber=E1111` | GET |
| カート追加 | `/shop/partscatalog/addcart.aspx` | POST（CSRFトークン `crsirefo_hidden` 必須） |
| **買い物かご（集約リスト）** | `/shop/cart/cart.aspx` | GET・ログイン不要（ゲストカート） |
| クイックオーダー | `/shop/quickorder/quickorder.aspx` | 手入力（取込対象外） |

- クエリ意味: `booknumber`=カタログ書籍ID / `marketingcode`=車種コード / `illustnumber`=分解図ID（数字4桁＋末尾英字任意, 例 `E1111`,`E1210A`,`F2120`）。
- **manifest matches 候補**: `https://kawasaki-onlineshop.jp/shop/partscatalog/*` と `https://kawasaki-onlineshop.jp/shop/cart/*`。

### 2-3. 取込元として使う画面と抽出方法
2案。**両方をフォールバックとして実装するのが堅牢**。

**案A（推奨・最堅牢）: `partsillust.aspx` の「選択」ボタンの data属性を読む**
実HTMLで確認済みの構造:
```html
<div class="btn-select btn btn-default in-order-form"
     data-part-number="600A1000"
     data-unit-qty="2"
     data-has-replacements="false">
  <span>選択</span>
</div>
```
→ `document.querySelectorAll('.btn-select[data-part-number]')` を走査し `data-part-number` / `data-unit-qty` を読むだけ。テキストパース不要。部品名は同じ行(`<tr>`)の「部品名」セルから取得。
- ただしこれは**1分解図ぶん**。ユーザーが複数分解図から選ぶ場合は都度取込する運用になる（ヤマハの「選択部品リスト」1枚で完結する体験とは異なる）。

**案B: `cart.aspx`（集約された買い物かご）をテーブル抽出**
- 複数分解図から「選択」したものが集約される。ヤマハの選択部品リストに最も近い体験。
- **未確認**: 商品が入った状態のカートの列見出し・DOM構造（`curl`ではゲストカートが空だった）。実機 DevTools 確認が必要。
- 既存 `detect.ts` のテーブル検出がほぼ流用できるはず（ASP.NET サーバレンダHTMLで `<table><tr><td>` 構造・`__VIEWSTATE`無しを確認済み）。

### 2-4. 列見出し（`partsillust.aspx` で確認済み）
```
見出し番号 | 部品番号 | 部品名 | (車種バリエーションごとの数量列 ZR250-A1,A2,...) | (選択ボタン列)
```
- カワサキは「図番」でなく **「見出し番号」**（分解図中の指示番号、例 `11004`,`16065A`）を使う。
- `HEADER_PART_NUMBER` に `部品番号` は既存語彙で拾える。`部品名` も既存 `HEADER_NAME` でOK。
- **数量に注意**: 数量列は「車種バリエーション（A1/A2/A3…）ごとの必要数」で複数列ある。単純な「数量」1列ではない。**案Aの `data-unit-qty` を使うのが安全**。

### 2-5. カワサキ品番フォーマット（実データから推定・要追加サンプル）
確認できた実例（`partsillust.aspx` 生HTMLから網羅収集）:
```
11004-1224, 11008-1253, 16065-1202/1203/1204/1306, 49002-1091,
51044-1138/1169, 92002-1143, 92004-1127, 92005-1017, 92037-1461,
92043-1263/1264, 92055-1272, 92059-1033/1262/1365, 92066-1262,
92150-1247/1327/1796, 92190-1060, 99911-1210
600A1000, 132G0630   ← 汎用ハードウェア（無ハイフン英数字）
```
推定正規表現（**1車種1画面のみのサンプル→確定でなく推定**）:
```js
// 標準品番: 5桁 - 3〜4桁 + 末尾枝番英字任意
/^\d{5}-\d{3,4}[A-Za-z]?$/
// 汎用ハードウェア（ボルト/ワッシャ等 JIS相当）: 3桁 + 英字1 + 4桁
/^\d{3}[A-Za-z]\d{4}$/
```
- **偽陽性に注意**: フレームナンバー（車体番号）の書式は `例）BJ250F-123456`（車種記号＋ハイフン＋6桁）。部品番号と混同しないよう、6桁数字サフィックスは弾くこと。
- ヤマハ `90105-06027`（5-5桁）とは桁数が違う（カワサキは 5-4桁主流）。**ヤマハ `PART_NUMBER_RE` では拾えない** → カワサキ専用正規表現が必須。

### 2-6. ログイン要否（確認済み）
- 検索フォーム／分解図・部品リスト／カート閲覧 = **ログイン不要**。
- 注文確定・支払いのみ会員登録必須（入会費・年会費無料）。
- → **品番リスト作成まではログイン不要**。ヤマハと同様、取込は非ログインでも可能な見込み。

### 2-7. カワサキ 実機 DevTools 確認TODO（未確認）
1. `cart.aspx` に**実際に商品が入った状態**の列見出し・DOM構造（案Bを使うなら必須）。
2. `data-part-number` 属性が**全行・全車種で一貫**して付くか（今回は1ページのみ確認）。
3. カート/分解図画面に**印刷/CSV/PDFエクスポート**があるか（公開ページには記載なし＝無い可能性大だが未確定）。
4. 他排気量・他年式・ジェットスキー等での品番書式の揺れ（サンプル拡充）。
5. `partsillustlist.aspx`→`partsillust.aspx` の遷移導線（POST-Redirect-GET の実挙動）。

---

## 3. KTM / Husqvarna / GAS GAS

### 3-1. 公式性・対応ブランド（確認済み）
- [ktm.com のサービス案内](https://www.ktm.com/en-us/service/spare-parts-finder.html) に "genuine KTM parts" 用公式ツールと明記。
- **1システムで3ブランド共通**（別サブドメイン＋`tenantId` で区別）:
  - KTM: `https://sparepartsfinder.ktm.com/`（tenantId=1）
  - Husqvarna: `https://sparepartsfinder.husqvarna-motorcycles.com/`
  - GAS GAS: `https://sparepartsfinder.gasgas.com/`（tenantId=5）
- build `1.0.0.0`。ASP.NET MVC（`aspxerrorpath` を確認）。

### 3-2. URL構造（確認済み・`matches` 候補）
| 画面 | URLパターン |
|---|---|
| トップ | `https://sparepartsfinder.ktm.com/` |
| 品番/名称検索 | `/Article`（フィールド: Article Number / Article Description ＋ Model Year/Model Name/Model Variant/ComponentGroup 等の絞込） |
| 検索実行結果 | `/Result/ExecuteSearch?modelIdentification={ID}&isEngine={True|False}`（`isEngine`=エンジンNo系かフレームNo系かのフラグと推定） |
| 分解図（コンポーネントグループ） | `/ComponentGroupTemplate/Index/{groupId}?modelidentifier={ID}&isEngine=False` |
| 分解図PDF印刷 | `/ComponentGroupTemplate/PrintComponentGroupTemplate/{groupId}?modelidentifier={ID}&tenantId={n}&culture={lang}` |
| **選択部品リスト** | `/ComponentGroupTemplate/SelectedItems`（ナビに「Selected Items N」件数バッジ。ボタン: Back / Print / Clear Basket） |

- ルーティングは**パスベース**（`/Controller/Action/ID`）＋クエリ。SPAハッシュではない。
- **manifest matches 候補**: `https://sparepartsfinder.ktm.com/*`＋`https://sparepartsfinder.husqvarna-motorcycles.com/*`＋`https://sparepartsfinder.gasgas.com/*`。

### 3-3. 取込元として使う画面と抽出方法
**取込元は `/ComponentGroupTemplate/SelectedItems`（選択部品リスト）が第一候補**（ヤマハの選択部品リストに相当）。
- **未確認**: 部品が入った状態の列見出し・テーブル構造・エクスポート有無。今回アクセス時はカート空でヘッダ実物が取れなかった。**実装前に実機 DevTools で1回確認必須**。
- 列見出しは **PDF出力（PrintComponentGroupTemplate）で確認済み**の以下と同型と推定（あくまで推定）:
  ```
  Pos | Part Number | Description | Additional Text | Quantity
  ```
- したがって `detect.ts` のヘッダ語彙に**英語**を追加すれば流用できる可能性が高い:
  - `HEADER_PART_NUMBER` に `Part Number`, `Article`（既存に `part number`,`number` はある）
  - `HEADER_NAME` に `Description`（既存にあり）
  - `HEADER_QTY` に `Quantity`,`Qty`（既存にあり）
- Print ボタンはサーバー側 PDF 生成の可能性が高い（PDF取込は本拡張では非対応方針＝HTMLテーブル抽出を基本にする）。

### 3-4. 品番実例（PDFから一次取得・確認済み）
モデル「500 EXC-F 6DAYS 2026」FRAME(81230) の31件から抜粋:
```
A49003001000EB, A46003002000, 79003003000, 09000008016U0,
0035080206S, 0081050141, 60011093075, 44011176140, 0125100003 ...
```
### 3-5. KTM品番フォーマット（推定・要追加サンプル）
**ヤマハ/カワサキと違い、ハイフン区切りが一切ない**（連続英数字）。観測3系統:
1. `A` 始まり＋11桁数字＋任意で英字2文字: `A49003001000EB`, `A46003002000`
2. 数字11桁＋任意サフィックス: `79003003000`, `09000008016U0`
3. 数字10桁＋任意英字: `0081050141`, `0035080206S`

推定正規表現（サンプル31件のみからの帰納・**未検証**）:
```js
/^[A]?\d{9,11}[A-Z0-9]{0,2}$/
```
- **設計上の最重要差異**: ハイフンが無いため、ヤマハ `PART_NUMBER_RE`（ハイフン必須）では**絶対に拾えない**。KTM専用正規表現が必須。
- ただしこの正規表現は「単なる長い数字列」に近く**偽陽性リスクが高い**（価格・数量・図番と誤マッチしうる）。→ KTM では正規表現単独に頼らず、**ヘッダ語彙で `Part Number` 列を特定してからその列だけ拾う**方式を優先すべき。

### 3-6. ログイン要否・地域差（確認済み/一部未確認）
- **ログイン不要**（VIN/モデル検索・分解図・PDF印刷まで到達確認済み）。
- `culture=en` は確認。`culture=ja`（日本語）の有無は**未確認**。
- 日本の実ブラウザからのジオブロック有無は**未確認**（調査ツール経由では到達できた）。

### 3-7. KTM 実機 DevTools 確認TODO（未確認）
1. **`SelectedItems` に部品を入れた状態のDOM/列見出し**（取込の要。最優先）。
2. カートの保持方式（セッションCookie / localStorage / DOM）— 拡張が何を読めば全件取れるか。
3. 分解図(Index)ページで**部品選択→カート追加がJSでどう実装されているか**（content scriptがフックする要素/イベント）。「Selected Items」から取る方針なら不要だが、分解図から直接取る案の可否判断に必要。
4. `Print` ボタン押下時のリクエストURL/レスポンス（PDF確定なら取込対象外と割り切る）。
5. `culture=ja` の可否・日本からのアクセス可否。
6. 他モデル/他コンポーネントグループでの品番書式の一貫性（サンプル拡充）。
7. Webike のメーカー選択に **KTM/Husqvarna/GAS GAS** が実在するか（転記先の可否）。

---

## 4. 既存コードへの具体的マッピング（実装の入口）

> ここは実装時の指針。実DOM確認前は fixture を「推定構造」として置き、確認後に実HTMLへ差し替えてから `npm test` を通すこと（ルール準拠）。

### 4-1. [src/shared/types.ts](../src/shared/types.ts)
```ts
export type Maker = 'yamaha' | 'ktm' | 'kawasaki';
export interface CaptureSession {
  parts: CapturedPart[];
  capturedAt: string;
  sourceModel?: string;
  maker: Maker;          // ← 追加。Webike側のメーカー選択に使う
}
```

### 4-2. [src/shared/constants.ts](../src/shared/constants.ts)
- 品番正規表現をメーカー別に:
```ts
export const PART_NUMBER_RE_BY_MAKER: Record<Maker, RegExp[]> = {
  yamaha: [/^[0-9A-Z]{3,5}(?:-[0-9A-Z]{2,5}){1,3}$/],
  kawasaki: [/^\d{5}-\d{3,4}[A-Za-z]?$/, /^\d{3}[A-Za-z]\d{4}$/],
  ktm: [/^[A]?\d{9,11}[A-Z0-9]{0,2}$/], // 偽陽性注意。ヘッダ語彙優先で使う
};
```
- ヘッダ語彙に英語を追加: `HEADER_PART_NUMBER += 'Part Number','Article'` / `HEADER_QTY += 'Quantity','Qty'`（`Description`,`Name` は既存でカバー）。
- メーカー別ラベル（Webike選択用）:
```ts
export const MAKER_LABELS: Record<Maker, string[]> = {
  yamaha: ['ヤマハ','YAMAHA'],
  kawasaki: ['カワサキ','KAWASAKI'],
  ktm: ['KTM'], // Webikeに存在するか要確認
};
```
- URLパターン追加: `KTM_URL_RE = /^https:\/\/sparepartsfinder\.(ktm|husqvarna-motorcycles|gasgas)\.com\//` / `KAWASAKI_URL_RE = /^https:\/\/kawasaki-onlineshop\.jp\/shop\/(partscatalog|cart)\//`。

### 4-3. [src/shared/detect.ts](../src/shared/detect.ts)
- `isPartNumber` をメーカー引数対応に（`PART_NUMBER_RE_BY_MAKER[maker].some(re => re.test(n))`）。
- **カワサキ専用 `detectKawasakiParts`**: まず `.btn-select[data-part-number]` を走査（案A・data属性優先）。無ければ既存テーブル検出にフォールバック（案B・cart.aspx）。
- **KTM専用 `detectKtmSelectedParts`**: `SelectedItems` テーブルをヘッダ語彙（英語含む）で検出 → `Part Number` 列を拾う。正規表現単独フォールバックは偽陽性が多いので慎重に。

### 4-4. content scripts / [manifest.config.ts](../manifest.config.ts)
- 追加: `src/content/kawasaki.ts`, `src/content/ktm.ts`（`yamaha.ts` と同型のフローティング「📥 取込」ボタン＋`maker` を付けて `setCaptureSession`）。
- `matches` 追加:
  ```
  https://kawasaki-onlineshop.jp/shop/partscatalog/*
  https://kawasaki-onlineshop.jp/shop/cart/*
  https://sparepartsfinder.ktm.com/*
  https://sparepartsfinder.husqvarna-motorcycles.com/*
  https://sparepartsfinder.gasgas.com/*
  ```
- 権限は `storage` のみ維持（ホストアクセスは matches から付与）。ルール準拠。

### 4-5. [src/content/webike.ts](../src/content/webike.ts)
- メーカー選択を `session.maker` に応じて `MAKER_LABELS[maker]` で引くよう汎用化（現状ヤマハ決め打ちを置換）。

### 4-6. テスト / fixture
- `test/fixtures/` に `kawasaki_partsillust.html`, `kawasaki_cart.html`, `ktm_selected_items.html` を追加（**まず推定構造→実機HTMLで確定**）。
- `detect.test.ts` に各メーカーの品番3系統＋偽陽性（価格・数量・図番・フレームNo `BJ250F-123456`）ケースを追加。

---

## 5. 検証ステータス早見表

| 項目 | カワサキ | KTM |
|---|---|---|
| 公式性 | ✅確認済 | ✅確認済 |
| 対象ドメイン/URL構造 | ✅確認済 | ✅確認済 |
| 部品リスト作成の存在 | ✅確認済（カート） | ✅確認済（Selected Items） |
| 部品リスト画面の実DOM/列見出し | ⚠️部分（分解図は確認・カートは未確認） | ❌未確認（PDF列見出しのみ判明） |
| 品番フォーマット | ⚠️推定（1車種サンプル） | ⚠️推定（1モデル31件） |
| data属性で直接抽出 | ✅確認済（`data-part-number`/`data-unit-qty`） | ❓未確認 |
| ログイン不要でリスト作成まで可 | ✅確認済 | ✅確認済 |
| Webikeメーカー選択に存在 | ✅（国内対応） | ❓未確認 |
| エクスポート(CSV/PDF/印刷) | ⚠️印刷/PDFは無い可能性大・未確定 | ⚠️Print(PDF)あり・HTML取込は別途 |

凡例: ✅確認済 / ⚠️推定・部分確認 / ❌未確認 / ❓要確認

---

## 6. 実装着手前にやること（順序）
1. **実機 DevTools で「取込元ページ」の実DOMを1回ずつ確認**（カワサキ=`cart.aspx`実データ＋`partsillust.aspx`の`data-*`一貫性 / KTM=`SelectedItems`実データ）。→ 3-7・2-7 のTODO。
2. 取れた実HTMLで `test/fixtures/*.html` を確定し、品番正規表現・ヘッダ語彙を実データで検証。
3. `types.ts`(maker) → `constants.ts`(正規表現/ラベル/URL) → `detect.ts`(メーカー別検出) → `content/*.ts` → `manifest` → `webike.ts` の順で実装。
4. `npm run build`＋`npm test` を通す。実機E2E（ログイン絡み）はユーザーに依頼または手順提示。
5. README・`.claude/rules/webike_parts_bridge.md`・`manifest name`（現状ヤマハ限定表記）を多メーカー対応に更新。**【非公式】表記は維持**。

---

## 付録: 一次情報URL
**KTM系**
- https://sparepartsfinder.ktm.com/ , /Article , /ComponentGroupTemplate/SelectedItems
- https://sparepartsfinder.ktm.com/ComponentGroupTemplate/Index/53483?modelidentifier=1001666662&isEngine=False
- https://sparepartsfinder.ktm.com/ComponentGroupTemplate/PrintComponentGroupTemplate/81230?modelidentifier=1003992735&tenantId=1&culture=en （品番一次ソースPDF）
- https://sparepartsfinder.husqvarna-motorcycles.com/ , https://sparepartsfinder.gasgas.com/
- https://www.ktm.com/en-us/service/spare-parts-finder.html

**カワサキ系**
- https://kawasaki-onlineshop.jp/shop/partscatalog/search.aspx
- https://kawasaki-onlineshop.jp/shop/partscatalog/partsillust.aspx?booknumber=99911-1210-54&marketingcode=ZR250-A2&illustnumber=E1111 （列見出し・`data-*`・品番の一次ソース）
- https://kawasaki-onlineshop.jp/shop/cart/cart.aspx
- https://www.kawasaki-motors.com/ （※旧 PCSearch.html は404）

**Webike（転記先）**
- https://www.webike.net/wbs/genuine-estimate-input.html
