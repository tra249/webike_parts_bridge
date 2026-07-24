/** DOM操作ユーティリティ（フレームワーク互換の値設定・イベント発火・要素待機） */

/**
 * input/select/textarea に値を設定する。
 * React等はネイティブの value setter をフックして変更を検知するため、
 * プロトタイプの setter を直接呼んでから input/change を発火する。
 */
export function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  const proto =
    el instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) {
    setter.call(el, value);
  } else {
    (el as HTMLInputElement).value = value;
  }
  fireInputChange(el);
}

/** input と change を bubbles 付きで発火 */
export function fireInputChange(el: Element): void {
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** select 要素で、ラベル(表示テキスト)候補のいずれかに一致する option を選択 */
export function selectOptionByLabel(select: HTMLSelectElement, labels: string[]): boolean {
  const lowered = labels.map((l) => l.toLowerCase());
  for (const opt of Array.from(select.options)) {
    const text = opt.text.trim().toLowerCase();
    const val = opt.value.trim().toLowerCase();
    if (lowered.some((l) => text.includes(l) || val.includes(l))) {
      select.value = opt.value;
      fireInputChange(select);
      return true;
    }
  }
  return false;
}

/**
 * セレクタにマッチする要素が現れるまで待つ（動的描画対策）。
 * MutationObserver + タイムアウト。既に存在すれば即解決。
 */
export function waitForElement(selector: string, timeoutMs = 8000): Promise<Element | null> {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }
    let done = false;
    const finish = (el: Element | null) => {
      if (done) return;
      done = true;
      observer.disconnect();
      clearTimeout(timer);
      resolve(el);
    };
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) finish(el);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    const timer = setTimeout(() => finish(document.querySelector(selector)), timeoutMs);
  });
}

/**
 * フローティングボタンを常駐させる。SPAがbodyを再描画してボタンが消えても、
 * MutationObserver で検知して再マウントする。
 * @param id 固有ID（重複マウント防止に使用）
 * @param create 未マウント時に呼ばれる要素生成関数（id付き要素を返すこと）
 */
export function mountPersistentButton(id: string, create: () => HTMLElement): void {
  const ensure = (): void => {
    if (document.body && !document.getElementById(id)) {
      document.body.appendChild(create());
    }
  };
  const startObserving = (): void => {
    ensure();
    new MutationObserver(() => ensure()).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  };
  if (document.body) {
    startObserving();
  } else {
    document.addEventListener('DOMContentLoaded', startObserving, { once: true });
  }
}

/** 画面右下に一時トーストを表示（取込/転記の結果通知） */
export function showToast(message: string, kind: 'info' | 'error' = 'info'): void {
  const id = 'wpb-toast';
  document.getElementById(id)?.remove();
  const el = document.createElement('div');
  el.id = id;
  el.textContent = message;
  el.className = `wpb-toast wpb-toast--${kind}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}
