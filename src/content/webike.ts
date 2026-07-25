import './ui.css';
import { detectWebikeForm } from '../shared/detect';
import { getCaptureSession, getSelectorOverrides } from '../shared/storage';
import { setNativeValue, selectOptionByLabel, showToast, mountPersistentButton } from '../shared/dom';
import { MAKER_LABELS } from '../shared/constants';
import type { SelectorOverrides } from '../shared/types';

/** Webike純正部品ページ: 取込リストを一括入力するフローティングボタンを注入。送信はしない。 */

const BTN_ID = 'wpb-fill-btn';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 品番数に足りるまで「追加フォームを展開する」を押して行を確保 */
async function ensureRows(needed: number, overrides: SelectorOverrides): Promise<void> {
  let attempts = 0;
  while (attempts < 30) {
    const { partInputs, expandButton } = detectWebikeForm(document, overrides);
    if (partInputs.length >= needed || !expandButton) return;
    expandButton.click();
    await sleep(200);
    attempts++;
  }
}

async function fill(btn: HTMLButtonElement): Promise<void> {
  btn.disabled = true;
  try {
    const session = await getCaptureSession();
    if (!session || session.parts.length === 0) {
      showToast('取込済みの部品がありません。\n先にヤマハのカタログで「取込」してください。', 'error');
      return;
    }
    const overrides = await getSelectorOverrides();

    await ensureRows(session.parts.length, overrides);
    const form = detectWebikeForm(document, overrides);

    // メーカー選択（取込元メーカーに応じて。古いセッションには maker が無いので既定ヤマハ）
    const maker = session.maker ?? 'yamaha';
    if (form.makerSelect) {
      const selected = selectOptionByLabel(form.makerSelect, MAKER_LABELS[maker]);
      if (!selected) {
        showToast(
          `Webikeのメーカー選択で「${MAKER_LABELS[maker][0]}」を自動選択できませんでした。\nメーカーは手動で選んでから品番を確認してください。`,
          'error',
        );
      }
    }

    if (form.partInputs.length === 0) {
      showToast(
        '品番入力欄を検出できませんでした。\n拡張ポップアップでセレクタを上書きできます。',
        'error',
      );
      return;
    }

    const count = Math.min(session.parts.length, form.partInputs.length);
    for (let i = 0; i < count; i++) {
      const part = session.parts[i];
      setNativeValue(form.partInputs[i], part.partNumber);
      if (form.qtyInputs[i]) {
        setNativeValue(form.qtyInputs[i], String(part.quantity));
      }
    }

    const overflow = session.parts.length - count;
    const base = `${count}品番を転記しました。内容を確認して送信してください。`;
    if (overflow > 0) {
      showToast(`${base}\n※入力欄が不足し ${overflow} 品番を転記できませんでした。`, 'error');
    } else {
      showToast(base);
    }
  } catch (e) {
    showToast(`転記に失敗しました: ${(e as Error).message}`, 'error');
  } finally {
    btn.disabled = false;
  }
}

function createButton(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.id = BTN_ID;
  btn.className = 'wpb-fab';
  btn.type = 'button';
  btn.textContent = '📤 取込部品を転記';
  btn.addEventListener('click', () => void fill(btn));
  return btn;
}

mountPersistentButton(BTN_ID, createButton);
