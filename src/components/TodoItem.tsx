import type { Todo, Priority } from "@/lib/types";
import { PRIORITY_LABELS } from "@/lib/types";
import { CheckIcon, EditIcon, TrashIcon } from "./icons";

interface Props {
  todo: Todo;
  categoryName: string | null;
  categoryColor: string | null;
  onToggleDone: () => void;
  onCycleStatus: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const priorityStyles: Record<Priority, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  medium:
    "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};

function isOverdue(dueDate: string | null, done: boolean): boolean {
  if (!dueDate || done) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dueDate) < today;
}

export default function TodoItem({
  todo,
  categoryName,
  categoryColor,
  onToggleDone,
  onCycleStatus,
  onEdit,
  onDelete,
}: Props) {
  const done = todo.status === "done";
  const overdue = isOverdue(todo.dueDate, done);

  return (
    <li className="group flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 transition-colors hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
      <button
        type="button"
        onClick={onToggleDone}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
          done
            ? "border-green-500 bg-green-500 text-white"
            : "border-gray-300 text-transparent hover:border-green-500 dark:border-gray-600"
        }`}
        aria-label={done ? "未完了に戻す" : "完了にする"}
      >
        <CheckIcon className="h-3 w-3" />
      </button>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onEdit}
          className="block w-full text-left"
        >
          <span
            className={`text-sm ${
              done
                ? "text-gray-400 line-through"
                : "text-gray-900 dark:text-gray-100"
            }`}
          >
            {todo.title}
          </span>
        </button>

        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {todo.status === "in_progress" && (
            <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
              進行中
            </span>
          )}

          {categoryName && (
            <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-600 dark:text-gray-300">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: categoryColor ?? "#9CA3AF" }}
              />
              {categoryName}
            </span>
          )}

          <span
            className={`rounded px-1.5 py-0.5 text-xs font-medium ${priorityStyles[todo.priority]}`}
          >
            {PRIORITY_LABELS[todo.priority]}
          </span>

          {todo.dueDate && (
            <span
              className={`rounded px-1.5 py-0.5 text-xs ${
                overdue
                  ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {todo.dueDate}
              {overdue && " (期限切れ)"}
            </span>
          )}

          {todo.tags.map((tag) => (
            <span
              key={tag}
              className="rounded px-1.5 py-0.5 text-xs text-gray-500 dark:text-gray-400"
            >
              #{tag}
            </span>
          ))}
        </div>

        {todo.description && (
          <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
            {todo.description}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
        <button
          type="button"
          onClick={onCycleStatus}
          className="rounded px-1.5 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          title="ステータス切替 (未着手→進行中→完了)"
        >
          状態
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          aria-label="編集"
        >
          <EditIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded p-1.5 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/20"
          aria-label="削除"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
