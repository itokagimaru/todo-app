import { useEffect, useState, type FormEvent } from "react";
import type { Category } from "@/lib/types";
import { buildCategoryTree, type CategoryNode } from "@/lib/types";
import type { CategoryInput } from "@/lib/types";
import { XIcon } from "./icons";

interface Props {
  open: boolean;
  initial: Category | null; // null なら新規作成
  parentIdForNew: string | null;
  categories: Category[];
  onClose: () => void;
  onSubmit: (input: CategoryInput) => void;
}

const PRESET_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#6B7280",
];

// 編集時に親候補から自分自身と子孫を除外する
function descendantIds(categories: Category[], id: string): Set<string> {
  const set = new Set<string>([id]);
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const c of categories) {
      if (c.parentId === cur && !set.has(c.id)) {
        set.add(c.id);
        stack.push(c.id);
      }
    }
  }
  return set;
}

function buildOptions(
  categories: Category[],
  excluded: Set<string>
): { id: string; label: string }[] {
  const tree = buildCategoryTree(categories);
  const out: { id: string; label: string }[] = [];
  const walk = (nodes: CategoryNode[], depth: number) => {
    for (const n of nodes) {
      if (!excluded.has(n.id)) {
        out.push({ id: n.id, label: `${"　".repeat(depth)}${n.name}` });
        walk(n.children, depth + 1);
      }
    }
  };
  walk(tree, 0);
  return out;
}

export default function CategoryForm({
  open,
  initial,
  parentIdForNew,
  categories,
  onClose,
  onSubmit,
}: Props) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [color, setColor] = useState(PRESET_COLORS[0]);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      setParentId(initial.parentId);
      setColor(initial.color);
    } else {
      setName("");
      setParentId(parentIdForNew);
      setColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
    }
  }, [open, initial, parentIdForNew]);

  if (!open) return null;

  const excluded = initial
    ? descendantIds(categories, initial.id)
    : new Set<string>();
  const options = buildOptions(categories, excluded);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name, parentId, color });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            {initial ? "カテゴリを編集" : "カテゴリを追加"}
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              名前
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="カテゴリ名"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              親カテゴリ
            </label>
            <select
              value={parentId ?? ""}
              onChange={(e) => setParentId(e.target.value || null)}
              className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800"
            >
              <option value="">（トップレベル）</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              色
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-6 w-6 rounded-full transition-transform ${
                    color === c
                      ? "ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-gray-900"
                      : ""
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`色 ${c}`}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-6 w-8 cursor-pointer rounded border border-gray-300 bg-transparent dark:border-gray-700"
                aria-label="カスタム色"
              />
            </div>
          </div>

          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {initial ? "更新" : "追加"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
