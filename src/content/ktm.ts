import './ui.css';
import { detectKtmSelectedParts } from '../shared/detect';
import { getSelectorOverrides, setCaptureSession } from '../shared/storage';
import { showToast, mountPersistentButton } from '../shared/dom';
import type { CaptureSession } from '../shared/types';

/** KTM/Husqvarna/GAS GAS SparePartsFinder: 「Selected Items」の部品を取り込むフローティングボタンを注入 */

const BTN_ID = 'wpb-capture-btn';

function findModelName(): string | undefined {
  const h = document.querySelector('h1, .model-name, [class*="model"]');
  const t = h?.textContent?.trim();
  return t && t.length <= 60 ? t : undefined;
}

async function capture(btn: HTMLButtonElement): Promise<void> {
  btn.disabled = true;
  try {
    const overrides = await getSelectorOverrides();
    const parts = detectKtmSelectedParts(document, overrides);
    if (parts.length === 0) {
      showToast(
        'Selected Items を検出できませんでした。\n「Selected Items」に部品を追加した状態で開いてお試しください。\n（外れる場合は拡張ポップアップでセレクタを上書きできます）',
        'error',
      );
      return;
    }
    const session: CaptureSession = {
      parts,
      capturedAt: new Date().toISOString(),
      sourceModel: findModelName(),
      maker: 'ktm',
    };
    await setCaptureSession(session);
    const total = parts.reduce((s, p) => s + p.quantity, 0);
    showToast(`${parts.length}品番（合計${total}点）を取り込みました。\nWebikeの純正部品ページで「転記」してください。`);
  } catch (e) {
    showToast(`取込に失敗しました: ${(e as Error).message}`, 'error');
  } finally {
    btn.disabled = false;
  }
}

function createButton(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.id = BTN_ID;
  btn.className = 'wpb-fab';
  btn.type = 'button';
  btn.textContent = '📥 選択部品を取込';
  btn.addEventListener('click', () => void capture(btn));
  return btn;
}

mountPersistentButton(BTN_ID, createButton);
