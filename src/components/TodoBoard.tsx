import { useMemo, useState } from "react";
import type {
  Todo,
  Category,
  Status,
  TodoInput,
  CategoryInput,
  CategoryNode,
  TodoNode,
} from "@/lib/types";
import {
  buildCategoryTree,
  buildTodoTree,
  collectCategoryIds,
  STATUS_LABELS,
} from "@/lib/types";
import CategoryTree, { type Selection } from "./CategoryTree";
import TodoItem from "./TodoItem";
import TodoForm from "./TodoForm";
import CategoryForm from "./CategoryForm";
import { PlusIcon, ListIcon, SettingsIcon, RefreshIcon } from "./icons";

export interface BoardActions {
  addTodo: (input: TodoInput) => void;
  updateTodo: (id: string, patch: TodoInput) => void;
  deleteTodo: (id: string) => void;
  setTodoStatus: (id: string, status: Status) => void;
  moveTodo: (id: string, direction: "up" | "down") => void;
  addCategory: (input: CategoryInput) => void;
  updateCategory: (id: string, patch: CategoryInput) => void;
  deleteCategory: (id: string) => void;
}

interface Props {
  todos: Todo[];
  categories: Category[];
  storageMode: "github" | "local";
  syncing: boolean;
  actions: BoardActions;
  onOpenSettings: () => void;
  onRefresh: () => void;
}

