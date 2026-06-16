import { useEffect, useState } from "react";
import type { AppConfig } from "@/lib/settings";
import { testConnection } from "@/lib/githubApi";
import { XIcon } from "./icons";

interface Props {
  open: boolean;
  initial: AppConfig;
  onClose: () => void;
  onSave: (cfg: AppConfig) => void;
  onDisconnect: () => void;
}

type TestState =
  | { kind: "idle" }
  | { kind: "testing" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

export default function SettingsDialog({
  open,
  initial,
  onClose,
  onSave,
  onDisconnect,
}: Props) {
  const [pat, setPat] = useState("");
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [test, setTest] = useState<TestState>({ kind: "idle" });

  useEffect(() => {
    if (!open) return;
    setPat(initial.pat);
    setOwner(initial.owner);
    setRepo(initial.repo);
    setBranch(initial.branch || "main");
    setTest({ kind: "idle" });
  }, [open, initial]);

  if (!open) return null;

  const current = (): AppConfig => ({
    pat: pat.trim(),
    owner: owner.trim(),
    repo: repo.trim(),
    branch: branch.trim() || "main",
  });

  const canSync = Boolean(pat.trim() && owner.trim() && repo.trim());

  async function handleTest() {
    setTest({ kind: "testing" });
    try {
      await testConnection(current());
      setTest({ kind: "ok" });
    } catch (e) {
      setTest({
        kind: "error",
        message: e instanceof Error ? e.message : "接続に失敗しました",
      });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            GitHub同期の設定
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
            aria-label="閉じる"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          データ用リポジトリ（例: <code>rooki-todos</code>）に接続すると、スマホ・PCで同期できます。
          トークンはこの端末のブラウザにのみ保存されます。
          <a
            href="https://github.com/settings/personal-access-tokens/new"
            target="_blank"
            rel="noreferrer"
            className="ml-1 text-blue-600 underline dark:text-blue-400"
          >
            Fine-grained PAT を作成
          </a>
          （対象リポジトリを限定し、Contents の Read and write を付与）。
        </p>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                オーナー（ユーザー名）
              </label>
              <input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="rooki"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                リポジトリ名
              </label>
              <input
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="rooki-todos"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              ブランチ
            </label>
            <input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              Personal Access Token
            </label>
            <input
              type="password"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              placeholder="github_pat_…"
              autoComplete="off"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800"
            />
          </div>

          {test.kind === "ok" && (
            <p className="text-xs text-green-600 dark:text-green-400">
              接続成功。保存すると同期を開始します。
            </p>
          )}
          {test.kind === "error" && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {test.message}
            </p>
          )}

          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={onDisconnect}
              className="text-xs text-gray-500 underline hover:text-gray-700 dark:text-gray-400"
            >
              連携を解除（ローカルのみ）
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleTest}
                disabled={!canSync || test.kind === "testing"}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                {test.kind === "testing" ? "確認中…" : "接続テスト"}
              </button>
              <button
                type="button"
                onClick={() => onSave(current())}
                disabled={!canSync}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
