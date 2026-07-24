import type { CaptureSession, SelectorOverrides, StorageSchema } from './types';

/** chrome.storage.local の薄いラッパ（型付き get/set/clear/onChange） */

async function getAll(): Promise<StorageSchema> {
  return (await chrome.storage.local.get(null)) as StorageSchema;
}

export async function getCaptureSession(): Promise<CaptureSession | undefined> {
  const { captureSession } = (await chrome.storage.local.get('captureSession')) as StorageSchema;
  return captureSession;
}

export async function setCaptureSession(session: CaptureSession): Promise<void> {
  await chrome.storage.local.set({ captureSession: session });
}

export async function clearCaptureSession(): Promise<void> {
  await chrome.storage.local.remove('captureSession');
}

export async function getSelectorOverrides(): Promise<SelectorOverrides> {
  const { selectorOverrides } = (await chrome.storage.local.get('selectorOverrides')) as StorageSchema;
  return selectorOverrides ?? {};
}

export async function setSelectorOverrides(overrides: SelectorOverrides): Promise<void> {
  await chrome.storage.local.set({ selectorOverrides: overrides });
}

/** captureSession の変化を購読（ポップアップの自動更新用） */
export function onCaptureSessionChanged(cb: (session: CaptureSession | undefined) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.captureSession) {
      cb(changes.captureSession.newValue as CaptureSession | undefined);
    }
  });
}

export { getAll };
