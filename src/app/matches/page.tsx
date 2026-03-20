"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import BottomNav from "@/components/BottomNav";
import type { Match, Participant } from "@/types";

type MatchItem = { match: Match; partner: Participant };

export default function MatchesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "matches"),
      where("users", "array-contains", user.uid)
    );
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const results = await Promise.all(
        snapshot.docs.map(async (d) => {
          const match = { id: d.id, ...d.data() } as Match;
          const partnerUid = match.users.find((u) => u !== user.uid)!;
          const partnerSnap = await getDoc(doc(db, "participants", partnerUid));
          const partner = partnerSnap.data() as Participant;
          return { match, partner };
        })
      );
      setItems(results);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  return (
    <main className="min-h-screen pb-20">
      <header className="bg-gradient-to-r from-fuchsia-500 to-pink-500 px-6 pt-12 pb-6 text-white">
        <button
          onClick={() => router.replace("/participants")}
          className="mb-3 flex items-center gap-1 text-pink-100 text-sm hover:text-white transition-colors"
        >
          ← 戻る
        </button>
        <h1 className="text-2xl font-black">マッチング 💕</h1>
        <p className="text-pink-100 text-sm mt-1">お互いにいいねした相手</p>
      </header>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <div className="w-8 h-8 border-4 border-pink-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-5xl mb-3">💭</p>
            <p className="font-bold">まだマッチングしていません</p>
            <p className="text-sm mt-1 mb-4">参加者にいいねを送ってみよう</p>
            <Link
              href="/participants"
              className="inline-block px-6 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold rounded-full text-sm"
            >
              参加者一覧へ
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map(({ match, partner }) => (
              <Link
                key={match.id}
                href={`/chat/${match.id}`}
                className="flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-pink-200 transition-colors"
              >
                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-pink-200 flex-shrink-0">
                  <img
                    src={partner.photoURL}
                    alt={partner.nickname}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800">{partner.nickname}</p>
                  <p className="text-gray-400 text-xs mt-0.5 truncate">
                    {match.lastMessage ?? "メッセージを送ってみよう 👋"}
                  </p>
                </div>
                <span className="text-pink-400 text-lg flex-shrink-0">→</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <BottomNav active="matches" />
    </main>
  );
}
