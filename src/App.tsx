import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Todo, Category } from "@/lib/types";
import type { AppConfig } from "@/lib/settings";
import { loadConfig, saveConfig } from "@/lib/settings";
import { Store } from "@/lib/store";
import TodoBoard, { type BoardActions } from "@/components/TodoBoard";
import SettingsDialog from "@/components/SettingsDialog";
import { SettingsIcon } from "@/components/icons";

export default function App() {
  const [config, setConfig] = useState<AppConfig>(() => loadConfig());
  const [reloadKey, setReloadKey] = useState(0);
  // 書き込みエラー時は reloadKey を進めて Store を作り直し、sha などの内部状態を
  // 完全に初期化してから再ロードする。古い sha が残って 409 ループに陥るのを防ぐ。
  const store = useMemo(() => new Store(config), [config, reloadKey]);

  const [todos, setTodos] = useState<Todo[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // store（=設定）が変わるたびに読み込み直す
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    store.load().then(
      (res) => {
        if (cancelled) return;
        setTodos(res.todos);
        setCategories(res.categories);
        setLoading(false);
      },
      (e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [store]);

  async function run(
    fn: () => Promise<{ todos?: Todo[]; categories?: Category[] }>
  ) {
    setSyncing(true);
    try {
      const res = await fn();
      if (res.todos) setTodos(res.todos);
      if (res.categories) setCategories(res.categories);
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存に失敗しました");
      // Store ごと作り直して内部の sha キャッシュをリセット。
      // useEffect が新 Store で load() を実行し、新鮮な sha を取り直す。
      setReloadKey((k) => k + 1);
    } finally {
      setSyncing(false);
    }
  }

  const actions: BoardActions = {
    addTodo: (input) => run(async () => ({ todos: await store.addTodo(input) })),
    updateTodo: (id, patch) =>
      run(async () => ({ todos: await store.updateTodo(id, patch) })),
    deleteTodo: (id) =>
      run(async () => ({ todos: await store.deleteTodo(id) })),
    setTodoStatus: (id, status) =>
      run(async () => ({ todos: await store.setTodoStatus(id, status) })),
    addCategory: (input) =>
      run(async () => ({ categories: await store.addCategory(input) })),
    updateCategory: (id, patch) =>
      run(async () => ({ categories: await store.updateCategory(id, patch) })),
    deleteCategory: (id) => run(async () => await store.deleteCategory(id)),
  };

  function handleSaveConfig(cfg: AppConfig) {
    saveConfig(cfg);
    setConfig(cfg); // useMemo が新しい Store を作り直し → 再読込
    setSettingsOpen(false);
  }

  function handleDisconnect() {
    const local: AppConfig = { ...config, pat: "" };
    saveConfig(local);
    setConfig(local);
    setSettingsOpen(false);
  }

  return (
    <>
      {loading ? (
        <Centered>読み込み中…</Centered>
      ) : error ? (
        <ErrorView
          message={error}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : (
        <TodoBoard
          todos={todos}
          categories={categories}
          storageMode={store.mode}
          syncing={syncing}
          actions={actions}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      <SettingsDialog
        open={settingsOpen}
        initial={config}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveConfig}
        onDisconnect={handleDisconnect}
      />
    </>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh items-center justify-center bg-white text-sm text-gray-500 dark:bg-gray-950 dark:text-gray-400">
      {children}
    </div>
  );
}

function ErrorView({
  message,
  onOpenSettings,
}: {
  message: string;
  onOpenSettings: () => void;
}) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-white p-6 text-center dark:bg-gray-950">
      <h1 className="text-lg font-medium text-red-600">
        データの読み込みに失敗しました
      </h1>
      <pre className="max-w-md overflow-x-auto rounded-md bg-gray-100 p-3 text-left text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-200">
        {message}
      </pre>
      <button
        type="button"
        onClick={onOpenSettings}
        className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <SettingsIcon className="h-4 w-4" />
        設定を開く
      </button>
    </div>
  );
}
