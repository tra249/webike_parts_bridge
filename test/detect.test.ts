import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { isPartNumber, normalizePartNumber, YAMAHA_MAKER_LABELS } from '../src/shared/constants';
import { detectYamahaSelectedParts, detectWebikeForm } from '../src/shared/detect';
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
