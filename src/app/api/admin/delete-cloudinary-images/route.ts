import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { resolveServerAdminPassword } from "@/lib/adminPassword";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DELETE_CHUNK = 100;

function configureCloudinary(): void {
  const cloudName =
    process.env.CLOUDINARY_CLOUD_NAME ?? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "CLOUDINARY_CLOUD_NAME（または NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME）, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET が未設定です"
    );
  }
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
}

function verifyAdminPassword(candidate: string): boolean {
  return candidate.trim() === resolveServerAdminPassword();
}

type DeletedMap = Record<string, string>;

/**
 * Cloudinary Admin API で画像を削除。削除済み（not found）も成功扱い。
 */
async function deleteResourcesChunk(publicIds: string[]): Promise<DeletedMap> {
  const res = (await cloudinary.api.delete_resources(publicIds, {
    resource_type: "image",
  })) as { deleted?: DeletedMap; deleted_counts?: DeletedMap };

  const deleted = res.deleted ?? {};
  const missing = publicIds.filter((id) => deleted[id] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `delete_resources の応答に含まれない public_id があります: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}`
    );
  }
  const notOk = publicIds.filter((id) => {
    const status = deleted[id]?.toLowerCase() ?? "";
    return status !== "deleted" && status !== "not found";
  });
  if (notOk.length > 0) {
    throw new Error(
      `削除に失敗した画像があります: ${notOk.slice(0, 5).join(", ")}${notOk.length > 5 ? "…" : ""}`
    );
  }
  return deleted;
}

export async function POST(request: NextRequest) {
  let body: { publicIds?: unknown; adminPassword?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON が不正です" }, { status: 400 });
  }

  const raw = Array.isArray(body.publicIds) ? body.publicIds : [];
  const publicIds = [
    ...new Set(
      raw.filter((id): id is string => typeof id === "string" && id.trim().length > 0).map((id) => id.trim())
    ),
  ];

  if (publicIds.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0, chunks: 0 });
  }

  const pwd = typeof body.adminPassword === "string" ? body.adminPassword : "";
  if (!verifyAdminPassword(pwd)) {
    return NextResponse.json(
      { ok: false, error: "管理パスワードが正しくありません（.env の NEXT_PUBLIC_ADMIN_PASSWORD または ADMIN_PASSWORD を確認）" },
      { status: 401 }
    );
  }

  try {
    configureCloudinary();
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 503 }
    );
  }

  const chunkResults: { count: number; deleted: DeletedMap }[] = [];
  try {
    for (let i = 0; i < publicIds.length; i += DELETE_CHUNK) {
      const chunk = publicIds.slice(i, i + DELETE_CHUNK);
      const deleted = await deleteResourcesChunk(chunk);
      chunkResults.push({ count: chunk.length, deleted });
    }
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        partialChunks: chunkResults.length,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    deleted: publicIds.length,
    chunks: chunkResults.length,
  });
}
