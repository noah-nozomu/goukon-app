"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const ADMIN_PASSWORD = "0522";
const ADMIN_SESSION_KEY = "goukon_admin_auth";

// ---- パスワード入力画面 ----
function AdminLogin({ onUnlock }: { onUnlock: () => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = () => {
    if (input === ADMIN_PASSWORD) {
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
          inputMode="numeric"
          maxLength={4}
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(false); }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="••••"
          autoFocus
          className={`w-full text-center text-3xl font-black tracking-[0.5em] py-4 border-2 rounded-2xl outline-none transition-colors ${
            error ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-gray-500"
          }`}
        />
        {error && (
          <p className="text-red-500 text-sm text-center">パスワードが違います</p>
        )}
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

// ---- 管理画面本体 ----
function AdminDashboard() {
  const router = useRouter();
  const [participantCount, setParticipantCount] = useState<number | null>(null);
  const [appTitle, setAppTitle] = useState<string>("");
  const [newTitle, setNewTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [roomCode, setRoomCode] = useState<string>("");
  const [newCode, setNewCode] = useState("");
  const [savingCode, setSavingCode] = useState(false);
  const [voteLimit, setVoteLimit] = useState<number>(3);
  const [newVoteLimit, setNewVoteLimit] = useState("");
  const [savingVoteLimit, setSavingVoteLimit] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const unsubCode = onSnapshot(doc(db, "config", "session"), (snap) => {
      setAppTitle(snap.data()?.title ?? "💕 合コンマッチング");
      setRoomCode(snap.data()?.password ?? "");
      setVoteLimit(snap.data()?.voteLimit ?? 3);
    });
    const unsubCount = onSnapshot(collection(db, "participants"), (snap) => {
      setParticipantCount(snap.size);
    });
    return () => { unsubCode(); unsubCount(); };
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleSaveTitle = async () => {
    if (!newTitle.trim()) return;
    setSavingTitle(true);
    await setDoc(doc(db, "config", "session"), {
      title: newTitle.trim(),
    }, { merge: true });
    setNewTitle("");
    setSavingTitle(false);
    showToast("✅ タイトルを変更しました");
  };

  const handleSaveCode = async () => {
    if (!newCode.trim()) return;
    setSavingCode(true);
    await setDoc(doc(db, "config", "session"), {
      password: newCode.trim(),
      createdAt: serverTimestamp(),
    }, { merge: true });
    setNewCode("");
    setSavingCode(false);
    showToast("✅ ルームコードを発行しました");
  };

  const handleSaveVoteLimit = async () => {
    const parsed = parseInt(newVoteLimit);
    if (isNaN(parsed) || parsed < 3 || parsed > 5) return;
    setSavingVoteLimit(true);
    await setDoc(doc(db, "config", "session"), {
      voteLimit: parsed,
    }, { merge: true });
    setNewVoteLimit("");
    setSavingVoteLimit(false);
    showToast(`✅ 投票できる人数を${parsed}名に設定しました`);
  };

  const resetAll = async () => {
    setResetting(true);
    setConfirmReset(false);
    try {
      const matchesSnap = await getDocs(collection(db, "matches"));
      for (const matchDoc of matchesSnap.docs) {
        const msgsSnap = await getDocs(
          collection(db, "messages", matchDoc.id, "messages")
        );
        if (msgsSnap.docs.length > 0) {
          const batch = writeBatch(db);
          msgsSnap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      }
      const [participantsSnap, likesSnap, votesSnap] = await Promise.all([
        getDocs(collection(db, "participants")),
        getDocs(collection(db, "likes")),
        getDocs(collection(db, "votes")),
      ]);
      const batch = writeBatch(db);
      participantsSnap.docs.forEach((d) => batch.delete(d.ref));
      likesSnap.docs.forEach((d) => batch.delete(d.ref));
      votesSnap.docs.forEach((d) => batch.delete(d.ref));
      matchesSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      showToast("✅ リセット完了！次の回が始められます");
    } catch (err) {
      console.error("リセット失敗:", err);
      showToast("❌ エラーが発生しました");
    } finally {
      setResetting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-gray-700 to-gray-900 px-6 pt-12 pb-6 text-white">
        <button
          onClick={() => router.push("/")}
          className="mb-3 flex items-center gap-1 text-gray-400 text-sm hover:text-white transition-colors"
        >
          ← 戻る
        </button>
        <p className="text-gray-400 text-xs tracking-widest uppercase">管理者ページ</p>
        <h1 className="text-2xl font-black mt-1">⚙️ 合コン管理</h1>
      </header>

      <div className="p-6 flex flex-col gap-5">

        {/* タイトル管理 */}
        <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-bold tracking-widest uppercase mb-4">
            アプリタイトル
          </p>
          <div className="text-center py-3 bg-gray-50 rounded-2xl border border-gray-100 mb-4">
            <p className="text-xl font-black text-gray-800 break-words px-2">{appTitle}</p>
            <p className="text-xs text-gray-400 mt-1">現在のタイトル</p>
          </div>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              maxLength={30}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="例: 💕 合コンマッチング"
              className="w-full py-3 px-4 border-2 border-gray-200 rounded-xl text-base font-bold text-black outline-none focus:border-pink-400 transition-colors"
            />
            <button
              onClick={handleSaveTitle}
              disabled={!newTitle.trim() || savingTitle}
              className="w-full py-3 bg-pink-500 text-white font-bold rounded-xl disabled:opacity-40 transition-opacity"
            >
              {savingTitle ? "…" : "変更する"}
            </button>
          </div>
        </section>

        {/* ルームコード管理 */}
        <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-bold tracking-widest uppercase mb-4">
            ルームコード
          </p>
          {roomCode ? (
            <div className="text-center py-3 bg-pink-50 rounded-2xl border border-pink-100 mb-4">
              <p className="text-5xl font-black tracking-[0.4em] text-pink-500">{roomCode}</p>
              <p className="text-xs text-gray-400 mt-2">参加者にこのコードを伝えてください</p>
            </div>
          ) : (
            <p className="text-center text-gray-300 text-sm py-3 mb-4">未発行</p>
          )}
          <div className="flex flex-col gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="例: 1234"
              className="w-full py-3 px-3 border-2 border-gray-200 rounded-xl text-center font-black text-2xl tracking-widest outline-none focus:border-pink-400 transition-colors"
            />
            <button
              onClick={handleSaveCode}
              disabled={!newCode.trim() || savingCode}
              className="w-full py-3 bg-pink-500 text-white font-bold rounded-xl disabled:opacity-40 transition-opacity"
            >
              {savingCode ? "…" : roomCode ? "変更する" : "発行する"}
            </button>
          </div>
        </section>

        {/* マッチング投票人数 */}
        <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-bold tracking-widest uppercase mb-4">
            マッチング投票できる人数
          </p>
          <div className="text-center py-3 bg-purple-50 rounded-2xl border border-purple-100 mb-4">
            <p className="text-5xl font-black text-purple-500">{voteLimit}</p>
            <p className="text-xs text-gray-400 mt-2">現在の設定（1人あたり最大{voteLimit}名に投票可）</p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 justify-center">
              {[3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setNewVoteLimit(String(n))}
                  className={`flex-1 py-3 rounded-xl font-black text-xl border-2 transition-colors ${
                    newVoteLimit === String(n)
                      ? "bg-purple-500 text-white border-purple-500"
                      : "bg-white text-gray-500 border-gray-200 hover:border-purple-300"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <button
              onClick={handleSaveVoteLimit}
              disabled={!newVoteLimit || savingVoteLimit}
              className="w-full py-3 bg-purple-500 text-white font-bold rounded-xl disabled:opacity-40 transition-opacity"
            >
              {savingVoteLimit ? "…" : "設定する"}
            </button>
          </div>
        </section>

        {/* 参加状況 */}
        <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-bold tracking-widest uppercase mb-4">
            現在の参加状況
          </p>
          <div className="flex items-center justify-center py-4">
            {participantCount === null ? (
              <div className="w-16 h-16 bg-gray-100 rounded-full animate-pulse" />
            ) : (
              <div className="text-center">
                <p className="text-6xl font-black text-gray-800">{participantCount}</p>
                <p className="text-gray-400 mt-1">人が参加中</p>
              </div>
            )}
          </div>
        </section>

        {/* リセット */}
        <section className="bg-white rounded-3xl p-6 shadow-sm border border-red-100">
          <p className="text-xs text-red-400 font-bold tracking-widest uppercase mb-2">
            回のリセット
          </p>
          <p className="text-gray-500 text-sm mb-5">
            参加者・いいね・マッチング・チャット履歴をすべて削除します。次の回を始めるときに使ってください。
          </p>
          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              disabled={resetting}
              className="w-full py-4 bg-red-500 text-white font-black text-lg rounded-2xl hover:bg-red-600 transition-colors disabled:opacity-40"
            >
              🗑️ この回をリセットする
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-center text-red-500 font-bold">
                本当にリセットしますか？<br />
                <span className="text-sm font-normal text-gray-400">この操作は取り消せません</span>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmReset(false)}
                  className="flex-1 py-3 border-2 border-gray-200 text-gray-500 font-bold rounded-2xl"
                >
                  キャンセル
                </button>
                <button
                  onClick={resetAll}
                  disabled={resetting}
                  className="flex-1 py-3 bg-red-500 text-white font-bold rounded-2xl disabled:opacity-40"
                >
                  {resetting ? "削除中..." : "実行する"}
                </button>
              </div>
            </div>
          )}
        </section>

        <p className="text-center text-gray-300 text-xs">
          このページのURLは参加者に教えないでください
        </p>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-full shadow-xl font-bold text-sm whitespace-nowrap">
          {toast}
        </div>
      )}
    </main>
  );
}

// ---- エントリーポイント ----
export default function AdminPage() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "1") {
      setAuthed(true);
    }
  }, []);

  if (!authed) return <AdminLogin onUnlock={() => setAuthed(true)} />;
  return <AdminDashboard />;
}
