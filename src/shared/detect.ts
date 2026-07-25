import type { CapturedPart, Maker, SelectorOverrides } from './types';
import {
  HEADER_NAME,
  HEADER_PART_NUMBER,
  HEADER_QTY,
  isPartNumberFor,
  MAKER_LABELS,
  normalizePartNumber,
} from './constants';

/** 検出はテスト可能なよう Document/Element を引数で受ける（jsdomで単体テスト） */
type Root = Document | Element;

function text(el: Element | null | undefined): string {
  return (el?.textContent ?? '').trim();
}

/** display:none 等で非表示のセルか（隠し列 model-name などを部品名に拾わないため） */
function isHidden(el: Element): boolean {
  const he = el as HTMLElement;
  if (he.style && he.style.display === 'none') return true;
  const view = el.ownerDocument?.defaultView;
  if (view) {
    try {
      if (view.getComputedStyle(he).display === 'none') return true;
    } catch {
      /* jsdom等でgetComputedStyle不可な場合は無視 */
    }
  }
  return false;
}

function headerMatches(cellText: string, vocab: string[]): boolean {
  const t = cellText.toLowerCase().replace(/\s+/g, '');
  return vocab.some((v) => t.includes(v.toLowerCase().replace(/\s+/g, '')));
}

function rowCells(row: HTMLTableRowElement): HTMLTableCellElement[] {
  return Array.from(row.cells);
}

/** テーブルのヘッダ行セルを返す（thead優先、無ければ最初のtr） */
function headerCells(table: HTMLTableElement): HTMLTableCellElement[] {
  const theadRow = table.tHead?.rows[0];
  if (theadRow) return rowCells(theadRow);
  const firstRow = table.rows[0];
  return firstRow ? rowCells(firstRow) : [];
}

/** ヘッダ語彙から各列インデックスを求める */
function resolveColumns(headers: HTMLTableCellElement[]): {
  partCol: number;
  nameCol: number;
  qtyCol: number;
} {
  let partCol = -1;
  let nameCol = -1;
  let qtyCol = -1;
  headers.forEach((h, i) => {
    const t = text(h);
    if (partCol < 0 && headerMatches(t, HEADER_PART_NUMBER)) partCol = i;
    if (nameCol < 0 && headerMatches(t, HEADER_NAME)) nameCol = i;
    if (qtyCol < 0 && headerMatches(t, HEADER_QTY)) qtyCol = i;
  });
  return { partCol, nameCol, qtyCol };
}

/** データ行（ヘッダを除いた行）を返す */
function bodyRows(table: HTMLTableElement): HTMLTableRowElement[] {
  if (table.tBodies.length > 0) {
    return Array.from(table.tBodies).flatMap((tb) => Array.from(tb.rows));
  }
  // theadが無い構造では先頭行がヘッダ扱いなので1行目を除外
  const all = Array.from(table.rows);
  return table.tHead ? all : all.slice(1);
}

/** セル文字列から数量を抽出（"2" / "×2" / "2個" 等） */
function parseQty(raw: string): number {
  const m = raw.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).match(/\d+/);
  const n = m ? parseInt(m[0], 10) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** 行配列から、指定列（無ければ品番自動判定）で CapturedPart を抽出 */
function extractParts(
  rows: HTMLTableRowElement[],
  cols: { partCol: number; nameCol: number; qtyCol: number },
  maker: Maker,
): CapturedPart[] {
  const parts: CapturedPart[] = [];
  for (const row of rows) {
    const cells = rowCells(row);
    if (cells.length === 0) continue;

    // 品番列の決定: ヘッダで判明していればそれ、無ければ行内で品番正規表現に合うセルを探す
    let partIdx = cols.partCol;
    if (partIdx < 0 || partIdx >= cells.length || !isPartNumberFor(text(cells[partIdx]), maker)) {
      partIdx = cells.findIndex((c) => isPartNumberFor(text(c), maker));
    }
    if (partIdx < 0) continue;

    const partNumber = normalizePartNumber(text(cells[partIdx]));
    if (!partNumber) continue;

    const nameCell = cols.nameCol >= 0 && cols.nameCol < cells.length ? cells[cols.nameCol] : undefined;
    // 隠しセル（display:none の model-name 等）は部品名として採用しない
    const partName = nameCell && !isHidden(nameCell) ? text(nameCell) : undefined;
    const quantity = cols.qtyCol >= 0 && cols.qtyCol < cells.length ? parseQty(text(cells[cols.qtyCol])) : 1;

    parts.push({ partNumber, partName: partName || undefined, quantity });
  }
  return dedupeParts(parts);
}

