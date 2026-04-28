/** 管理ログイン・Cloudinary 削除 API 認証で共通。`.env` の NEXT_PUBLIC_ADMIN_PASSWORD（4文字以上）またはデフォルト「8810」。 */
const FALLBACK = "8810";

/** クライアント（ログイン画面／リセット）：NEXT_PUBLIC_ADMIN_PASSWORD が読めればそれを使う */
export function getAdminPasswordForClient(): string {
  const raw = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
  const v = typeof raw === "string" ? raw.trim() : "";
  return v.length >= 4 ? v : FALLBACK;
}

/** サーバー：ADMIN_PASSWORD を優先し、なければ NEXT_PUBLIC と同じ値も参照 */
export function resolveServerAdminPassword(): string {
  const a = typeof process.env.ADMIN_PASSWORD === "string" ? process.env.ADMIN_PASSWORD.trim() : "";
  if (a.length >= 4) return a;
  const b =
    typeof process.env.NEXT_PUBLIC_ADMIN_PASSWORD === "string"
      ? process.env.NEXT_PUBLIC_ADMIN_PASSWORD.trim()
      : "";
  if (b.length >= 4) return b;
  return FALLBACK;
}