// 子孫含めた表示時のメタ情報（インデント・進捗バッジ・↑↓有効判定）
interface FlatRow {
  todo: Todo;
  depth: number;
  doneChildren: number;
  totalChildren: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export default function TodoBoard({
  todos,
  categories,
  storageMode,
  syncing,
  actions,
  onOpenSettings,
  onRefresh,
}: Props) {
  const [selection, setSelection] = useState<Selection>({ kind: "all" });
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  // 表示範囲: "active"=開始日が今日以前のものだけ / "upcoming"=未開始のみ / "all"=全部
  const [scope, setScope] = useState<"active" | "upcoming" | "all">("active");
  const [search, setSearch] = useState("");
  const [mobileSidebar, setMobileSidebar] = useState(false);

  const [todoFormOpen, setTodoFormOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [todoFormCategory, setTodoFormCategory] = useState<string | null>(null);

  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryFormParent, setCategoryFormParent] = useState<string | null>(
    null
  );

  const tree = useMemo(() => buildCategoryTree(categories), [categories]);

  const categoryMap = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  // サイドバー件数は scope に合わせて変える（active=開始済のみ等）。各Todoは所属カテゴリと全祖先にカウントする
  const scopedTodos = useMemo(() => {
    const todayISO = new Date().toLocaleDateString("sv-SE");
    return todos.filter((t) => {
      if (t.status === "done") return false;
      const notYetStarted = t.startDate ? t.startDate > todayISO : false;
      if (scope === "active" && notYetStarted) return false;
      if (scope === "upcoming" && !notYetStarted) return false;
      return true;
    });
  }, [todos, scope]);

  const counts = useMemo(() => {
    const parentOf = new Map<string, string | null>();
    for (const c of categories) parentOf.set(c.id, c.parentId);
    const map = new Map<string, number>();
    for (const t of scopedTodos) {
      if (!t.categoryId) continue;
      let cur: string | null = t.categoryId;
      const seen = new Set<string>();
      while (cur && !seen.has(cur)) {
        seen.add(cur);
        map.set(cur, (map.get(cur) ?? 0) + 1);
        cur = parentOf.get(cur) ?? null;
      }
    }
    return map;
  }, [scopedTodos, categories]);

  const allCount = scopedTodos.length;
  const uncategorizedCount = useMemo(
    () => scopedTodos.filter((t) => !t.categoryId).length,
    [scopedTodos]
  );

  const selectedCategoryIds = useMemo(() => {
    if (selection.kind !== "category") return null;
    const node = findNode(tree, selection.id);
    if (!node) return new Set<string>([selection.id]);
    return new Set(collectCategoryIds(node));
  }, [selection, tree]);

  // 表示用フラット行（親子ツリーを深さ優先で展開）。
  // フィルタにマッチした Todo に加え、ナビゲーション維持のため祖先も自動で含める。
  const visibleRows = useMemo<FlatRow[]>(() => {
    const q = search.trim().toLowerCase();
    const todayISO = new Date().toLocaleDateString("sv-SE");
    const matchFn = (t: Todo) => {
      const notYetStarted = t.startDate ? t.startDate > todayISO : false;
      if (scope === "active" && notYetStarted) return false;
      if (scope === "upcoming" && !notYetStarted) return false;
      if (selection.kind === "uncategorized" && t.categoryId) return false;
      if (
        selection.kind === "category" &&
        (!t.categoryId || !selectedCategoryIds?.has(t.categoryId))
      )
        return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (q) {
        const hay =
          `${t.title} ${t.description} ${t.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    };

    const byId = new Map(todos.map((t) => [t.id, t]));
    const visibleIds = new Set<string>();
    for (const t of todos) {
      if (matchFn(t)) {
        visibleIds.add(t.id);
        let cur = t.parentId;
        while (cur && !visibleIds.has(cur)) {
          visibleIds.add(cur);
          cur = byId.get(cur)?.parentId ?? null;
        }
      }
    }

    // 子集計は全データに対して計算する（フィルタで隠れた子も進捗に含める）
    const childInfo = new Map<string, { total: number; done: number }>();
    for (const t of todos) {
      if (!t.parentId) continue;
      const info = childInfo.get(t.parentId) ?? { total: 0, done: 0 };
      info.total++;
      if (t.status === "done") info.done++;
      childInfo.set(t.parentId, info);
    }

    const tree = buildTodoTree(todos.filter((t) => visibleIds.has(t.id)));
    const rows: FlatRow[] = [];
    const walk = (nodes: TodoNode[], depth: number) => {
      nodes.forEach((node, i) => {
        const info = childInfo.get(node.id) ?? { total: 0, done: 0 };
        // ↑↓ はサブタスク（親持ち）でのみ有効。ルート Todo は自動ソート
        const reorderable = node.parentId !== null;
        rows.push({
          todo: node,
          depth,
          doneChildren: info.done,
          totalChildren: info.total,
          canMoveUp: reorderable && i > 0,
          canMoveDown: reorderable && i < nodes.length - 1,
        });
        walk(node.children, depth + 1);
      });
    };
    walk(tree, 0);
    return rows;
  }, [todos, selection, selectedCategoryIds, statusFilter, scope, search]);

  // --- Todo handlers ---
  function openAddTodo() {
    setEditingTodo(null);
    setTodoFormCategory(selection.kind === "category" ? selection.id : null);
    setTodoFormOpen(true);
  }
  function openEditTodo(t: Todo) {
    setEditingTodo(t);
    setTodoFormOpen(true);
  }
  function submitTodo(input: TodoInput) {
    const editing = editingTodo;
    setTodoFormOpen(false);
    if (editing) actions.updateTodo(editing.id, input);
    else actions.addTodo(input);
  }
  function toggleDone(t: Todo) {
    actions.setTodoStatus(t.id, t.status === "done" ? "todo" : "done");
  }
  function cycleStatus(t: Todo) {
    const next: Status =
      t.status === "todo"
        ? "in_progress"
        : t.status === "in_progress"
          ? "done"
          : "todo";
    actions.setTodoStatus(t.id, next);
  }
  function removeTodo(t: Todo) {
    if (!confirm(`「${t.title}」を削除しますか？`)) return;
    actions.deleteTodo(t.id);
  }

  // --- Category handlers ---
  function openAddCategory(parentId: string | null) {
    setEditingCategory(null);
    setCategoryFormParent(parentId);
    setCategoryFormOpen(true);
  }
  function openEditCategory(node: CategoryNode) {
    setEditingCategory(node);
    setCategoryFormOpen(true);
  }
  function submitCategory(input: CategoryInput) {
    const editing = editingCategory;
    setCategoryFormOpen(false);
    if (editing) actions.updateCategory(editing.id, input);
    else actions.addCategory(input);
  }
  function removeCategory(node: CategoryNode) {
    if (
      !confirm(
        `「${node.name}」を削除しますか？\n子カテゴリは親へ繰り上げられ、所属タスクは未分類になります。`
      )
    )
      return;
    if (selection.kind === "category" && selection.id === node.id) {
      setSelection({ kind: "all" });
    }
    actions.deleteCategory(node.id);
  }

  const sidebar = (
    <CategoryTree
      nodes={tree}
      selection={selection}
      counts={counts}
      allCount={allCount}
      uncategorizedCount={uncategorizedCount}
      onSelect={(sel) => {
        setSelection(sel);
        setMobileSidebar(false);
      }}
      onAddChild={openAddCategory}
      onEdit={openEditCategory}
      onDelete={removeCategory}
    />
  );

  const headerTitle =
    selection.kind === "all"
      ? "すべてのタスク"
      : selection.kind === "uncategorized"
        ? "未分類"
        : (categoryMap.get(selection.id)?.name ?? "カテゴリ");

  return (
    <div className="flex h-dvh flex-col bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <header className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <button
          type="button"
          onClick={() => setMobileSidebar((v) => !v)}
          className="rounded-md p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 sm:hidden"
          aria-label="カテゴリを開く"
        >
          <ListIcon className="h-5 w-5" />
        </button>
        <h1 className="text-base font-medium">{headerTitle}</h1>
        {syncing && <span className="text-xs text-gray-400">同期中…</span>}

        <button
          type="button"
          onClick={onOpenSettings}
          className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
          style={{
            backgroundColor: storageMode === "github" ? "#dcfce7" : "#fef3c7",
            color: storageMode === "github" ? "#166534" : "#92400e",
          }}
          title={
            storageMode === "github"
              ? "GitHubに同期中。設定を開く"
              : "ローカル保存中（この端末のみ）。タップで同期設定"
          }
        >
          {storageMode === "github" ? "GitHub同期" : "ローカルのみ"}
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={syncing}
          className="rounded-md p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800"
          aria-label="更新"
          title="サーバから最新のタスクを再取得"
        >
          <RefreshIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="rounded-md p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          aria-label="設定"
        >
          <SettingsIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={openAddTodo}
          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <PlusIcon className="h-4 w-4" />
          <span className="hidden sm:inline">タスク追加</span>
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-gray-200 p-3 dark:border-gray-800 sm:block">
          {sidebar}
        </aside>

        {mobileSidebar && (
          <div
            className="fixed inset-0 z-40 bg-black/40 sm:hidden"
            onClick={() => setMobileSidebar(false)}
          >
            <aside
              className="h-full w-72 max-w-[80%] overflow-y-auto bg-white p-3 dark:bg-gray-900"
              onClick={(e) => e.stopPropagation()}
            >
              {sidebar}
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-2xl">
            {storageMode === "local" && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="mb-3 block w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-left text-xs text-amber-800 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
              >
                この端末だけに保存中です。スマホとPCで同期するには、ここをタップして GitHub 連携を設定してください。
              </button>
            )}

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="検索…"
                className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800"
              />
              <select
                value={scope}
                onChange={(e) =>
                  setScope(e.target.value as "active" | "upcoming" | "all")
                }
                className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800"
                title="開始日に応じた表示範囲"
              >
                <option value="active">現在のタスク</option>
                <option value="upcoming">未開始のタスク</option>
                <option value="all">すべて</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as "all" | Status)
                }
                className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800"
              >
                <option value="all">すべての状態</option>
                {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>

            {visibleRows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 py-16 text-center text-sm text-gray-400 dark:border-gray-700">
                タスクがありません。「タスク追加」から作成しましょう。
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {visibleRows.map((row) => (
                  <TodoItem
                    key={row.todo.id}
                    todo={row.todo}
                    depth={row.depth}
                    doneChildren={row.doneChildren}
                    totalChildren={row.totalChildren}
                    canMoveUp={row.canMoveUp}
                    canMoveDown={row.canMoveDown}
                    categoryName={
                      row.todo.categoryId
                        ? (categoryMap.get(row.todo.categoryId)?.name ?? null)
                        : null
                    }
                    categoryColor={
                      row.todo.categoryId
                        ? (categoryMap.get(row.todo.categoryId)?.color ?? null)
                        : null
                    }
                    onToggleDone={() => toggleDone(row.todo)}
                    onCycleStatus={() => cycleStatus(row.todo)}
                    onEdit={() => openEditTodo(row.todo)}
                    onDelete={() => removeTodo(row.todo)}
                    onMoveUp={() => actions.moveTodo(row.todo.id, "up")}
                    onMoveDown={() => actions.moveTodo(row.todo.id, "down")}
                  />
                ))}
              </ul>
            )}
          </div>
        </main>
      </div>

      <button
        type="button"
        onClick={openAddTodo}
        className="fixed bottom-6 right-6 z-30 flex h-24 w-24 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 active:scale-95 transition-transform sm:h-20 sm:w-20"
        aria-label="タスクを追加"
      >
        <PlusIcon className="h-12 w-12 sm:h-10 sm:w-10" />
      </button>

      <TodoForm
        open={todoFormOpen}
        initial={editingTodo}
        categories={categories}
        todos={todos}
        defaultCategoryId={todoFormCategory}
        onClose={() => setTodoFormOpen(false)}
        onSubmit={submitTodo}
      />
      <CategoryForm
        open={categoryFormOpen}
        initial={editingCategory}
        parentIdForNew={categoryFormParent}
        categories={categories}
        onClose={() => setCategoryFormOpen(false)}
        onSubmit={submitCategory}
      />
    </div>
  );
}

function findNode(nodes: CategoryNode[], id: string): CategoryNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}
