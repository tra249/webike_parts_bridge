import {
  clearCaptureSession,
  getCaptureSession,
  getSelectorOverrides,
  setCaptureSession,
  setSelectorOverrides,
} from '../shared/storage';
import type { CaptureSession, SelectorOverrides } from '../shared/types';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let session: CaptureSession | undefined;

function render(): void {
  const empty = $('empty');
  const listSection = $('list-section');
  const meta = $('meta');
  const body = $<HTMLTableSectionElement>('parts-body');

  if (!session || session.parts.length === 0) {
    empty.classList.remove('hidden');
    listSection.classList.add('hidden');
    meta.textContent = '';
    return;
  }

  empty.classList.add('hidden');
  listSection.classList.remove('hidden');

  const total = session.parts.reduce((s, p) => s + p.quantity, 0);
  const when = new Date(session.capturedAt).toLocaleString('ja-JP');
  meta.textContent = `${session.parts.length}品番 / 合計${total}点 ・ ${when}${
    session.sourceModel ? ` ・ ${session.sourceModel}` : ''
  }`;

  body.textContent = '';
  session.parts.forEach((part, idx) => {
    const tr = document.createElement('tr');

    const tdPn = document.createElement('td');
    tdPn.className = 'pn';
    tdPn.textContent = part.partNumber;

    const tdName = document.createElement('td');
    tdName.className = 'name';
    tdName.textContent = part.partName ?? '';

    const tdQty = document.createElement('td');
    tdQty.className = 'qty-col';
    const qty = document.createElement('input');
    qty.type = 'number';
    qty.min = '1';
    qty.value = String(part.quantity);
    qty.className = 'qty-input';
    qty.addEventListener('change', () => {
      const n = parseInt(qty.value, 10);
      session!.parts[idx].quantity = Number.isFinite(n) && n > 0 ? n : 1;
      qty.value = String(session!.parts[idx].quantity);
      void persist();
    });
    tdQty.appendChild(qty);

    const tdDel = document.createElement('td');
    const del = document.createElement('button');
    del.className = 'del-btn';
    del.textContent = '削除';
    del.type = 'button';
    del.addEventListener('click', () => {
      session!.parts.splice(idx, 1);
      void persist().then(render);
    });
    tdDel.appendChild(del);

    tr.append(tdPn, tdName, tdQty, tdDel);
    body.appendChild(tr);
  });
}

async function persist(): Promise<void> {
  if (session) await setCaptureSession(session);
}

async function loadOverrides(): Promise<void> {
  const ov = await getSelectorOverrides();
  $<HTMLInputElement>('ov-yamaha').value = ov.yamahaTable ?? '';
  $<HTMLInputElement>('ov-webike-part').value = ov.webikePartInput ?? '';
  $<HTMLInputElement>('ov-webike-qty').value = ov.webikeQtyInput ?? '';
  $<HTMLInputElement>('ov-webike-maker').value = ov.webikeMakerSelect ?? '';
}

function wireEvents(): void {
  $('clear-btn').addEventListener('click', () => {
    void clearCaptureSession().then(() => {
      session = undefined;
      render();
    });
  });

  $('save-ov-btn').addEventListener('click', () => {
    const ov: SelectorOverrides = {
      yamahaTable: $<HTMLInputElement>('ov-yamaha').value.trim() || undefined,
      webikePartInput: $<HTMLInputElement>('ov-webike-part').value.trim() || undefined,
      webikeQtyInput: $<HTMLInputElement>('ov-webike-qty').value.trim() || undefined,
      webikeMakerSelect: $<HTMLInputElement>('ov-webike-maker').value.trim() || undefined,
    };
    void setSelectorOverrides(ov).then(() => {
      const status = $('ov-status');
      status.textContent = '保存しました';
      setTimeout(() => (status.textContent = ''), 2000);
    });
  });
}

async function init(): Promise<void> {
  session = await getCaptureSession();
  render();
  await loadOverrides();
  wireEvents();
}

void init();
