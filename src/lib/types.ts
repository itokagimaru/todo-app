// Todo アプリのデータ型定義
// todo-data リポジトリの data/*.json と一致させること

export type Priority = "high" | "medium" | "low";
export type Status = "todo" | "in_progress" | "done";

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
  priority: Priority;
  status: Status;
  dueDate: string | null; // ISO 日付 (YYYY-MM-DD)
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  tags: string[];
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
  priority?: Priority;
  status?: Status;
  dueDate?: string | null;
  tags?: string[];
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
