/** 検出ヒューリスティックで使う定数群 */

/**
 * ヤマハ純正品番の統一正規表現。
 * 3系統をカバー:
 *   - 標準部品(ボルト/ワッシャ等): 90105-06027   （数字5-数字5、2セグメント）
 *   - モデル部品:                 1WS-E1311-00  （英数3〜5-英数4〜5-数字2、3セグメント）
 *   - 詳細指定付き(末尾カラー等):  BME-21711-00-P3（4セグメント）
 * 先頭セグメント3〜5文字 + ハイフン区切りセグメント(2〜5文字)を1〜3個。
 */
export const PART_NUMBER_RE = /^[0-9A-Z]{3,5}(?:-[0-9A-Z]{2,5}){1,3}$/;

/** 大文字化・全角ハイフン正規化した上で品番判定するためのヘルパ */
export function normalizePartNumber(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    // 全角ハイフン/長音/マイナス各種を半角ハイフンへ
    .replace(/[‐-―−－ー]/g, '-')
    // 全角英数を半角へ
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, '');
}

/** 正規化後に品番として妥当か */
export function isPartNumber(raw: string): boolean {
  return PART_NUMBER_RE.test(normalizePartNumber(raw));
}

/** テーブルヘッダから「品番」列を見分ける語彙 */
export const HEADER_PART_NUMBER = ['品番', '部品番号', '部品No', '部品No.', 'partno', 'part number', 'number'];

/** テーブルヘッダから「数量」列を見分ける語彙 */
export const HEADER_QTY = ['数量', '個数', '員数', 'qty', 'quantity'];

/**
 * テーブルヘッダから「部品名」列を見分ける語彙。
 * 注: 広すぎる「名称」は使わない（「モデル名称」「カラー名称」に誤マッチするため）。
 * 「部品名称」は「部品名」「品名」で拾える。
 */
export const HEADER_NAME = ['部品名称', '部品名', '品名', 'name', 'description'];

/** URLパターン（content scriptの動作対象確認・ポップアップの誘導判定に使用） */
export const YAMAHA_URL_RE = /^https:\/\/[^/]*\.yamaha-motor\.co\.jp\/ypec\//;
export const WEBIKE_URL_RE = /^https:\/\/www\.webike\.net\/wbs\/genuine-estimate-/;

/** メーカー選択で「ヤマハ」を見分ける語彙 */
export const YAMAHA_MAKER_LABELS = ['ヤマハ', 'YAMAHA', 'yamaha'];
