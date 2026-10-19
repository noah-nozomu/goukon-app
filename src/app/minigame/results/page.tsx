"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import BottomNav from "@/components/BottomNav";
import SessionTabs from "@/components/SessionTabs";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { archiveMinigameRound } from "@/lib/minigameArchive";
import type { MinigameCurrent, MinigameResult } from "@/types";

const RANK_LABEL = ["", "1位", "2位", "3位"];

export default function MinigameResultsPage() {
  const router = useRouter();
  const unreadMessages = useUnreadMessages();
  const [results, setResults] = useState<MinigameResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "minigame", "current"),
      (snap) => {
        const current = snap.exists() ? (snap.data() as MinigameCurrent) : null;
        if (current?.status === "result") {
          archiveMinigameRound(current).catch((err) => {
            console.error("発表中の結果を一覧へ保存できませんでした:", err);
          });
        }
      },
      (err) => {
        console.error("ミニゲーム状態の取得に失敗:", err);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "minigame_results"), orderBy("finishedAt", "asc"));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setResults(
          snap.docs.map((item) => {
            const data = item.data() as MinigameResult;
            return { ...data, themeId: data.themeId || item.id };
          })
        );
        setLoading(false);
        setReadError(false);
      },
      (err) => {
        console.error("投票結果の取得に失敗:", err);
        setReadError(true);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  return (
    <main className="min-h-screen pb-24">
      <header className="bg-gradient-to-r from-pink-500 to-rose-500 px-6 pt-12 pb-6 text-white">
        <button
          onClick={() => router.push("/minigame")}
          className="mb-3 flex items-center gap-1 text-pink-100 text-sm hover:text-white transition-colors"
        >
          ← ミニゲームへ
        </button>
        <h1 className="text-2xl font-black">投票結果</h1>
        <p className="text-pink-100 text-sm mt-1">この回に行ったランキング</p>
      </header>

      <SessionTabs active="minigame" />

      <div className="p-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/minigame"
            className="py-1.5 rounded-xl text-xs font-bold border border-gray-200 bg-white text-gray-500 text-center"
          >
            幹事メニュー
          </Link>
          <span className="py-1.5 rounded-xl text-xs font-bold border border-pink-500 bg-pink-500 text-white text-center">
            投票結果
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-48">
            <div className="w-8 h-8 border-4 border-pink-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : readError ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">⚠️</p>
            <p className="font-bold">結果を表示できません</p>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-5xl mb-3">📋</p>
            <p className="font-bold text-gray-600">まだ結果がありません</p>
            <p className="text-sm mt-2">投票を締め切ると、ここに残ります</p>
          </div>
        ) : (
          results.map((result, index) => <ResultCard key={result.themeId} result={result} index={index} />)
        )}
      </div>

      <BottomNav active="participants" unreadMessages={unreadMessages} />
    </main>
  );
}

function ResultCard({ result, index }: { result: MinigameResult; index: number }) {
  const groups = [1, 2, 3]
    .map((rank) => (result.ranking ?? []).filter((entry) => entry.rank === rank))
    .filter((group) => group.length > 0);

  return (
    <section className="bg-white border border-pink-100 rounded-3xl p-4 shadow-sm flex flex-col gap-3">
      <div>
        <p className="text-[11px] font-bold text-pink-400">第{index + 1}回</p>
        <p className="font-black text-gray-800 leading-snug mt-1">{result.themeText}</p>
        <p className="text-xs text-gray-400 mt-1">{result.totalVotes ?? 0}票</p>
      </div>
      {groups.length === 0 ? (
        <p className="text-sm text-gray-400">投票はありませんでした</p>
      ) : (
        groups.map((group) => (
          <div key={group[0].rank} className="flex flex-col gap-2">
            <p className="text-xs font-black text-pink-500">{RANK_LABEL[group[0].rank]}</p>
            {group.map((entry) => (
              <div key={entry.uid} className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                  {entry.photoURL ? (
                    <img src={entry.photoURL} alt={entry.nickname} className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <p className="flex-1 min-w-0 text-sm font-bold text-gray-800 truncate">{entry.nickname}</p>
                <p className="text-sm font-black text-pink-500">{entry.votes}票</p>
              </div>
            ))}
          </div>
        ))
      )}
    </section>
  );
}
