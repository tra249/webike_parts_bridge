// 型チェック（tsc --noEmit）＋ 本番ビルド（vite build）を実行する。
//
// このスクリプトは、Windows 環境の 2 つの非互換を自動で回避する:
//   (1) 非ASCIIパス問題: @crxjs/vite-plugin のビルドは、プロジェクトパスに非ASCII文字
//       （日本語など）が含まれると Windows でネイティブクラッシュする（0xC0000409）。
//       → その場合だけソースを ASCII の一時ディレクトリへコピーし、node_modules は
//         ジャンクションで共有してビルドし、生成された dist/ を戻す。
//   (2) Node 24+ 問題: Node.js 23/24 系では crxjs ビルドがビルド成功直後にクラッシュする。
//       → ビルドは Node 18〜22 で実行する。実行中の Node が新しすぎる場合は、fnm が
//         インストールした Node（%APPDATA%\fnm\node-versions\...）から 18〜22 系を探して
//         それで vite を起動する。見つからなければ手順を示して失敗する。
//
// パスが ASCII のみ かつ Node が 18〜22 なら、上記の回避は一切行わずその場でビルドする。
import { spawnSync } from 'node:child_process';
import { cpSync, rmSync, mkdirSync, symlinkSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NON_ASCII = /[^\x00-\x7F]/;
const tscBin = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const viteBin = (base) => join(base, 'node_modules', 'vite', 'bin', 'vite.js');

const majorOf = (v) => parseInt(String(v).replace(/^v/, '').split('.')[0], 10);
const OK_NODE = (m) => m >= 18 && m <= 22;

// 18〜22 系の node.exe を返す（現行が該当すればそれ。ダメなら fnm の導入分から探す）。null=見つからず。
function pickNodeExe() {
  if (OK_NODE(majorOf(process.versions.node))) return process.execPath;
  const bases = [
    process.env.APPDATA && join(process.env.APPDATA, 'fnm', 'node-versions'),
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'fnm', 'node-versions'),
    process.env.FNM_DIR && join(process.env.FNM_DIR, 'node-versions'),
  ].filter(Boolean);
  const found = [];
  for (const b of bases) {
    if (!existsSync(b)) continue;
    for (const name of readdirSync(b)) {
      const m = majorOf(name);
      const exe = join(b, name, 'installation', 'node.exe');
      if (OK_NODE(m) && existsSync(exe)) found.push({ m, name, exe });
    }
  }
  found.sort((a, b) => (a.m - b.m) || a.name.localeCompare(b.name));
  return found.length ? found[found.length - 1].exe : null;
}

// 1) 型チェック（tsc は現行 Node / 日本語パスでも問題なし）
const tsc = spawnSync(process.execPath, [tscBin, '--noEmit'], { cwd: root, stdio: 'inherit' });
if ((tsc.status ?? 1) !== 0) process.exit(tsc.status ?? 1);

// 2) ビルド用 Node を確定
const nodeExe = pickNodeExe();
if (!nodeExe) {
  console.error('[build] このビルドには Node 18〜22 が必要です（crxjs が Node 23+ の Windows で非対応）。');
  console.error('[build] 例: `fnm install 22` の後に再実行してください。');
  process.exit(1);
}
if (nodeExe !== process.execPath) {
  console.log(`[build] 現行 Node ${process.versions.node} は非対応のため、${nodeExe} でビルドします。`);
}

// 3) ビルド先の決定（Windows かつ非ASCIIパスのときだけ ASCII 一時ディレクトリを用意）
const needsIsolation = process.platform === 'win32' && NON_ASCII.test(root);
let buildRoot = root;
let work = null;
let nmLink = null;

if (needsIsolation) {
  console.log('[build] 非ASCIIパスを検出 — ASCII 一時ディレクトリでビルドします（crxjs 回避）。');
  let base = os.tmpdir();
  if (NON_ASCII.test(base)) base = (process.env.SystemDrive || 'C:') + '\\';
  if (NON_ASCII.test(base)) {
    console.error('[build] ASCII の一時領域が見つかりません。プロジェクトを ASCII パスへ移して実行してください。');
    process.exit(1);
  }
  work = join(base, `wpb-build-${process.pid}`);
  nmLink = join(work, 'node_modules');
  const EXCLUDE = new Set(['node_modules', 'dist', 'dist_nocrx_test', 'release', '.git', '.github']);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  cpSync(root, work, {
    recursive: true,
    filter: (src) => {
      if (src === root) return true;
      const top = src.slice(root.length + 1).split(/[\\/]/)[0];
      return !EXCLUDE.has(top);
    },
  });
  symlinkSync(join(root, 'node_modules'), nmLink, 'junction'); // 実体を共有（コピーしない）
  buildRoot = work;
}

function cleanup() {
  if (!work) return;
  // 先にジャンクションを外す（実体 node_modules は絶対に消さない）→ 作業ディレクトリ削除
  spawnSync('cmd', ['/c', 'rmdir', nmLink], { stdio: 'ignore' });
  try { rmSync(work, { recursive: true, force: true }); } catch { /* 一時領域なので無視 */ }
}

// 4) ビルド（選定した Node で vite を子プロセス実行）
const r = spawnSync(nodeExe, [viteBin(buildRoot), 'build'], { cwd: buildRoot, stdio: 'inherit' });
let status = r.status ?? 1;
if (status === 0 && needsIsolation) {
  // dist を戻す。Node の fs(cpSync/rmSync) は日本語パス宛てで Windows クラッシュするため、
  // robocopy(日本語パス対応の Windows 標準ツール)でミラーコピーする。
  const robocopy = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'robocopy.exe');
  const rc = spawnSync(robocopy, [join(work, 'dist'), join(root, 'dist'), '/MIR', '/NJH', '/NJS', '/NDL', '/NFL', '/NC', '/NS', '/R:1', '/W:1'], { stdio: 'ignore' });
  const code = rc.status ?? 16;
  if (code >= 8) {
    console.error(`[build] dist のコピーに失敗しました（robocopy code ${code}）。`);
    status = 1;
  } else {
    console.log(`[build] dist を ${join(root, 'dist')} へ更新しました。`);
  }
}
cleanup();
process.exit(status);