/** 同一品番をまとめ、数量を合算 */
function dedupeParts(parts: CapturedPart[]): CapturedPart[] {
  const map = new Map<string, CapturedPart>();
  for (const p of parts) {
    const existing = map.get(p.partNumber);
    if (existing) {
      existing.quantity += p.quantity;
      if (!existing.partName && p.partName) existing.partName = p.partName;
    } else {
      map.set(p.partNumber, { ...p });
    }
  }
  return Array.from(map.values());
}

/**
 * HTMLテーブル群から部品を検出する共通ロジック。多段フォールバック:
 *   (0) override セレクタが指定されていればそのテーブルを最優先
 *   (a) ヘッダに品番語彙を含むテーブル
 *   (b) セル内容が品番正規表現にマッチする列を持つテーブル（品番数が最大のもの）
 * @param maker 品番書式（ハイフン有無・桁数）の判定に使うメーカー
 * @param overrideTable 手動上書きテーブルのCSSセレクタ（あれば最優先）
 */
export function detectPartsFromTables(root: Root, maker: Maker, overrideTable?: string): CapturedPart[] {
  // (0) 手動上書き
  if (overrideTable) {
    const el = root.querySelector(overrideTable);
    const table = el?.closest('table') ?? (el instanceof HTMLTableElement ? el : null);
    if (table) {
      const cols = resolveColumns(headerCells(table));
      const parts = extractParts(bodyRows(table), cols, maker);
      if (parts.length > 0) return parts;
    }
  }

  const tables = Array.from(root.querySelectorAll('table')) as HTMLTableElement[];

  // (a) ヘッダ語彙一致テーブル
  for (const table of tables) {
    const cols = resolveColumns(headerCells(table));
    if (cols.partCol >= 0) {
      const parts = extractParts(bodyRows(table), cols, maker);
      if (parts.length > 0) return parts;
    }
  }

  // (b) 品番正規表現ベース: 最も多く品番を拾えたテーブルを採用
  let best: CapturedPart[] = [];
  for (const table of tables) {
    const cols = resolveColumns(headerCells(table)); // name/qty列だけでも活かす
    const parts = extractParts(bodyRows(table), { ...cols, partCol: -1 }, maker);
    if (parts.length > best.length) best = parts;
  }
  return best;
}

/**
 * ヤマハ ypec「選択部品一覧」から部品を検出する。テーブル多段フォールバック。
 */
export function detectYamahaSelectedParts(root: Root, overrides?: SelectorOverrides): CapturedPart[] {
  return detectPartsFromTables(root, 'yamaha', overrides?.yamahaTable);
}

/**
 * KTM SparePartsFinder「Selected Items」から部品を検出する。
 * KTM品番はハイフン無しで偽陽性が出やすいため、ヘッダ語彙(Part Number/Article)で
 * 列を特定する経路を最優先する（detectPartsFromTables の (a)）。
 */
export function detectKtmSelectedParts(root: Root, overrides?: SelectorOverrides): CapturedPart[] {
  return detectPartsFromTables(root, 'ktm', overrides?.ktmTable);
}

/**
 * カワサキ Kawasaki ONLINE SHOP から部品を検出する。
 *   (0) override セレクタが指定されていればそのテーブル
 *   (A) partsillust.aspx の「選択」ボタン `.btn-select[data-part-number]`（data属性優先＝最堅牢）
 *   (B) cart.aspx 等のテーブル検出にフォールバック
 */
export function detectKawasakiParts(root: Root, overrides?: SelectorOverrides): CapturedPart[] {
  // (0) 手動上書きテーブル
  if (overrides?.kawasakiTable) {
    const parts = detectPartsFromTables(root, 'kawasaki', overrides.kawasakiTable);
    if (parts.length > 0) return parts;
  }

  // (A) data-part-number 属性（分解図 partsillust.aspx の「選択」ボタン）
  const byData = extractKawasakiByDataAttr(root);
  if (byData.length > 0) return byData;

  // (B) テーブル検出（cart.aspx 等）
  return detectPartsFromTables(root, 'kawasaki');
}

/** カワサキ: `[data-part-number]` を走査して品番・数量・部品名を抽出（テキストパース不要） */
function extractKawasakiByDataAttr(root: Root): CapturedPart[] {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-part-number]'));
  const parts: CapturedPart[] = [];
  for (const node of nodes) {
    const raw = node.getAttribute('data-part-number') ?? '';
    const partNumber = normalizePartNumber(raw);
    if (!partNumber) continue;
    const qtyRaw = node.getAttribute('data-unit-qty') ?? '';
    const quantity = qtyRaw ? parseQty(qtyRaw) : 1;
    // 部品名: 同じ行(tr)から、そのテーブルのヘッダで判明する「部品名」列を拾う
    const row = node.closest('tr') as HTMLTableRowElement | null;
    let partName: string | undefined;
    if (row) {
      const table = row.closest('table') as HTMLTableElement | null;
      const cols = table ? resolveColumns(headerCells(table)) : { partCol: -1, nameCol: -1, qtyCol: -1 };
      const cells = rowCells(row);
      const nameCell = cols.nameCol >= 0 && cols.nameCol < cells.length ? cells[cols.nameCol] : undefined;
      if (nameCell && !isHidden(nameCell)) partName = text(nameCell) || undefined;
    }
    parts.push({ partNumber, partName, quantity });
  }
  return dedupeParts(parts);
}

