// アプリ設定（GitHubアクセス情報）を localStorage に保存する。
// サーバーが無いため、トークンはこのブラウザ内にのみ保持される。

export interface AppConfig {
  pat: string; // fine-grained PAT（todo-data 限定・Contents権限のみを推奨）
  owner: string;
  repo: string;
  branch: string;
}

export type StorageMode = "github" | "local";

const KEY = "todo-app:config";
const EMPTY: AppConfig = { pat: "", owner: "", repo: "", branch: "main" };

export function loadConfig(): AppConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<AppConfig>) };
  } catch {
    return { ...EMPTY };
  }
}

export function saveConfig(cfg: AppConfig): void {
  localStorage.setItem(KEY, JSON.stringify(cfg));
}

export function clearConfig(): void {
  localStorage.removeItem(KEY);
}

// PAT・owner・repo が揃えば GitHub同期モード、無ければローカルモード
export function modeOf(cfg: AppConfig): StorageMode {
  return cfg.pat && cfg.owner && cfg.repo ? "github" : "local";
}
