"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAdminPasswordForClient } from "@/lib/adminPassword";
import { PRESET_THEMES, createThemeId } from "@/lib/minigame";
import type { MinigameCurrent } from "@/types";

const ADMIN_SESSION_KEY = "goukon_admin_auth";
const DELETE_BATCH_SIZE = 400;

function AdminLogin({ onUnlock }: { onUnlock: () => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = () => {
    if (input.trim() === getAdminPasswordForClient()) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
      onUnlock();
    } else {
      setError(true);
      setInput("");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 gap-6">
      <div className="text-center">
        <p className="text-5xl mb-3">⚙️</p>
        <h1 className="text-2xl font-black text-gray-800">管理者ログイン</h1>
        <p className="text-gray-400 text-sm mt-2">管理者パスワードを入力してください</p>
      </div>
      <div className="w-full flex flex-col gap-3">
        <input
          type="password"
          inputMode="text"
          autoComplete="current-password"
          maxLength={24}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="••••"
          autoFocus
          className={`w-full text-center text-3xl font-black tracking-[0.5em] py-4 border-2 rounded-2xl outline-none transition-colors ${
            error ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-gray-500"
          }`}
        />
        {error && <p className="text-red-500 text-sm text-center">パスワードが違います</p>}
        <button
          onClick={handleSubmit}
          disabled={!input}
          className="w-full py-4 bg-gray-800 text-white font-black text-lg rounded-2xl hover:bg-gray-700 transition-colors disabled:opacity-40"
        >
          ログイン
        </button>
      </div>
    </div>
  );
}

async function deleteDocsInChunks(docs: QueryDocumentSnapshot<DocumentData>[]) {
  for (let i = 0; i < docs.length; i += DELETE_BATCH_SIZE) {
    const batch = writeBatch(db);
    docs.slice(i, i + DELETE_BATCH_SIZE).forEach((item) => batch.delete(item.ref));
    await batch.commit();
  }
}

function MinigameAdmin() {
  const router = useRouter();
  const [current, setCurrent] = useState<MinigameCurrent | null>(null);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [customTheme, setCustomTheme] = useState("");
  const [voteCount, setVoteCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const themeText = customTheme.trim() || selectedPreset;
  const status = current?.status ?? "waiting";

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "minigame", "current"),
      (snap) => {
        setCurrent(snap.exists() ? (snap.data() as MinigameCurrent) : null);
      },
      (err) => {
        console.error("ミニゲーム状態の取得に失敗:", err);
        setToast("ミニゲームの状態を読み込めません");
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!current?.themeId || status === "waiting") {
      setVoteCount(0);
      return;
    }
    const q = query(collection(db, "minigame_votes"), where("themeId", "==", current.themeId));
    const unsubscribe = onSnapshot(
      q,
      (snap) => setVoteCount(snap.size),
      (err) => {
        console.error("投票数の取得に失敗:", err);
      }
    );
    return () => unsubscribe();
  }, [current?.themeId, status]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  };

  const startVoting = async () => {
    if (!themeText || busy) return;
    setBusy(true);
    const previousThemeId = current?.themeId;
    const themeId = createThemeId();
    try {
      await setDoc(doc(db, "minigame", "current"), {
        themeId,
        themeText,
        status: "voting",
        createdAt: serverTimestamp(),
      });
      setCustomTheme("");
      if (previousThemeId && previousThemeId !== themeId) {
        try {
          const oldVotes = await getDocs(
            query(collection(db, "minigame_votes"), where("themeId", "==", previousThemeId))
          );
          await deleteDocsInChunks(oldVotes.docs);
        } catch (cleanupErr) {
          console.error("前回の投票削除に失敗（新しい投票は開始済み）:", cleanupErr);
        }
      }
      showToast("投票を開始しました");
    } catch (err) {
      console.error("投票スタートに失敗:", err);
      showToast("投票を開始できませんでした");
    } finally {
      setBusy(false);
    }
  };

  const closeVoting = async () => {
    if (status !== "voting" || busy) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "minigame", "current"), { status: "result" });
      showToast("結果を発表しました");
    } catch (err) {
      console.error("結果発表に失敗:", err);
      showToast("結果を発表できませんでした");
    } finally {
      setBusy(false);
    }
  };

  const resetTheme = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await setDoc(
        doc(db, "minigame", "current"),
        { status: "waiting" },
        { merge: true }
      );
      const votesSnap = await getDocs(collection(db, "minigame_votes"));
      await deleteDocsInChunks(votesSnap.docs);
      showToast("次のテーマ待ちに戻しました");
    } catch (err) {
      console.error("ミニゲームのリセットに失敗:", err);
      showToast("リセットできませんでした");
    } finally {
      setBusy(false);
    }
  };

  const statusLabel =
    status === "voting" ? "投票中" : status === "result" ? "結果発表中" : "開始待ち";

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-gray-700 to-gray-900 px-6 pt-12 pb-6 text-white">
        <button
          onClick={() => router.push("/admin")}
          className="mb-3 flex items-center gap-1 text-gray-400 text-sm hover:text-white transition-colors"
        >
          ← 管理画面へ
        </button>
        <p className="text-gray-400 text-xs tracking-widest uppercase">ミニゲーム</p>
        <h1 className="text-2xl font-black mt-1">なんでもランキング</h1>
      </header>

      <div className="p-6 flex flex-col gap-5">
        <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-bold tracking-widest uppercase mb-4">進行状況</p>
          <div className="text-center py-3 bg-pink-50 rounded-2xl border border-pink-100">
            <p className="text-lg font-black text-gray-800">{statusLabel}</p>
            <p className="text-sm text-gray-500 mt-2 break-words">
              {current?.themeText ? current.themeText : "テーマはまだありません"}
            </p>
            <p className="text-3xl font-black text-pink-500 mt-3">{voteCount}</p>
            <p className="text-xs text-gray-400">人が投票済み</p>
          </div>
        </section>

        <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-bold tracking-widest uppercase mb-4">テーマ選択</p>
          <div className="flex flex-col gap-2">
            {PRESET_THEMES.map((theme) => (
              <button
                key={theme}
                type="button"
                onClick={() => setSelectedPreset(theme)}
                className={`text-left px-4 py-3 rounded-2xl border-2 text-sm font-bold transition-colors ${
                  selectedPreset === theme && !customTheme.trim()
                    ? "border-pink-400 bg-pink-50 text-pink-600"
                    : "border-gray-200 text-gray-700"
                }`}
              >
                {theme}
              </button>
            ))}
          </div>
          <label className="block mt-4">
            <span className="text-xs text-gray-400 font-bold">自由記述</span>
            <textarea
              maxLength={80}
              rows={3}
              value={customTheme}
              onChange={(e) => setCustomTheme(e.target.value)}
              placeholder="オリジナルのテーマを入力"
              className="mt-2 w-full py-3 px-4 border-2 border-gray-200 rounded-xl text-base font-bold text-black outline-none focus:border-pink-400 transition-colors resize-none"
            />
          </label>
          <p className="text-sm text-gray-500 mt-3">
            今回のテーマ: <span className="font-bold text-gray-800">{themeText || "未選択"}</span>
          </p>
          {customTheme.trim() && (
            <p className="text-xs text-gray-400 mt-1">自由記述があるため、固定テーマよりこちらを使います</p>
          )}
        </section>

        <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col gap-3">
          <button
            onClick={startVoting}
            disabled={!themeText || busy}
            className="w-full py-4 bg-pink-500 text-white font-black rounded-2xl disabled:opacity-40"
          >
            投票スタート
          </button>
          <button
            onClick={closeVoting}
            disabled={status !== "voting" || busy}
            className="w-full py-4 bg-gray-800 text-white font-black rounded-2xl disabled:opacity-40"
          >
            投票締め切り・結果発表
          </button>
          <button
            onClick={resetTheme}
            disabled={busy}
            className="w-full py-4 border-2 border-gray-200 text-gray-600 font-black rounded-2xl disabled:opacity-40"
          >
            次のテーマへ（リセット）
          </button>
        </section>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-full shadow-xl font-bold text-sm whitespace-nowrap">
          {toast}
        </div>
      )}
    </main>
  );
}

export default function AdminMinigamePage() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "1") {
      setAuthed(true);
    }
  }, []);

  if (!authed) return <AdminLogin onUnlock={() => setAuthed(true)} />;
  return <MinigameAdmin />;
}