// ---- Webike 側フォーム検出 ----

export interface WebikeForm {
  makerSelect: HTMLSelectElement | null;
  partInputs: HTMLInputElement[];
  qtyInputs: HTMLInputElement[];
  /** 「追加フォームを展開する」等の行追加ボタン（あれば） */
  expandButton: HTMLElement | null;
}

/** name/id から連番の共通接頭辞をもつ input 群を推定 */
function groupByPrefix(inputs: HTMLInputElement[]): Map<string, HTMLInputElement[]> {
  const groups = new Map<string, HTMLInputElement[]>();
  for (const el of inputs) {
    const key = (el.name || el.id || '').replace(/[\[\]]?\d+[\]]?/g, '#').replace(/\d+/g, '#');
    if (!key) continue;
    const arr = groups.get(key) ?? [];
    arr.push(el);
    groups.set(key, arr);
  }
  return groups;
}

/**
 * Webike 純正部品フォームを検出する。
 *   - override 指定があればそれを最優先
 *   - メーカー選択: ヤマハ option を含む select
 *   - 品番入力: text系 input を name/id 接頭辞でグルーピングし、最大グループを品番欄とみなす
 *   - 数量入力: 上記グループと対になる別グループ（数値系）があれば数量欄とみなす
 */
export function detectWebikeForm(root: Root, overrides?: SelectorOverrides): WebikeForm {
  // メーカー選択
  let makerSelect: HTMLSelectElement | null = null;
  if (overrides?.webikeMakerSelect) {
    makerSelect = root.querySelector<HTMLSelectElement>(overrides.webikeMakerSelect);
  }
  if (!makerSelect) {
    // いずれかのメーカー(ヤマハ/カワサキ/KTM)の option を含む select をメーカー選択とみなす
    const allLabels = Object.values(MAKER_LABELS).flat();
    const selects = Array.from(root.querySelectorAll('select')) as HTMLSelectElement[];
    makerSelect =
      selects.find((s) =>
        Array.from(s.options).some((o) =>
          allLabels.some(
            (l) => o.text.toLowerCase().includes(l.toLowerCase()) || o.value.toLowerCase().includes(l.toLowerCase()),
          ),
        ),
      ) ?? null;
  }

  // 品番入力（override優先）
  let partInputs: HTMLInputElement[] = [];
  if (overrides?.webikePartInput) {
    partInputs = Array.from(root.querySelectorAll<HTMLInputElement>(overrides.webikePartInput));
  }
  let qtyInputs: HTMLInputElement[] = [];
  if (overrides?.webikeQtyInput) {
    qtyInputs = Array.from(root.querySelectorAll<HTMLInputElement>(overrides.webikeQtyInput));
  }

  if (partInputs.length === 0) {
    const textInputs = Array.from(
      root.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])'),
    ).filter((el) => !el.disabled && el.type !== 'hidden');
    const groups = groupByPrefix(textInputs);
    // 最大グループを品番欄とみなす
    let bestKey = '';
    let bestArr: HTMLInputElement[] = [];
    for (const [key, arr] of groups) {
      if (arr.length > bestArr.length) {
        bestArr = arr;
        bestKey = key;
      }
    }
    partInputs = bestArr;

    // 数量欄: 別グループで、品番グループと同数程度の number/text 入力
    if (qtyInputs.length === 0) {
      const numInputs = Array.from(root.querySelectorAll<HTMLInputElement>('input[type="number"]')).filter(
        (el) => !el.disabled,
      );
      if (numInputs.length > 0) {
        qtyInputs = numInputs;
      } else {
        for (const [key, arr] of groups) {
          if (key !== bestKey && arr.length >= Math.max(1, Math.floor(partInputs.length / 2))) {
            qtyInputs = arr;
            break;
          }
        }
      }
    }
  }

  // 行追加ボタン（「追加」「展開」を含むボタン/リンク）
  const clickable = Array.from(root.querySelectorAll('button, a, input[type="button"], [role="button"]')) as HTMLElement[];
  const expandButton =
    clickable.find((el) => {
      const t = (el.textContent || (el as HTMLInputElement).value || '').trim();
      return /追加|展開|増や|もっと|add|more/i.test(t);
    }) ?? null;

  return { makerSelect, partInputs, qtyInputs, expandButton };
}
