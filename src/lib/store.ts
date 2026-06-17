import type {
  Todo,
  Category,
  Status,
  TodoInput,
  CategoryInput,
} from "./types";
import type { AppConfig, StorageMode } from "./settings";
import { modeOf } from "./settings";
import * as gh from "./githubApi";

// Todo/カテゴリの読み書きを担うストア。
// github モード: GitHub Contents API（data/*.json）
// local モード:  localStorage（PAT未設定時のフォールバック）
// 書き込みは楽観更新 + 409(sha不一致)時の再取得・再適用リトライで端末間競合に対応。

const TODOS_PATH = "data/todos.json";
const CATEGORIES_PATH = "data/categories.json";
const LS_TODOS = "todo-app:todos";
const LS_CATEGORIES = "todo-app:categories";

const DEFAULT_CATEGORIES: Category[] = [
  { id: "cat-work", name: "仕事", parentId: null, color: "#3B82F6", order: 0 },
  {
    id: "cat-private",
    name: "プライベート",
    parentId: null,
    color: "#10B981",
    order: 1,
  },
];

export interface LoadResult {
  todos: Todo[];
  categories: Category[];
}

function now(): string {
  return new Date().toISOString();
}
function newId(): string {
  return crypto.randomUUID();
}

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeLS<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// 指定カテゴリの全子孫ID（循環防止用）
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

export class Store {
  readonly mode: StorageMode;
  private cfg: AppConfig;
  private todos: Todo[] = [];
  private categories: Category[] = [];
  private todosSha: string | null = null;
  private catsSha: string | null = null;

  constructor(cfg: AppConfig) {
    this.cfg = cfg;
    this.mode = modeOf(cfg);
  }

  async load(): Promise<LoadResult> {
    if (this.mode === "github") {
      const [t, c] = await Promise.all([
        gh.getFile<Todo[]>(this.cfg, TODOS_PATH),
        gh.getFile<Category[]>(this.cfg, CATEGORIES_PATH),
      ]);
      this.todos = t.data;
      this.todosSha = t.sha;
      this.categories = c.data;
      this.catsSha = c.sha;
    } else {
      this.todos = readLS<Todo[]>(LS_TODOS, []);
      this.categories = readLS<Category[]>(LS_CATEGORIES, DEFAULT_CATEGORIES);
      if (!localStorage.getItem(LS_CATEGORIES)) {
        writeLS(LS_CATEGORIES, this.categories); // 初回シード
      }
    }
    return { todos: this.todos, categories: this.categories };
  }

  // --- 汎用の永続化（楽観更新 + 409リトライ） ---

