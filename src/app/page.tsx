"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import ProfileForm from "@/components/profile/ProfileForm";
import { useAuth } from "@/hooks/useAuth";

const LS_KEY = "goukon_room_code";

type Screen = "loading" | "landing" | "room-code" | "register";

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [screen, setScreen] = useState<Screen>("loading");
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [title, setTitle] = useState("💕 合コンマッチング");
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "config", "session"), (snap) => {
      const code = snap.data()?.password as string | undefined;
      setRoomCode(code ?? null);
      setTitle(snap.data()?.title ?? "💕 合コンマッチング");
      const saved = localStorage.getItem(LS_KEY);
      if (code && saved === code) {
        setScreen("register");
      } else {
        setScreen("landing");
      }
    });
    return () => unsubscribe();
  }, []);

  // 登録済みユーザーは /participants へ自動リダイレクト
  useEffect(() => {
    if (screen !== "register" || !user) return;
    getDoc(doc(db, "participants", user.uid)).then((snap) => {
      if (snap.exists()) {
        router.replace("/participants");
      }
    });
  }, [screen, user, router]);

  const handleSubmit = () => {
    if (!input) return;
    if (input === roomCode) {
      localStorage.setItem(LS_KEY, input);
      setError(false);
      setScreen("register");
    } else {
      setError(true);
      setInput("");
    }
  };

  // ── ローディング ──────────────────────────────────────
  if (screen === "loading") {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-10 h-10 border-4 border-pink-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── ルームコード入力 ───────────────────────────────────
  if (screen === "room-code") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8 gap-6">
        <div className="text-center">
          <p className="text-6xl mb-4">🔑</p>
          <h1 className="text-2xl font-black text-gray-800">ルームコードを入力</h1>
          <p className="text-gray-400 text-sm mt-2">幹事から教えてもらった4桁のコードを入力してください</p>
        </div>

        <div className="w-full flex flex-col gap-3">
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(false); }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="0000"
            autoFocus
            className={`w-full text-center text-5xl font-black text-black tracking-[0.5em] py-5 border-2 rounded-2xl outline-none transition-colors ${
              error ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-pink-400"
            }`}
          />
          {error && (
            <p className="text-red-500 text-sm text-center">コードが違います</p>
          )}
          <button
            onClick={handleSubmit}
            disabled={input.length === 0}
            className="w-full py-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-black text-lg rounded-2xl shadow-lg disabled:opacity-40 transition-opacity"
          >
            入室する 🎉
          </button>
          <button
            onClick={() => { setScreen("landing"); setInput(""); setError(false); }}
            className="w-full py-3 text-gray-400 text-sm font-medium"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  // ── プロフィール登録 ───────────────────────────────────
  if (screen === "register") {
    return (
      <main className="min-h-screen flex flex-col">
        <header className="relative overflow-hidden bg-gradient-to-br from-pink-500 via-rose-400 to-fuchsia-500 pt-14 pb-10 px-6 text-white">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
          <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-white/10" />
          <div className="relative z-10">
            <button
              onClick={() => { setScreen("landing"); localStorage.removeItem("goukon_room_code"); }}
              className="mb-4 flex items-center gap-1 text-pink-100 text-sm hover:text-white transition-colors"
            >
              ← 戻る
            </button>
            <h1 className="text-3xl font-black leading-tight break-words">{title}</h1>
            <p className="text-pink-100 text-sm mt-3">気になる人に「いいね」を送ろう</p>
          </div>
        </header>

        <div className="flex-1 px-6 py-8">
          <div className="mb-6">
            <h2 className="text-xl font-black text-gray-800">プロフィール設定</h2>
            <p className="text-gray-400 text-sm mt-1">写真と番号を登録して参加しよう！</p>
          </div>
          <ProfileForm />
        </div>
      </main>
    );
  }

  // ── ランディング ───────────────────────────────────────
  return (
    <main className="min-h-screen flex flex-col">
      <div className="relative overflow-hidden bg-gradient-to-br from-pink-500 via-rose-400 to-fuchsia-500 flex-1 flex flex-col items-center justify-center px-8 text-white">
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white/10" />
        <div className="absolute top-1/3 -left-8 w-24 h-24 rounded-full bg-white/5" />

        <div className="relative z-10 text-center w-full max-w-xs">
          <h1 className="text-4xl font-black leading-tight mb-2 break-words">{title}</h1>
          <p className="text-pink-100 text-base mt-3 mb-12">気になる人に「いいね」を送ろう</p>

          <div className="flex flex-col gap-4 w-full">
            <button
              onClick={() => setScreen("room-code")}
              className="w-full py-5 bg-white text-pink-500 font-black text-xl rounded-3xl shadow-xl hover:shadow-2xl transition-shadow active:scale-95"
            >
              参加する 🎉
            </button>
            <button
              onClick={() => router.push("/admin")}
              className="w-full py-3 bg-white/20 text-white font-bold text-base rounded-2xl border border-white/30 hover:bg-white/30 transition-colors active:scale-95"
            >
              管理者
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
