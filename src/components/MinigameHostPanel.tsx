"use client";

import { useState } from "react";
import {
  collection,
  doc,
  getDocs,
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

async function deleteDocsInChunks(docs: QueryDocumentSnapshot<DocumentData>[]) {
  for (let i = 0; i < docs.length; i += DELETE_BATCH_SIZE) {
    const batch = writeBatch(db);
    docs.slice(i, i + DELETE_BATCH_SIZE).forEach((item) => batch.delete(item.ref));
    await batch.commit();
  }
}

export default function MinigameHostPanel({
  current,
  voteCount,
  isParticipant,
}: {
  current: MinigameCurrent | null;
  voteCount: number;
  isParticipant: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [customTheme, setCustomTheme] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const themeText = customTheme.trim() || selectedPreset;
  const status = current?.status ?? "waiting";
  const statusLabel =
    status === "voting" ? "投票中" : status === "result" ? "結果発表中" : "開始待ち";

  const openPanel = () => {
    if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "1") {
      setUnlocked(true);
    }
    setOpen(true);
  };

  const unlock = () => {
    if (password.trim() !== getAdminPasswordForClient()) {
      setPasswordError(true);
      setPassword("");
      return;
    }
    sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
    setUnlocked(true);
    setPassword("");
    setPasswordError(false);
  };

  const startVoting = async () => {
    if (!themeText || busy) return;
    setBusy(true);
    setMessage(null);
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
      setMessage("投票を開始しました");
    } catch (err) {
      console.error("投票スタートに失敗:", err);
      setMessage("投票を開始できませんでした");
    } finally {
      setBusy(false);
    }
  };

  const closeVoting = async () => {
    if (status !== "voting" || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await updateDoc(doc(db, "minigame", "current"), { status: "result" });
      setMessage("結果を発表しました");
    } catch (err) {
      console.error("結果発表に失敗:", err);
      setMessage("結果を発表できませんでした");
    } finally {
      setBusy(false);
    }
  };

  const resetTheme = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await setDoc(doc(db, "minigame", "current"), { status: "waiting" }, { merge: true });
      const votesSnap = await getDocs(collection(db, "minigame_votes"));
      await deleteDocsInChunks(votesSnap.docs);
      setMessage("次のテーマ待ちに戻しました");
    } catch (err) {
      console.error("ミニゲームのリセットに失敗:", err);
      setMessage("リセットできませんでした");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={openPanel}
        className="w-full text-center text-xs font-bold text-gray-400 py-1"
      >
        幹事メニュー
      </button>
    );
  }

  if (!unlocked) {
    return (
      <section className="bg-white border border-gray-100 rounded-3xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-black text-gray-800">幹事メニュー</p>
          <button type="button" onClick={() => setOpen(false)} className="text-xs font-bold text-gray-400">
            閉じる
          </button>
        </div>
        <input
          type="password"
          inputMode="text"
          autoComplete="current-password"
          maxLength={24}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setPasswordError(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && unlock()}
          placeholder="管理者パスワード"
          className={`w-full py-3 px-4 border-2 rounded-xl text-base font-bold text-black outline-none ${
            passwordError ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-pink-400"
          }`}
        />
        {passwordError && <p className="text-red-500 text-xs mt-2">パスワードが違います</p>}
        <button
          type="button"
          onClick={unlock}
          disabled={!password}
          className="w-full mt-3 py-3 bg-gray-800 text-white font-bold rounded-xl disabled:opacity-40"
        >
          開く
        </button>
      </section>
    );
  }

  return (
    <section className="bg-white border border-pink-100 rounded-3xl p-4 shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-black text-gray-800">幹事メニュー</p>
        <button type="button" onClick={() => setOpen(false)} className="text-xs font-bold text-gray-400">
          閉じる
        </button>
      </div>
      <p className="text-xs text-gray-500">
        {statusLabel}
        {status !== "waiting" ? ` ・ ${voteCount}人が投票済み` : ""}
      </p>
      {!isParticipant && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
          投票に参加するには、先にプロフィール登録が必要です
        </p>
      )}
      <div className="flex flex-col gap-2">
        {PRESET_THEMES.map((theme) => (
          <button
            key={theme}
            type="button"
            onClick={() => setSelectedPreset(theme)}
            className={`text-left px-3 py-2.5 rounded-xl border-2 text-xs font-bold transition-colors ${
              selectedPreset === theme && !customTheme.trim()
                ? "border-pink-400 bg-pink-50 text-pink-600"
                : "border-gray-200 text-gray-700"
            }`}
          >
            {theme}
          </button>
        ))}
      </div>
      <textarea
        maxLength={80}
        rows={2}
        value={customTheme}
        onChange={(e) => setCustomTheme(e.target.value)}
        placeholder="オリジナルのテーマ"
        className="w-full py-3 px-4 border-2 border-gray-200 rounded-xl text-sm font-bold text-black outline-none focus:border-pink-400 resize-none"
      />
      <p className="text-xs text-gray-500">
        今回のテーマ: <span className="font-bold text-gray-800">{themeText || "未選択"}</span>
      </p>
      <button
        type="button"
        onClick={startVoting}
        disabled={!themeText || busy}
        className="w-full py-3 bg-pink-500 text-white font-black rounded-xl disabled:opacity-40"
      >
        投票スタート
      </button>
      <button
        type="button"
        onClick={closeVoting}
        disabled={status !== "voting" || busy}
        className="w-full py-3 bg-gray-800 text-white font-black rounded-xl disabled:opacity-40"
      >
        投票締め切り・結果発表
      </button>
      <button
        type="button"
        onClick={resetTheme}
        disabled={busy}
        className="w-full py-3 border-2 border-gray-200 text-gray-600 font-black rounded-xl disabled:opacity-40"
      >
        次のテーマへ（リセット）
      </button>
      {message && <p className="text-center text-xs font-bold text-gray-500">{message}</p>}
    </section>
  );
}
