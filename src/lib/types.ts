// Todo アプリのデータ型定義
// todo-data リポジトリの data/*.json と一致させること

export type Priority = "high" | "medium" | "low";
export type Status = "todo" | "in_progress" | "done";

// 繰り返し設定。現状は週次のみ。daysOfWeek は 0(日)〜6(土)。複数選択可。
export interface Recurrence {
  freq: "weekly";
  daysOfWeek: number[];
}

export const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export interface Category {
  id: string;
  name: string;
  parentId: string | null; // トップレベルは null
  color: string; // HEX カラー
  order: number; // 同一階層内の並び順
}

export interface Todo {
  id: string;
  title: string;
  description: string;
  categoryId: string | null; // 未分類は null
  parentId: string | null; // 親Todoの id。最上位は null
  order: number; // 同一親内での並び順（昇順）
  priority: Priority;
  status: Status;
  startDate: string | null; // 開始日 ISO (YYYY-MM-DD)。未満の日は通常一覧で非表示
  dueDate: string | null; // ISO 日付 (YYYY-MM-DD)
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  tags: string[];
  recurrence: Recurrence | null; // 繰り返しなしは null
}

// 階層レンダリング用：Todoを木構造にしたもの
export interface TodoNode extends Todo {
  children: TodoNode[];
}

// カテゴリツリー表示用（子を再帰的に保持）
export interface CategoryNode extends Category {
  children: CategoryNode[];
}

// 作成・更新フォームの入力型（旧 actions.ts から移動）
export interface TodoInput {
  title: string;
  description?: string;
  categoryId?: string | null;
  parentId?: string | null;
  priority?: Priority;
  status?: Status;
  startDate?: string | null;
  dueDate?: string | null;
  tags?: string[];
  recurrence?: Recurrence | null;
}

// 同階層内の比較関数。
// - 親 Todo がある（サブタスク）: 手動 order を尊重し、同値は createdAt
// - 最上位 (parentId === null): 従来の自動ソート（完了は末尾 → 優先度 → 期限 → 作成日）
function compareTodoSiblings(a: Todo, b: Todo): number {
  if (a.parentId !== null) {
    if (a.order !== b.order) return a.order - b.order;
    return a.createdAt.localeCompare(b.createdAt);
  }
  const aDone = a.status === "done" ? 1 : 0;
  const bDone = b.status === "done" ? 1 : 0;
  if (aDone !== bDone) return aDone - bDone;
  const rank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
  if (rank[a.priority] !== rank[b.priority])
    return rank[a.priority] - rank[b.priority];
  if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
  if (a.dueDate) return -1;
  if (b.dueDate) return 1;
  return a.createdAt.localeCompare(b.createdAt);
}

// フラットなTodo配列を親子ツリーに変換する
export function buildTodoTree(todos: Todo[]): TodoNode[] {
  const map = new Map<string, TodoNode>();
  for (const t of todos) map.set(t.id, { ...t, children: [] });

  const roots: TodoNode[] = [];
  for (const t of todos) {
    const node = map.get(t.id)!;
    if (t.parentId && map.has(t.parentId)) {
      map.get(t.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortNodes = (nodes: TodoNode[]) => {
    nodes.sort(compareTodoSiblings);
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);
  return roots;
}

// あるTodoとその全子孫の id を集める（循環防止・削除カスケード用）
export function collectTodoDescendantIds(
  node: TodoNode,
  acc: string[] = []
): string[] {
  acc.push(node.id);
  for (const child of node.children) collectTodoDescendantIds(child, acc);
  return acc;
}

export interface CategoryInput {
  name: string;
  parentId?: string | null;
  color?: string;
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

export const STATUS_LABELS: Record<Status, string> = {
  todo: "未着手",
  in_progress: "進行中",
  done: "完了",
};

// フラットなカテゴリ配列を親子ツリーに変換する
export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const map = new Map<string, CategoryNode>();
  const roots: CategoryNode[] = [];

  for (const cat of categories) {
    map.set(cat.id, { ...cat, children: [] });
  }

  for (const cat of categories) {
    const node = map.get(cat.id)!;
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => a.order - b.order);
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);

  return roots;
}

// あるカテゴリとその全子孫の id を集める（フィルタ用）
export function collectCategoryIds(
  node: CategoryNode,
  acc: string[] = []
): string[] {
  acc.push(node.id);
  for (const child of node.children) {
    collectCategoryIds(child, acc);
  }
  return acc;
}
