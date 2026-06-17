import { useEffect, useState, type FormEvent } from "react";
import type { Todo, Category, Priority, Status } from "@/lib/types";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  DAY_LABELS,
  buildCategoryTree,
  type CategoryNode,
} from "@/lib/types";
import type { TodoInput } from "@/lib/types";
import { XIcon } from "./icons";

interface Props {
  open: boolean;
  initial: Todo | null; // null なら新規作成
  categories: Category[];
  defaultCategoryId: string | null;
  onClose: () => void;
  onSubmit: (input: TodoInput & { status?: Status }) => void;
}

// フラットなカテゴリを階層インデント付きの選択肢に変換
function buildOptions(categories: Category[]): { id: string; label: string }[] {
  const tree = buildCategoryTree(categories);
  const out: { id: string; label: string }[] = [];
  const walk = (nodes: CategoryNode[], depth: number) => {
    for (const n of nodes) {
      out.push({ id: n.id, label: `${"　".repeat(depth)}${n.name}` });
      walk(n.children, depth + 1);
    }
  };
  walk(tree, 0);
  return out;
}

export default function TodoForm({
  open,
  initial,
  categories,
  defaultCategoryId,
  onClose,
  onSubmit,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority>("medium");
  const [status, setStatus] = useState<Status>("todo");
  const [dueDate, setDueDate] = useState("");
  const [tags, setTags] = useState("");
  const [recurEnabled, setRecurEnabled] = useState(false);
  const [recurDays, setRecurDays] = useState<number[]>([]);

  // モーダルを開くたびに初期値を流し込む
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title);
      setDescription(initial.description);
      setCategoryId(initial.categoryId);
      setPriority(initial.priority);
      setStatus(initial.status);
      setDueDate(initial.dueDate ?? "");
      setTags(initial.tags.join(", "));
      setRecurEnabled(!!initial.recurrence);
      setRecurDays(initial.recurrence?.daysOfWeek ?? []);
    } else {
      setTitle("");
      setDescription("");
      setCategoryId(defaultCategoryId);
      setPriority("medium");
      setStatus("todo");
      setDueDate("");
      setTags("");
      setRecurEnabled(false);
      setRecurDays([]);
    }
  }, [open, initial, defaultCategoryId]);

  // 期日が変わったら、繰り返しON時にその曜日を自動追加する。
  // フックは早期return より上に置かないと Rules of Hooks 違反になるので注意。
  useEffect(() => {
    if (!open) return;
    if (!recurEnabled) return;
    if (!dueDate) return;
    const day = new Date(dueDate + "T00:00").getDay();
    setRecurDays((prev) => (prev.includes(day) ? prev : [...prev, day].sort()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recurEnabled]);

  if (!open) return null;

  const options = buildOptions(categories);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (recurEnabled && recurDays.length === 0) {
      alert("繰り返しを有効にする場合は少なくとも1つの曜日を選んでください");
      return;
    }
    onSubmit({
      title,
      description,
      categoryId,
      priority,
      status,
      dueDate: dueDate || null,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      recurrence: recurEnabled
        ? { freq: "weekly", daysOfWeek: recurDays }
        : null,
    });
  }

  function toggleDay(d: number) {
    setRecurDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()
    );
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
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            {initial ? "タスクを編集" : "タスクを追加"}
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
              タイトル
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="やること"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              メモ
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                カテゴリ
              </label>
              <select
                value={categoryId ?? ""}
                onChange={(e) => setCategoryId(e.target.value || null)}
                className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800"
              >
                <option value="">未分類</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                優先度
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800"
              >
                {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                期限
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800"
              />
            </div>

            {initial && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  ステータス
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Status)}
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800"
                >
                  {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                繰り返し
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={recurEnabled}
                  onChange={(e) => setRecurEnabled(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                毎週
              </label>
            </div>
            {recurEnabled && (
              <div className="flex flex-wrap gap-1">
                {DAY_LABELS.map((label, idx) => {
                  const active = recurDays.includes(idx);
                  return (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => toggleDay(idx)}
                      className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                        active
                          ? "bg-blue-600 text-white"
                          : "border border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                      }`}
                      aria-pressed={active}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              タグ（カンマ区切り）
            </label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="例: 買い物, 緊急"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800"
            />
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
              disabled={!title.trim()}
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
