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
//
// 公開メソッドは「即座に楽観更新後の state」と「裏で走る同期 Promise」を同時に返す。
// 呼び出し側（App.tsx）は state を即UIに反映し、Promise の失敗時のみ alert + 再ロード。

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

export interface TodoMutation {
  todos: Todo[];
  sync: Promise<void>;
}
export interface CategoryMutation {
  categories: Category[];
  sync: Promise<void>;
}
export interface MixedMutation {
  todos: Todo[];
  categories: Category[];
  sync: Promise<void>;
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

const RETRY_BACKOFF = [200, 500, 1200];
const MAX_ATTEMPTS = 4;

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

  // --- 共通: 楽観更新 + 同期Promise（GitHubモードは409再試行付き） ---

  private commitTodos(
    transform: (todos: Todo[]) => Todo[],
    message: string
  ): TodoMutation {
    const prev = this.todos;
    const next = transform(prev);
    this.todos = next;

    if (this.mode === "local") {
      writeLS(LS_TODOS, next);
      return { todos: next, sync: Promise.resolve() };
    }

    const initialSha = this.todosSha;
    const cfg = this.cfg;
    const sync = (async () => {
      let data = next;
      let sha: string | null = initialSha;
      let lastError: unknown = null;

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
          const newSha = await gh.putFile(cfg, TODOS_PATH, data, sha, message);
          this.todos = data;
          this.todosSha = newSha;
          return;
        } catch (e) {
          lastError = e;
          if (!(e instanceof gh.GitHubError) || e.status !== 409) {
            this.todos = prev;
            throw e;
          }
          if (attempt === MAX_ATTEMPTS - 1) break;
          await new Promise((r) =>
            setTimeout(r, RETRY_BACKOFF[attempt] ?? 1200)
          );
          try {
            const fresh = await gh.getFile<Todo[]>(cfg, TODOS_PATH);
            data = transform(fresh.data);
            sha = fresh.sha;
          } catch (getErr) {
            lastError = getErr;
          }
        }
      }
      this.todos = prev;
      throw lastError instanceof Error
        ? lastError
        : new Error("更新に失敗しました");
    })();

    return { todos: next, sync };
  }

  private commitCategories(
    transform: (cats: Category[]) => Category[],
    message: string
  ): CategoryMutation {
    const prev = this.categories;
    const next = transform(prev);
    this.categories = next;

    if (this.mode === "local") {
      writeLS(LS_CATEGORIES, next);
      return { categories: next, sync: Promise.resolve() };
    }

    const initialSha = this.catsSha;
    const cfg = this.cfg;
    const sync = (async () => {
      let data = next;
      let sha: string | null = initialSha;
      let lastError: unknown = null;

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
          const newSha = await gh.putFile(
            cfg,
            CATEGORIES_PATH,
            data,
            sha,
            message
          );
          this.categories = data;
          this.catsSha = newSha;
          return;
        } catch (e) {
          lastError = e;
          if (!(e instanceof gh.GitHubError) || e.status !== 409) {
            this.categories = prev;
            throw e;
          }
          if (attempt === MAX_ATTEMPTS - 1) break;
          await new Promise((r) =>
            setTimeout(r, RETRY_BACKOFF[attempt] ?? 1200)
          );
          try {
            const fresh = await gh.getFile<Category[]>(cfg, CATEGORIES_PATH);
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
    })();

    return { categories: next, sync };
  }

  // --- Todo 操作（即座に楽観更新後の todos を返す） ---

  addTodo(input: TodoInput): TodoMutation {
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
    return this.commitTodos(
      (todos) => [...todos, todo],
      `Add todo: ${title}`
    );
  }

  updateTodo(id: string, patch: Partial<TodoInput>): TodoMutation {
    const ts = now();
    return this.commitTodos(
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

  setTodoStatus(id: string, status: Status): TodoMutation {
    const ts = now();
    return this.commitTodos(
      (todos) =>
        todos.map((t) => (t.id === id ? { ...t, status, updatedAt: ts } : t)),
      `Set todo status: ${status}`
    );
  }

  deleteTodo(id: string): TodoMutation {
    return this.commitTodos(
      (todos) => todos.filter((t) => t.id !== id),
      `Delete todo`
    );
  }

  // --- カテゴリ操作 ---

  addCategory(input: CategoryInput): CategoryMutation {
    const name = input.name.trim();
    const parentId = input.parentId ?? null;
    const color = input.color ?? "#6B7280";
    return this.commitCategories((cats) => {
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

  updateCategory(
    id: string,
    patch: Partial<CategoryInput>
  ): CategoryMutation {
    return this.commitCategories((cats) => {
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
  deleteCategory(id: string): MixedMutation {
    const target = this.categories.find((c) => c.id === id);
    const parentId = target?.parentId ?? null;
    const ts = now();

    const catRes = this.commitCategories(
      (cats) =>
        cats
          .filter((c) => c.id !== id)
          .map((c) => (c.parentId === id ? { ...c, parentId } : c)),
      `Delete category`
    );
    const todoRes = this.commitTodos(
      (tds) =>
        tds.map((t) =>
          t.categoryId === id ? { ...t, categoryId: null, updatedAt: ts } : t
        ),
      `Unassign todos from deleted category`
    );
    return {
      todos: todoRes.todos,
      categories: catRes.categories,
      sync: Promise.all([catRes.sync, todoRes.sync]).then(() => undefined),
    };
  }
}