  private async putWithRetry<T>(
    path: string,
    transform: (data: T[]) => T[],
    initial: T[],
    initialSha: string | null,
    message: string,
    fallback: T[]
  ): Promise<{ data: T[]; sha: string }> {
    // 1回目: メモリ上のSHAで楽観的にPUT
    let data = transform(initial);
    let sha: string | null = initialSha;
    let lastError: unknown = null;

    // 最大4回（初回 + リトライ3回）。eventual consistency 吸収のため指数バックオフ
    const MAX_ATTEMPTS = 4;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const newSha = await gh.putFile(this.cfg, path, data, sha, message);
        return { data, sha: newSha };
      } catch (e) {
        lastError = e;
        if (!(e instanceof gh.GitHubError) || e.status !== 409) throw e;
        if (attempt === MAX_ATTEMPTS - 1) break;

        // バックオフ: 200ms, 500ms, 1200ms
        const delay = [200, 500, 1200][attempt] ?? 1200;
        await new Promise((r) => setTimeout(r, delay));

        // 最新を再GETして transform を再適用
        try {
          const fresh = await gh.getFile<T[]>(this.cfg, path);
          data = transform(fresh.data);
          sha = fresh.sha;
        } catch (getErr) {
          lastError = getErr;
          // 再GETが失敗したらそのまま次回試行（ネットワーク一時失敗のケース）
        }
      }
    }
    // 全て失敗した場合は、呼び出し側のメモリ状態を巻き戻すために fallback を残す
    this.todos = fallback as unknown as Todo[];
    throw lastError instanceof Error
      ? lastError
      : new Error("更新に失敗しました");
  }

  private async mutateTodos(
    transform: (todos: Todo[]) => Todo[],
    message: string
  ): Promise<Todo[]> {
    const prev = this.todos;
    const next = transform(prev);
    this.todos = next;
    if (this.mode === "local") {
      writeLS(LS_TODOS, next);
      return next;
    }
    try {
      const res = await this.putWithRetry<Todo>(
        TODOS_PATH,
        transform,
        prev,
        this.todosSha,
        message,
        prev
      );
      this.todos = res.data;
      this.todosSha = res.sha;
      return res.data;
    } catch (e) {
      this.todos = prev; // 失敗時はメモリ上のstateを巻き戻す
      throw e;
    }
  }

  private async mutateCategories(
    transform: (categories: Category[]) => Category[],
    message: string
  ): Promise<Category[]> {
    const prev = this.categories;
    const next = transform(prev);
    this.categories = next;
    if (this.mode === "local") {
      writeLS(LS_CATEGORIES, next);
      return next;
    }

    let data = next;
    let sha: string | null = this.catsSha;
    let lastError: unknown = null;
    const MAX_ATTEMPTS = 4;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const newSha = await gh.putFile(
          this.cfg,
          CATEGORIES_PATH,
          data,
          sha,
          message
        );
        this.categories = data;
        this.catsSha = newSha;
        return data;
      } catch (e) {
        lastError = e;
        if (!(e instanceof gh.GitHubError) || e.status !== 409) {
          this.categories = prev;
          throw e;
        }
        if (attempt === MAX_ATTEMPTS - 1) break;

        const delay = [200, 500, 1200][attempt] ?? 1200;
        await new Promise((r) => setTimeout(r, delay));

        try {
          const fresh = await gh.getFile<Category[]>(
            this.cfg,
            CATEGORIES_PATH
          );
          data = transform(fresh.data);
          sha = fresh.sha;
        } catch (getErr) {
          lastError = getErr;
        }
      }
    }
    this.categories = prev;
    throw lastError instanceof Error
      ? lastError
      : new Error("更新に失敗しました");
  }

  // --- Todo 操作 ---

  addTodo(input: TodoInput): Promise<Todo[]> {
    const title = input.title.trim();
    const todo: Todo = {
      id: newId(),
      title,
      description: input.description?.trim() ?? "",
      categoryId: input.categoryId ?? null,
      priority: input.priority ?? "medium",
      status: input.status ?? "todo",
      dueDate: input.dueDate || null,
      createdAt: now(),
      updatedAt: now(),
      tags: input.tags ?? [],
    };
    return this.mutateTodos((todos) => [...todos, todo], `Add todo: ${title}`);
  }

  updateTodo(id: string, patch: Partial<TodoInput>): Promise<Todo[]> {
    const ts = now();
    return this.mutateTodos(
      (todos) =>
        todos.map((t) =>
          t.id === id
            ? {
                ...t,
                title: patch.title?.trim() ?? t.title,
                description: patch.description?.trim() ?? t.description,
                categoryId:
                  patch.categoryId !== undefined
                    ? patch.categoryId
                    : t.categoryId,
                priority: patch.priority ?? t.priority,
                status: patch.status ?? t.status,
                dueDate:
                  patch.dueDate !== undefined
                    ? patch.dueDate || null
                    : t.dueDate,
                tags: patch.tags ?? t.tags,
                updatedAt: ts,
              }
            : t
        ),
      `Update todo`
    );
  }

  setTodoStatus(id: string, status: Status): Promise<Todo[]> {
    const ts = now();
    return this.mutateTodos(
      (todos) =>
        todos.map((t) => (t.id === id ? { ...t, status, updatedAt: ts } : t)),
      `Set todo status: ${status}`
    );
  }

  deleteTodo(id: string): Promise<Todo[]> {
    return this.mutateTodos(
      (todos) => todos.filter((t) => t.id !== id),
      `Delete todo`
    );
  }

  // --- カテゴリ操作 ---

  addCategory(input: CategoryInput): Promise<Category[]> {
    const name = input.name.trim();
    const parentId = input.parentId ?? null;
    const color = input.color ?? "#6B7280";
    return this.mutateCategories((cats) => {
      const siblings = cats.filter((c) => c.parentId === parentId);
      const maxOrder = siblings.reduce((m, c) => Math.max(m, c.order), -1);
      const cat: Category = {
        id: newId(),
        name,
        parentId,
        color,
        order: maxOrder + 1,
      };
      return [...cats, cat];
    }, `Add category: ${name}`);
  }

  updateCategory(id: string, patch: Partial<CategoryInput>): Promise<Category[]> {
    return this.mutateCategories((cats) => {
      if (patch.parentId) {
        const desc = descendantIds(cats, id);
        if (patch.parentId === id || desc.has(patch.parentId)) {
          throw new Error("自分自身または子孫を親に指定できません");
        }
      }
      return cats.map((c) =>
        c.id === id
          ? {
              ...c,
              name: patch.name?.trim() ?? c.name,
              parentId:
                patch.parentId !== undefined ? patch.parentId : c.parentId,
              color: patch.color ?? c.color,
            }
          : c
      );
    }, `Update category`);
  }

  // 削除: 子カテゴリは親へ繰り上げ、所属Todoは未分類へ
  async deleteCategory(id: string): Promise<LoadResult> {
    const target = this.categories.find((c) => c.id === id);
    const parentId = target?.parentId ?? null;
    const categories = await this.mutateCategories(
      (cats) =>
        cats
          .filter((c) => c.id !== id)
          .map((c) => (c.parentId === id ? { ...c, parentId } : c)),
      `Delete category`
    );
    const ts = now();
    const todos = await this.mutateTodos(
      (tds) =>
        tds.map((t) =>
          t.categoryId === id ? { ...t, categoryId: null, updatedAt: ts } : t
        ),
      `Unassign todos from deleted category`
    );
    return { todos, categories };
  }
}
