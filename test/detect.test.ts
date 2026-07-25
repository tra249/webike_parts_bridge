import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { isPartNumber, isPartNumberFor, normalizePartNumber, YAMAHA_MAKER_LABELS } from '../src/shared/constants';
import {
  detectYamahaSelectedParts,
  detectKawasakiParts,
  detectKtmSelectedParts,
  detectWebikeForm,
} from '../src/shared/detect';
import { setNativeValue, selectOptionByLabel } from '../src/shared/dom';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => readFileSync(join(here, 'fixtures', name), 'utf-8');

/**
 * vitest の jsdom 環境が用意するグローバル document を使う。
 * 別JSDOMインスタンスを作らないことで、要素が global の HTMLInputElement 等の
 * インスタンスになり instanceof 判定が正しく効く。
 */
function render(html: string): Document {
  document.body.innerHTML = html;
  return document;
}

describe('品番正規表現（3系統 + 偽陽性）', () => {
  it('標準部品(数字5-数字5)を受理', () => {
    expect(isPartNumber('90105-06027')).toBe(true);
  });
  it('モデル部品(3セグメント)を受理', () => {
    expect(isPartNumber('1WS-E1311-00')).toBe(true);
  });
  it('詳細指定付き(4セグメント)を受理', () => {
    expect(isPartNumber('BME-21711-00-P3')).toBe(true);
  });
  it('全角ハイフン/全角英数を正規化して受理', () => {
    expect(isPartNumber('１WS－E1311－00')).toBe(true);
    expect(normalizePartNumber('１WS－E1311－00')).toBe('1WS-E1311-00');
  });
  it('部品名や価格は品番として誤マッチしない', () => {
    expect(isPartNumber('ボルト，フランジ')).toBe(false);
    expect(isPartNumber('¥1,200')).toBe(false);
    expect(isPartNumber('シリンダ')).toBe(false);
    expect(isPartNumber('4')).toBe(false);
    expect(isPartNumber('')).toBe(false);
  });
});

describe('ヤマハ 選択部品一覧の検出', () => {
  it('実DOM(#flat-table)から品番・部品名・数量を抽出する', () => {
    const doc = render(fixture('yamaha_selected.html'));
    const parts = detectYamahaSelectedParts(doc);
    // 実データ3件（空テンプレ行・合計行は除外される）
    expect(parts.map((p) => p.partNumber)).toEqual(['5NY-14459-00', '4KN-2836B-11', '95E32-06016']);
    const bolt = parts.find((p) => p.partNumber === '95E32-06016');
    expect(bolt?.quantity).toBe(4);
  });

  it('回帰: 部品名が「モデル名称」列(YZ125)に汚染されない', () => {
    const doc = render(fixture('yamaha_selected.html'));
    const parts = detectYamahaSelectedParts(doc);
    // 部品名は part-name 列（ﾎﾙﾀﾞ,ｶﾞｲﾄﾞ 等）であり、隠し model-name 列(YZ125)ではない
    expect(parts.every((p) => p.partName !== 'YZ125')).toBe(true);
    expect(parts.find((p) => p.partNumber === '5NY-14459-00')?.partName).toBe('ﾎﾙﾀﾞ,ｶﾞｲﾄﾞ');
  });

  it('ヘッダが無いテーブルでも品番正規表現で拾う（フォールバックb）', () => {
    const doc = render(`
      <table>
        <tr><td>90105-06027</td><td>ボルト</td></tr>
        <tr><td>1WS-E1311-00</td><td>シリンダ</td></tr>
      </table>`);
    const parts = detectYamahaSelectedParts(doc);
    expect(parts.map((p) => p.partNumber).sort()).toEqual(['1WS-E1311-00', '90105-06027']);
    // 数量欄が無いので既定1
    expect(parts.every((p) => p.quantity === 1)).toBe(true);
  });

  it('override セレクタを最優先で使用', () => {
    const doc = render(`
      <table id="wrong"><tr><th>品番</th></tr><tr><td>00000-00000</td></tr></table>
      <table id="right"><tr><th>品番</th><th>数量</th></tr><tr><td>1WS-E1311-00</td><td>3</td></tr></table>`);
    const parts = detectYamahaSelectedParts(doc, { yamahaTable: '#right' });
    expect(parts).toHaveLength(1);
    expect(parts[0].partNumber).toBe('1WS-E1311-00');
    expect(parts[0].quantity).toBe(3);
  });
});

