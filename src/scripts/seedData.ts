/**
 * テストデータ投入スクリプト
 * 実行: npx ts-node src/scripts/seedData.ts
 */

import * as fs from "fs";
import * as path from "path";
import { initializeApp, FirebaseApp } from "firebase/app";
import { getFirestore, doc, setDoc, Timestamp } from "firebase/firestore";

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

const PHOTO_URL =
  "https://res.cloudinary.com/demo/image/upload/w_200,h_200,c_fill/sample.jpg";

const SEED_PARTICIPANTS = [
  { uid: "seed-001", nickname: "タロウ" },
  { uid: "seed-002", nickname: "ジロウ" },
  { uid: "seed-003", nickname: "サブロウ" },
  { uid: "seed-004", nickname: "ハナコ" },
  { uid: "seed-005", nickname: "サクラ" },
  { uid: "seed-006", nickname: "ユキ" },
];

async function seed(): Promise<void> {
  console.log(`\n🌱 シードデータを作成します（${SEED_PARTICIPANTS.length}名）\n`);

  for (const p of SEED_PARTICIPANTS) {
    await setDoc(doc(db, "participants", p.uid), {
      uid: p.uid,
      nickname: p.nickname,
      photoURL: PHOTO_URL,
      createdAt: Timestamp.now(),
    });
    console.log(`  ✅ ${p.nickname}  (${p.uid})`);
  }

  console.log("\n🎉 完了！\n");
  process.exit(0);
}

seed().catch((err: unknown) => {
  console.error("❌ エラーが発生しました:", err);
  process.exit(1);
});
