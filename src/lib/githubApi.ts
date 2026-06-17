import type { AppConfig } from "./settings";

// ブラウザから GitHub Contents API を直接叩く薄いクライアント。
// data/*.json を「DB」として読み書きする。サーバーは経由しない。

const API = "https://api.github.com";

export class GitHubError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "GitHubError";
  }
}

export interface FileData<T> {
  data: T;
  sha: string;
}

function authHeaders(cfg: AppConfig): Record<string, string> {
  return {
    Authorization: `Bearer ${cfg.pat}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

// UTF-8 を安全に base64 化（btoa はマルチバイト非対応のため TextEncoder を使う）
function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const clean = b64.replace(/\s/g, ""); // GitHubは改行入りbase64を返す
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

export async function getFile<T>(
  cfg: AppConfig,
  path: string
): Promise<FileData<T>> {
  // ブラウザの HTTP キャッシュを無視する（stale な sha 取得を防ぐ）。
  // Cache-Control ヘッダは CORS preflight を誘発して GitHub に弾かれるので、
  // fetch の cache オプションと URL の t パラメータだけで対応する。
  const url = `${API}/repos/${cfg.owner}/${cfg.repo}/contents/${path}?ref=${encodeURIComponent(
    cfg.branch
  )}&t=${Date.now()}`;
  const res = await fetch(url, {
    headers: authHeaders(cfg),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new GitHubError(
      res.status,
      `${path} の取得に失敗 (${res.status}): ${await safeText(res)}`
    );
  }
  const json = await res.json();
  const text = fromBase64(json.content);
  return { data: JSON.parse(text) as T, sha: json.sha };
}

export async function putFile<T>(
  cfg: AppConfig,
  path: string,
  data: T,
  sha: string | null,
  message: string
): Promise<string> {
  const url = `${API}/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
  const body: Record<string, unknown> = {
    message,
    content: toBase64(JSON.stringify(data, null, 2) + "\n"),
    branch: cfg.branch,
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: "PUT",
    headers: { ...authHeaders(cfg), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new GitHubError(
      res.status,
      `${path} の更新に失敗 (${res.status}): ${await safeText(res)}`
    );
  }
  const json = await res.json();
  return json.content?.sha ?? "";
}

// 接続テスト用: リポジトリへアクセスできるか確認する
export async function testConnection(cfg: AppConfig): Promise<void> {
  const url = `${API}/repos/${cfg.owner}/${cfg.repo}`;
  const res = await fetch(url, { headers: authHeaders(cfg) });
  if (!res.ok) {
    const hint =
      res.status === 401
        ? "（トークンが無効か期限切れ）"
        : res.status === 404
          ? "（owner/repo名の誤り、またはトークンの対象リポジトリ設定を確認）"
          : "";
    throw new GitHubError(
      res.status,
      `接続失敗 (${res.status})${hint}: ${await safeText(res)}`
    );
  }
}