describe('カワサキ 品番正規表現（推定・要実機確認）', () => {
  it('標準品番 5桁-4桁 を受理', () => {
    expect(isPartNumberFor('11004-1224', 'kawasaki')).toBe(true);
    expect(isPartNumberFor('92150-1327', 'kawasaki')).toBe(true);
  });
  it('汎用ハードウェア 3桁+英字+4桁 を受理', () => {
    expect(isPartNumberFor('600A1000', 'kawasaki')).toBe(true);
    expect(isPartNumberFor('132G0630', 'kawasaki')).toBe(true);
  });
  it('フレームNo(車体番号)は品番として弾く', () => {
    expect(isPartNumberFor('BJ250F-123456', 'kawasaki')).toBe(false);
  });
  it('価格・数量は誤マッチしない', () => {
    expect(isPartNumberFor('¥3,200', 'kawasaki')).toBe(false);
    expect(isPartNumberFor('4', 'kawasaki')).toBe(false);
  });
});

describe('KTM 品番正規表現（推定・要実機確認）', () => {
  it('A始まり+11桁+英字2 / 数字11桁 / 数字10桁+英字 を受理', () => {
    expect(isPartNumberFor('A49003001000EB', 'ktm')).toBe(true);
    expect(isPartNumberFor('79003003000', 'ktm')).toBe(true);
    expect(isPartNumberFor('0035080206S', 'ktm')).toBe(true);
  });
  it('部品名や短い数字は誤マッチしない', () => {
    expect(isPartNumberFor('CLUTCH COVER', 'ktm')).toBe(false);
    expect(isPartNumberFor('2', 'ktm')).toBe(false);
  });
  it('ヤマハ品番(ハイフン式)はKTMとして弾く', () => {
    expect(isPartNumberFor('1WS-E1311-00', 'ktm')).toBe(false);
  });
});

describe('カワサキ 選択部品の検出', () => {
  it('分解図の data-part-number / data-unit-qty から抽出（案A）', () => {
    const doc = render(fixture('kawasaki_partsillust.html'));
    const parts = detectKawasakiParts(doc);
    expect(parts.map((p) => p.partNumber)).toEqual(['11004-1224', '92002-1143', '92150-1327', '600A1000']);
    expect(parts.find((p) => p.partNumber === '92150-1327')?.quantity).toBe(4);
    expect(parts.find((p) => p.partNumber === '600A1000')?.quantity).toBe(2);
    expect(parts.find((p) => p.partNumber === '11004-1224')?.partName).toBe('ｶﾞｽｹｯﾄ,ﾍｯﾄﾞ');
  });

  it('買い物かごテーブルから抽出（案B）＋フレームNoを拾わない', () => {
    const doc = render(fixture('kawasaki_cart.html'));
    const parts = detectKawasakiParts(doc);
    expect(parts.map((p) => p.partNumber)).toEqual(['11004-1224', '92150-1327', '600A1000']);
    expect(parts.some((p) => p.partNumber.includes('BJ250F'))).toBe(false);
    expect(parts.find((p) => p.partNumber === '92150-1327')?.quantity).toBe(4);
  });
});

describe('KTM Selected Items の検出', () => {
  it('ヘッダ語彙(Part Number)で列特定して抽出', () => {
    const doc = render(fixture('ktm_selected_items.html'));
    const parts = detectKtmSelectedParts(doc);
    expect(parts.map((p) => p.partNumber)).toEqual(['A49003001000EB', '79003003000', '0035080206S']);
    expect(parts.find((p) => p.partNumber === '79003003000')?.quantity).toBe(2);
    expect(parts.find((p) => p.partNumber === 'A49003001000EB')?.partName).toBe('CLUTCH COVER');
  });
});

describe('Webike フォームの検出', () => {
  it('メーカー選択・品番入力・数量入力・展開ボタンを検出', () => {
    const doc = render(fixture('webike_form.html'));
    const form = detectWebikeForm(doc);
    expect(form.makerSelect).not.toBeNull();
    expect(form.partInputs).toHaveLength(3);
    expect(form.qtyInputs).toHaveLength(3);
    expect(form.expandButton).not.toBeNull();
    expect(form.expandButton?.textContent).toContain('追加');
  });

  it('ヤマハ option を selectOptionByLabel で選べる', () => {
    const doc = render(fixture('webike_form.html'));
    const form = detectWebikeForm(doc);
    const ok = selectOptionByLabel(form.makerSelect!, YAMAHA_MAKER_LABELS);
    expect(ok).toBe(true);
    expect(form.makerSelect!.value).toBe('yamaha');
  });
});

describe('setNativeValue', () => {
  it('値を設定し input/change を発火', () => {
    const doc = render('<input id="t" type="text" />');
    const input = doc.getElementById('t') as HTMLInputElement;
    let changed = false;
    input.addEventListener('change', () => (changed = true));
    setNativeValue(input, '90105-06027');
    expect(input.value).toBe('90105-06027');
    expect(changed).toBe(true);
  });
});
