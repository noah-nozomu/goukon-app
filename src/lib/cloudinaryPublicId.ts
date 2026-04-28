/**
 * Cloudinary アップロード時に付与した public_id と同じ形式（例: goukon/uid_xxx）を
 * 既存の secure_url から推測するフォールバック用。
 * アップロードは常に public_id を `goukon/...` としている前提。
 */
export function extractGoukonPublicIdFromUrl(url: string | undefined | null): string | null {
  if (!url || typeof url !== "string") return null;
  const withoutQuery = url.split("?")[0] ?? url;
  const m = withoutQuery.match(/\b(goukon\/[A-Za-z0-9_-]+)(?:\.[^./?]+)?$/);
  return m ? m[1] : null;
}

import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";

/** 参加者ドキュメントから Cloudinary 削除用の public_id を一意に集める */
export function collectPublicIdsFromParticipantDocs(
  docs: QueryDocumentSnapshot<DocumentData>[]
): string[] {
  const set = new Set<string>();
  for (const d of docs) {
    const data = d.data();
    const fromDb =
      typeof data.photoPublicId === "string" ? data.photoPublicId.trim() : "";
    const fromUrl =
      typeof data.photoURL === "string"
        ? extractGoukonPublicIdFromUrl(data.photoURL)
        : "";
    const pid = fromDb || fromUrl || "";
    if (pid) set.add(pid);
  }
  return [...set];
}
