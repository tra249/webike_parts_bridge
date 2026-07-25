/** 検出ヒューリスティックで使う定数群 */

import type { Maker } from './types';

/**
 * メーカー別の純正品番正規表現。ハイフンの有無・桁数が各社で異なるため
 * 単一の正規表現では拾えない。正規化（大文字化・全角→半角）後に判定する。
 *
 * - yamaha  : ハイフン区切り。3系統
 *     標準部品(ボルト/ワッシャ等): 90105-06027   （数字5-数字5、2セグメント）
 *     モデル部品:                 1WS-E1311-00  （英数3〜5-英数4〜5-数字2、3セグメント）
 *     詳細指定付き(末尾カラー等):  BME-21711-00-P3（4セグメント）
 * - kawasaki: 標準は 5桁-3〜4桁＋末尾枝番英字任意（例 92150-1327, 16065A は…下記参照）。
 *     見出し例: 11004-1224, 92002-1143, 16065-1204。
 *     汎用ハードウェア(JIS相当): 3桁+英字1+4桁（例 600A1000, 132G0630）。
 *     ※フレームNo `BJ250F-123456`（末尾6桁）は品番でないため弾く。
 * - ktm     : ハイフン無しの連続英数字（例 A49003001000EB, 79003003000, 0035080206S）。
 *     「長い数字列」に近く偽陽性が出やすい → 検出は極力ヘッダ語彙で列を特定してから使う。
 */
export const PART_NUMBER_RE_BY_MAKER: Record<Maker, RegExp[]> = {
  yamaha: [/^[0-9A-Z]{3,5}(?:-[0-9A-Z]{2,5}){1,3}$/],
  kawasaki: [
    // 標準品番: 5桁 - 3〜4桁 + 末尾枝番英字任意（フレームNoの末尾6桁は除外するため 3〜4桁に限定）
    /^\d{5}-\d{3,4}[A-Z]?$/,
    // 汎用ハードウェア（ボルト/ワッシャ等 JIS相当）: 3桁 + 英字1 + 4桁
    /^\d{3}[A-Z]\d{4}$/,
  ],
  ktm: [/^A?\d{9,11}[A-Z0-9]{0,2}$/],
};

/**
 * ヤマハ純正品番の正規表現（後方互換のため個別公開）。
 * 新規コードは PART_NUMBER_RE_BY_MAKER / isPartNumberFor を使うこと。
 */
export const PART_NUMBER_RE = PART_NUMBER_RE_BY_MAKER.yamaha[0];

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

/** 正規化後に、指定メーカーの品番として妥当か */
export function isPartNumberFor(raw: string, maker: Maker): boolean {
  const n = normalizePartNumber(raw);
  return PART_NUMBER_RE_BY_MAKER[maker].some((re) => re.test(n));
}

/** 正規化後に品番として妥当か（既定=ヤマハ。後方互換） */
export function isPartNumber(raw: string, maker: Maker = 'yamaha'): boolean {
  return isPartNumberFor(raw, maker);
}

/** テーブルヘッダから「品番」列を見分ける語彙（日英） */
export const HEADER_PART_NUMBER = [
  '品番',
  '部品番号',
  '部品No',
  '部品No.',
  'partno',
  'part number',
  'article',
  'number',
];

/** テーブルヘッダから「数量」列を見分ける語彙（日英） */
export const HEADER_QTY = ['数量', '個数', '員数', 'qty', 'quantity'];

/**
 * テーブルヘッダから「部品名」列を見分ける語彙（日英）。
 * 注: 広すぎる「名称」は使わない（「モデル名称」「カラー名称」に誤マッチするため）。
 * 「部品名称」は「部品名」「品名」で拾える。
 */
export const HEADER_NAME = ['部品名称', '部品名', '品名', 'name', 'description'];

/** URLパターン（content scriptの動作対象確認・ポップアップの誘導判定に使用） */
export const YAMAHA_URL_RE = /^https:\/\/[^/]*\.yamaha-motor\.co\.jp\/ypec\//;
export const KAWASAKI_URL_RE = /^https:\/\/kawasaki-onlineshop\.jp\/shop\/(partscatalog|cart)\//;
export const KTM_URL_RE = /^https:\/\/sparepartsfinder\.(ktm|husqvarna-motorcycles|gasgas)\.com\//;
export const WEBIKE_URL_RE = /^https:\/\/www\.webike\.net\/wbs\/genuine-estimate-/;

/**
 * Webike のメーカー選択で各メーカーを見分ける語彙。
 * ※Webike には ヤマハ・カワサキ・KTM いずれも存在することを確認済み（2026-07-24 ユーザー確認）。
 */
export const MAKER_LABELS: Record<Maker, string[]> = {
  yamaha: ['ヤマハ', 'YAMAHA', 'yamaha'],
  kawasaki: ['カワサキ', 'KAWASAKI', 'kawasaki'],
  ktm: ['KTM', 'ktm'],
};

/** メーカー選択で「ヤマハ」を見分ける語彙（後方互換） */
export const YAMAHA_MAKER_LABELS = MAKER_LABELS.yamaha;
