import { useState } from "react";
import type { CategoryNode } from "@/lib/types";
import { ChevronIcon, PlusIcon, EditIcon, TrashIcon } from "./icons";

type Selection =
  | { kind: "all" }
  | { kind: "uncategorized" }
  | { kind: "category"; id: string };

interface Props {
  nodes: CategoryNode[];
  selection: Selection;
  counts: Map<string, number>; // categoryId -> 子孫含む件数
  allCount: number;
  uncategorizedCount: number;
  onSelect: (sel: Selection) => void;
  onAddChild: (parentId: string | null) => void;
  onEdit: (node: CategoryNode) => void;
  onDelete: (node: CategoryNode) => void;
}

export default function CategoryTree({
  nodes,
  selection,
  counts,
  allCount,
  uncategorizedCount,
  onSelect,
  onAddChild,
  onEdit,
  onDelete,
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderNode(node: CategoryNode, depth: number) {
    const hasChildren = node.children.length > 0;
    const isOpen = !collapsed.has(node.id);
    const isSelected =
      selection.kind === "category" && selection.id === node.id;
    const count = counts.get(node.id) ?? 0;

    return (
      <div key={node.id}>
        <div
          className={`group flex items-center gap-1 rounded-md pr-1.5 text-sm transition-colors ${
            isSelected
              ? "bg-blue-100 text-blue-900 dark:bg-blue-500/20 dark:text-blue-100"
              : "hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
          style={{ paddingLeft: `${depth * 14 + 4}px` }}
        >
          <button
            type="button"
            onClick={() => hasChildren && toggle(node.id)}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${
              hasChildren ? "hover:bg-black/10 dark:hover:bg-white/10" : "invisible"
            }`}
            aria-label={isOpen ? "折りたたむ" : "展開する"}
          >
            <ChevronIcon
              className={`h-3.5 w-3.5 transition-transform ${
                isOpen ? "rotate-90" : ""
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => onSelect({ kind: "category", id: node.id })}
            className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: node.color }}
            />
            <span className="truncate">{node.name}</span>
            <span className="ml-auto shrink-0 text-xs tabular-nums text-gray-400">
              {count}
            </span>
          </button>

          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => onAddChild(node.id)}
              className="rounded p-1 text-gray-500 hover:bg-black/10 hover:text-gray-800 dark:hover:bg-white/10 dark:hover:text-gray-200"
              aria-label="子カテゴリを追加"
              title="子カテゴリを追加"
            >
              <PlusIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onEdit(node)}
              className="rounded p-1 text-gray-500 hover:bg-black/10 hover:text-gray-800 dark:hover:bg-white/10 dark:hover:text-gray-200"
              aria-label="カテゴリを編集"
              title="編集"
            >
              <EditIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(node)}
              className="rounded p-1 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/20"
              aria-label="カテゴリを削除"
              title="削除"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {hasChildren && isOpen && (
          <div>{node.children.map((c) => renderNode(c, depth + 1))}</div>
        )}
      </div>
    );
  }

  return (
    <nav className="flex flex-col gap-0.5">
      <PseudoItem
        label="すべて"
        count={allCount}
        active={selection.kind === "all"}
        onClick={() => onSelect({ kind: "all" })}
      />
      <PseudoItem
        label="未分類"
        count={uncategorizedCount}
        active={selection.kind === "uncategorized"}
        onClick={() => onSelect({ kind: "uncategorized" })}
      />

      <div className="my-1.5 flex items-center justify-between px-1">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
          カテゴリ
        </span>
        <button
          type="button"
          onClick={() => onAddChild(null)}
          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          aria-label="カテゴリを追加"
          title="トップレベルにカテゴリを追加"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>

      {nodes.length === 0 ? (
        <p className="px-2 py-1 text-xs text-gray-400">カテゴリがありません</p>
      ) : (
        nodes.map((n) => renderNode(n, 0))
      )}
    </nav>
  );
}

function PseudoItem({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
        active
          ? "bg-blue-100 text-blue-900 dark:bg-blue-500/20 dark:text-blue-100"
          : "hover:bg-gray-100 dark:hover:bg-gray-800"
      }`}
    >
      <span>{label}</span>
      <span className="ml-auto text-xs tabular-nums text-gray-400">{count}</span>
    </button>
  );
}

export type { Selection };
