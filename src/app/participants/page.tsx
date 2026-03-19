"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useLike } from "@/hooks/useLike";
import { useVote } from "@/hooks/useVote";
import BottomNav from "@/components/BottomNav";
import type { Participant } from "@/types";

export default function ParticipantsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [voteLimit, setVoteLimit] = useState(3);
  const [likeSending, setLikeSending] = useState<Set<string>>(new Set());
  const [voteSending, setVoteSending] = useState<Set<string>>(new Set());
  const [matchedPartner, setMatchedPartner] = useState<Participant | null>(null);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [likeToast, setLikeToast] = useState<string | null>(null);
  const likeToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLikersRef = useRef<Set<string> | null>(null);

  const { myLikes, sendLike } = useLike();
  const { myVotes, sendVote } = useVote(voteLimit);

  // 投票人数上限を Firestore から取得
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "config", "session"), (snap) => {
      setVoteLimit(snap.data()?.voteLimit ?? 3);
    });
    return () => unsubscribe();
  }, []);

  // 参加者一覧をリアルタイム購読
  useEffect(() => {
    const q = query(collection(db, "participants"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setParticipants(snapshot.docs.map((d) => d.data() as Participant));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // いいね受信通知のリアルタイムリスナー
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "likes"), where("to", "==", user.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const currentUids = new Set(snapshot.docs.map((d) => d.data().from as string));

      // 初回ロード時は既存のいいねを記録するだけ（通知しない）
      if (initialLikersRef.current === null) {
        initialLikersRef.current = new Set(currentUids);
        return;
      }

      // 新しくいいねしてくれた人だけ通知
      for (const uid of currentUids) {
        if (!initialLikersRef.current.has(uid)) {
          initialLikersRef.current.add(uid);
          const senderSnap = await getDoc(doc(db, "participants", uid));
          if (senderSnap.exists()) {
            const sender = senderSnap.data() as Participant;
            showLikeToast(`👍 ${sender.nickname}からいいねが届きました！`);
          }
        }
      }
    });
    return () => unsubscribe();
  }, [user]);

  const showLikeToast = (msg: string) => {
    if (likeToastTimer.current) clearTimeout(likeToastTimer.current);
    setLikeToast(msg);
    likeToastTimer.current = setTimeout(() => setLikeToast(null), 4000);
  };

  const handleLike = async (target: Participant) => {
    if (likeSending.has(target.uid) || myLikes.has(target.uid)) return;
    setLikeSending((prev) => new Set([...prev, target.uid]));
    try {
      await sendLike(target.uid);
    } finally {
      setLikeSending((prev) => { const n = new Set(prev); n.delete(target.uid); return n; });
    }
  };

  const handleVote = async (target: Participant) => {
    if (voteSending.has(target.uid) || myVotes.has(target.uid)) return;
    if (myVotes.size >= voteLimit) return;
    setVoteSending((prev) => new Set([...prev, target.uid]));
    try {
      const result = await sendVote(target.uid);
      if (result.matched) setMatchedPartner(target);
    } finally {
      setVoteSending((prev) => { const n = new Set(prev); n.delete(target.uid); return n; });
    }
  };

  const others = participants.filter((p) => p.uid !== user?.uid);
  const votesRemaining = voteLimit - myVotes.size;

  return (
    <main className="min-h-screen pb-20">

      {/* いいね通知トースト */}
      {likeToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-white border border-pink-200 text-gray-800 px-5 py-3 rounded-2xl shadow-xl font-bold text-sm whitespace-nowrap">
          {likeToast}
        </div>
      )}

      {/* マッチング成立モーダル */}
      {matchedPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
          <div className="bg-white rounded-3xl p-8 w-full text-center shadow-2xl">
            <p className="text-5xl mb-2">🎉</p>
            <h2 className="text-2xl font-black text-pink-500">マッチング成立！</h2>
            <div className="mt-4 w-24 h-24 rounded-full overflow-hidden mx-auto border-4 border-pink-300 relative">
              <Image
                src={matchedPartner.photoURL}
                alt={matchedPartner.nickname}
                fill
                className="object-cover"
                sizes="96px"
              />
            </div>
            <p className="mt-3 font-black text-gray-800 text-lg">{matchedPartner.nickname}さん</p>
            <p className="text-gray-400 text-sm mt-1">お互いにマッチング投票しました！</p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setMatchedPartner(null)}
                className="flex-1 py-3 rounded-2xl border-2 border-gray-200 text-gray-500 font-bold"
              >
                閉じる
              </button>
              <a
                href="/matches"
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-black text-center"
              >
                チャットへ →
              </a>
            </div>
          </div>
        </div>
      )}

      <header className="bg-gradient-to-r from-pink-500 to-rose-500 px-6 pt-12 pb-6 text-white">
        <button
          onClick={() => router.back()}
          className="mb-3 flex items-center gap-1 text-pink-100 text-sm hover:text-white transition-colors"
        >
          ← 戻る
        </button>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-black">参加者一覧 👀</h1>
            <p className="text-pink-100 text-sm mt-1">いいね＆マッチング投票を送ろう</p>
          </div>
          {/* 投票残数バッジ */}
          <div className="text-right">
            <p className="text-pink-100 text-xs mb-1">マッチング投票</p>
            <span className={`text-xl font-black ${votesRemaining === 0 ? "text-white/50" : "text-white"}`}>
              {myVotes.size}
              <span className="text-base font-bold text-pink-200">/{voteLimit}</span>
            </span>
          </div>
        </div>
      </header>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <div className="w-8 h-8 border-4 border-pink-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : others.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-3">🫥</p>
            <p>まだ他の参加者がいません</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {others.map((p) => {
              const liked = myLikes.has(p.uid);
              const voted = myVotes.has(p.uid);
              const isLikeSending = likeSending.has(p.uid);
              const isVoteSending = voteSending.has(p.uid);
              const voteLimitReached = myVotes.size >= voteLimit && !voted;

              return (
                <div
                  key={p.uid}
                  className="rounded-3xl overflow-hidden shadow-md bg-white border border-gray-100"
                >
                  <div className="aspect-square relative bg-gray-200">
                    {/* スケルトンローディング */}
                    {!loadedImages.has(p.uid) && (
                      <div className="absolute inset-0 bg-gray-200 animate-pulse z-10" />
                    )}
                    <Image
                      src={p.photoURL}
                      alt={p.nickname}
                      fill
                      sizes="(max-width: 768px) 50vw, 224px"
                      loading="lazy"
                      className="object-cover"
                      onLoad={() => setLoadedImages((prev) => new Set([...prev, p.uid]))}
                    />
                    {liked && (
                      <div className="absolute top-2 right-2 bg-pink-500 rounded-full w-7 h-7 flex items-center justify-center text-white text-sm shadow-lg">
                        ♥
                      </div>
                    )}
                    {voted && (
                      <div className="absolute top-2 left-2 bg-purple-500 rounded-full w-7 h-7 flex items-center justify-center text-white text-xs shadow-lg font-bold">
                        ✓
                      </div>
                    )}
                  </div>
                  <div className="p-3 flex flex-col gap-2">
                    <span className="font-bold text-gray-700 text-sm truncate">{p.nickname}</span>
                    <div className="flex gap-1.5">
                      {/* いいねボタン */}
                      <button
                        onClick={() => handleLike(p)}
                        disabled={liked || isLikeSending}
                        className={`flex-1 h-8 rounded-xl flex items-center justify-center text-sm transition-all duration-200 ${
                          liked
                            ? "bg-pink-500 text-white"
                            : isLikeSending
                            ? "bg-pink-100 text-pink-300 animate-pulse"
                            : "bg-pink-50 text-pink-400 hover:bg-pink-100 active:scale-95"
                        }`}
                      >
                        {liked ? "♥" : "♡"}
                      </button>
                      {/* マッチング投票ボタン */}
                      <button
                        onClick={() => handleVote(p)}
                        disabled={voted || isVoteSending || voteLimitReached}
                        className={`flex-1 h-8 rounded-xl text-xs font-bold transition-all duration-200 ${
                          voted
                            ? "bg-purple-500 text-white"
                            : isVoteSending
                            ? "bg-purple-100 text-purple-300 animate-pulse"
                            : voteLimitReached
                            ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                            : "bg-purple-50 text-purple-500 hover:bg-purple-100 active:scale-95"
                        }`}
                      >
                        {voted ? "投票済" : voteLimitReached ? "上限" : "投票"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav active="participants" />
    </main>
  );
}
