/** 取込・転記の共有型定義 */

/** 取込元メーカー。Webike側のメーカー選択・品番書式の切替に使う */
export type Maker = 'yamaha' | 'kawasaki' | 'ktm';

/** カタログから取り込んだ1部品 */
export interface CapturedPart {
  /** 品番。例: "90105-06027" / "1WS-E1311-00" / "BME-21711-00-P3" */
  partNumber: string;
  /** 部品名（取得できた場合のみ） */
  partName?: string;
  /** 数量。既定はカタログ数量、無ければ1。ポップアップで編集可 */
  quantity: number;
}

/** 1回の取込セッション。chrome.storage.local のキー `captureSession` に保存 */
export interface CaptureSession {
  parts: CapturedPart[];
  /** ISO文字列（取込日時） */
  capturedAt: string;
  /** 車両モデル名（ページから取得できた場合のみ） */
  sourceModel?: string;
  /** 取込元メーカー。Webike側でどのメーカーを選ぶか決めるのに使う（既存の古いセッションには無い場合あり→読み手は 'yamaha' 既定） */
  maker: Maker;
}

/** 自動検出が外れた場合の手動セレクタ上書き。キー `selectorOverrides` に保存 */
export interface SelectorOverrides {
  /** ヤマハ側: 選択部品一覧テーブルのCSSセレクタ */
  yamahaTable?: string;
  /** カワサキ側: 選択部品リスト/カートテーブルのCSSセレクタ */
  kawasakiTable?: string;
  /** KTM側: Selected Items テーブルのCSSセレクタ */
  ktmTable?: string;
  /** Webike側: 品番入力欄群のCSSセレクタ */
  webikePartInput?: string;
  /** Webike側: 数量入力欄群のCSSセレクタ */
  webikeQtyInput?: string;
  /** Webike側: メーカー選択のCSSセレクタ */
  webikeMakerSelect?: string;
}

/** storage全体のスキーマ */
export interface StorageSchema {
  captureSession?: CaptureSession;
  selectorOverrides?: SelectorOverrides;
}
