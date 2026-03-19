/**
 * テスト用マッチング作成スクリプト
 * タロウ（seed-001）とジロウ（seed-002）のマッチングとチャットメッセージを作成する
 * 実行: npx ts-node src/scripts/createTestMatch.ts
 */

import * as fs from "fs";
import * as path from "path";
import { initializeApp, FirebaseApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  addDoc,
  collection,
  Timestamp,
} from "firebase/firestore";

// .env.local を手動で読み込む（dotenv 不要）
function loadEnvLocal(): void {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    console.warn(".env.local が見つかりません。環境変数を直接使用します。");
    return;
  }
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app: FirebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(app);

const UID_TARO  = "seed-001"; // タロウ
const UID_JIRO  = "seed-002"; // ジロウ

// matchId は uid を昇順ソートして "_" 結合（generateMatchId と同じロジック）
const matchId = [UID_TARO, UID_JIRO].sort().join("_");

async function createTestMatch(): Promise<void> {
  console.log("\n🤝 テストマッチングを作成します\n");
  console.log(`  対象: タロウ (${UID_TARO}) ↔ ジロウ (${UID_JIRO})`);
  console.log(`  matchId: ${matchId}\n`);

  // 1. matches ドキュメントを作成
  const firstMessage = "こんにちは！";
  await setDoc(doc(db, "matches", matchId), {
    users: [UID_TARO, UID_JIRO].sort(),
    createdAt: Timestamp.now(),
    lastMessage: firstMessage,
  });
  console.log("  ✅ matches ドキュメントを作成しました");

  // 2. チャットメッセージを作成（タロウが送信）
  await addDoc(collection(db, "messages", matchId, "messages"), {
    senderId: UID_TARO,
    text: firstMessage,
    createdAt: Timestamp.now(),
  });
  console.log(`  ✅ チャットメッセージを作成しました: 「${firstMessage}」`);

  console.log("\n🎉 完了！ /matches からチャットを確認できます\n");
  process.exit(0);
}

createTestMatch().catch((err: unknown) => {
  console.error("❌ エラーが発生しました:", err);
  process.exit(1);
});
