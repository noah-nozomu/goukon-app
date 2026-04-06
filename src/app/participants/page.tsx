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
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import type { Participant } from "@/types";

const LS_SEEN_LIKES_KEY = "goukon_seen_likes";

export default function ParticipantsPage() {
  const LONG_PRESS_MS = 400;
  const router = useRouter();
  const { user } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [voteLimit, setVoteLimit] = useState(3);
  const [likeSending, setLikeSending] = useState<Set<string>>(new Set());
  const [voteSending, setVoteSending] = useState<Set<string>>(new Set());
  const [matchNotification, setMatchNotification] = useState<{ partner: Participant; matchId: string } | null>(null);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  // いいね通知トースト
  const [likeToast, setLikeToast] = useState<string | null>(null);
  const likeToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLikersRef = useRef<Set<string> | null>(null);

  // マッチング通知（先に投票した側にも通知するためリアルタイム監視）
  const initialMatchIdsRef = useRef<Set<string> | null>(null);

  // もらったいいね一覧
  const [likedByMap, setLikedByMap] = useState<Map<string, Participant>>(new Map());
  const [likedByCount, setLikedByCount] = useState(0);
  const [seenLikeCount, setSeenLikeCount] = useState(() =>
    typeof window !== "undefined"
      ? parseInt(localStorage.getItem(LS_SEEN_LIKES_KEY) ?? "0", 10)
      : 0
  );
  const [showLikesModal, setShowLikesModal] = useState(false);
  const fetchedLikerUidsRef = useRef<Set<string>>(new Set());

  // 投票確認ダイアログ
  const [voteTarget, setVoteTarget] = useState<Participant | null>(null);
  // 写真ズームモーダル
  const [zoomTarget, setZoomTarget] = useState<Participant | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { myLikes, sendLike } = useLike();
  const { myVotes, sendVote } = useVote(voteLimit);
  const unreadMessages = useUnreadMessages();

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

  // マッチング成立をリアルタイム監視（両ユーザーに通知）
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "matches"),
      where("users", "array-contains", user.uid)
    );
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (initialMatchIdsRef.current === null) {
        // 初回ロード時は既存マッチIDを記録するだけ
        initialMatchIdsRef.current = new Set(snapshot.docs.map((d) => d.id));
        return;
      }
      for (const d of snapshot.docs) {
        if (!initialMatchIdsRef.current.has(d.id)) {
          initialMatchIdsRef.current.add(d.id);
          const partnerUid = (d.data().users as string[]).find((u) => u !== user.uid)!;
          const partnerSnap = await getDoc(doc(db, "participants", partnerUid));
          if (partnerSnap.exists()) {
            setMatchNotification({
              partner: partnerSnap.data() as Participant,
              matchId: d.id,
            });
          }
        }
      }
    });
    return () => unsubscribe();
  }, [user]);

  // いいね受信：通知 + 一覧管理
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "likes"), where("to", "==", user.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const currentUids = snapshot.docs.map((d) => d.data().from as string);
      setLikedByCount(currentUids.length);

      const isFirstLoad = initialLikersRef.current === null;
      if (isFirstLoad) {
        initialLikersRef.current = new Set(currentUids);
      }

      for (const uid of currentUids) {
        // 参加者データ未取得なら fetch
        if (!fetchedLikerUidsRef.current.has(uid)) {
          fetchedLikerUidsRef.current.add(uid);
          const snap = await getDoc(doc(db, "participants", uid));
          if (snap.exists()) {
            const participant = snap.data() as Participant;
            setLikedByMap((prev) => new Map([...prev, [uid, participant]]));
            // 初回ロードでない場合のみトースト通知
            if (!isFirstLoad) {
              showLikeToast(`👍 ${participant.nickname}からいいねが届きました！`);
            }
          }
        } else if (!isFirstLoad && !initialLikersRef.current!.has(uid)) {
          // 既取得だが初回セット後の新着通知
          initialLikersRef.current!.add(uid);
          const p = likedByMap.get(uid);
          if (p) showLikeToast(`👍 ${p.nickname}からいいねが届きました！`);
        }

        if (!isFirstLoad) initialLikersRef.current!.add(uid);
      }
    });
    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const showLikeToast = (msg: string) => {
    if (likeToastTimer.current) clearTimeout(likeToastTimer.current);
    setLikeToast(msg);
    likeToastTimer.current = setTimeout(() => setLikeToast(null), 4000);
  };

  const openLikesModal = () => {
    setShowLikesModal(true);
    setSeenLikeCount(likedByCount);
    localStorage.setItem(LS_SEEN_LIKES_KEY, String(likedByCount));
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

  const handleVoteConfirmed = async (target: Participant) => {
    setVoteTarget(null);
    if (voteSending.has(target.uid) || myVotes.has(target.uid)) return;
    if (myVotes.size >= voteLimit) return;
    setVoteSending((prev) => new Set([...prev, target.uid]));
    try {
      await sendVote(target.uid);
    } finally {
      setVoteSending((prev) => { const n = new Set(prev); n.delete(target.uid); return n; });
    }
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const startLongPress = (target: Participant) => {
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      setZoomTarget(target);
      longPressTimerRef.current = null;
    }, LONG_PRESS_MS);
  };

  const others = participants.filter((p) => p.uid !== user?.uid);
  const votesRemaining = voteLimit - myVotes.size;
  const unseenLikes = Math.max(0, likedByCount - seenLikeCount);

  return (
    <main className="min-h-screen pb-20">

      {/* いいね通知トースト */}
      {likeToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-white border border-pink-200 text-gray-800 px-5 py-3 rounded-2xl shadow-xl font-bold text-sm whitespace-nowrap">
          {likeToast}
        </div>
      )}

      {/* もらったいいね モーダル */}
      {showLikesModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
          <div className="bg-white rounded-t-3xl w-full max-w-md p-6 pb-10 shadow-2xl max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between mb-5 flex-shrink-0">
              <h2 className="font-black text-gray-800 text-lg">💌 もらったいいね</h2>
              <button
                onClick={() => setShowLikesModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-200"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {likedByCount === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <p className="text-4xl mb-3">💭</p>
                  <p className="text-sm">まだいいねが届いていません</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {Array.from(likedByMap.values()).map((p) => (
                    <div key={p.uid} className="flex items-center gap-3 py-2">
                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-pink-200 flex-shrink-0 relative bg-gray-100">
                        <Image
                          src={p.photoURL}
                          alt={p.nickname}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      </div>
                      <span className="font-bold text-gray-800">{p.nickname}</span>
                      <span className="ml-auto text-pink-400 text-lg">♥</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 投票確認ダイアログ */}
      {voteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
          <div className="bg-white rounded-3xl p-8 w-full shadow-2xl">
            <div className="w-16 h-16 rounded-full overflow-hidden mx-auto border-2 border-purple-200 relative mb-4 bg-gray-100">
              <Image
                src={voteTarget.photoURL}
                alt={voteTarget.nickname}
                fill
                sizes="64px"
                className="object-cover"
              />
            </div>
            <h2 className="text-xl font-black text-center text-gray-800 mb-2">
              {voteTarget.nickname}さんに投票しますか？
            </h2>
            <p className="text-gray-400 text-sm text-center mb-6">
              この操作は取り消せません
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setVoteTarget(null)}
                className="flex-1 py-3 rounded-2xl border-2 border-gray-200 text-gray-500 font-bold"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleVoteConfirmed(voteTarget)}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white font-black"
              >
                投票する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 写真ズームモーダル */}
      {zoomTarget && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center px-4"
          onClick={() => setZoomTarget(null)}
        >
          <div className="w-full max-w-md">
            <div className="relative w-full aspect-square rounded-3xl overflow-hidden border-2 border-white/40 shadow-2xl">
              <Image
                src={`${zoomTarget.photoURL}${zoomTarget.createdAt ? `?v=${zoomTarget.createdAt.seconds}` : ""}`}
                alt={zoomTarget.nickname}
                fill
                sizes="(max-width: 768px) 96vw, 480px"
                className="object-cover"
              />
            </div>
            <p className="text-center text-white font-black mt-4">{zoomTarget.nickname}</p>
            <p className="text-center text-white/70 text-xs mt-1">タップで閉じる</p>
          </div>
        </div>
      )}

      {/* マッチング成立モーダル */}
      {matchNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
          <div className="bg-white rounded-3xl p-8 w-full text-center shadow-2xl">
            <p className="text-5xl mb-2">🎉</p>
            <h2 className="text-2xl font-black text-pink-500">マッチング成立！</h2>
            <div className="mt-4 w-24 h-24 rounded-full overflow-hidden mx-auto border-4 border-pink-300 relative">
              <Image
                src={matchNotification.partner.photoURL}
                alt={matchNotification.partner.nickname}
                fill
                className="object-cover"
                sizes="96px"
              />
            </div>
            <p className="mt-3 font-black text-gray-800 text-lg">
              {matchNotification.partner.nickname}さんとマッチングしました！💕
            </p>
            <p className="text-gray-400 text-sm mt-1">お互いにマッチング投票しました！</p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setMatchNotification(null)}
                className="flex-1 py-3 rounded-2xl border-2 border-gray-200 text-gray-500 font-bold"
              >
                閉じる
              </button>
              <a
                href={`/chat/${matchNotification.matchId}`}
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
          onClick={() => router.replace("/")}
          className="mb-3 flex items-center gap-1 text-pink-100 text-sm hover:text-white transition-colors"
        >
          ← 戻る
        </button>
        <button
          onClick={() => router.push("/profile")}
          className="mb-3 ml-auto block text-pink-100 text-xs font-bold underline underline-offset-2 hover:text-white transition-colors"
        >
          プロフィール編集
        </button>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-black">参加者一覧</h1>
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
              const mutualLike = liked && likedByMap.has(p.uid);
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
                    {!loadedImages.has(p.uid) && (
                      <div className="absolute inset-0 bg-gray-200 animate-pulse z-10" />
                    )}
                    <button
                      type="button"
                      className="absolute inset-0 z-20"
                      onMouseDown={() => startLongPress(p)}
                      onMouseUp={clearLongPressTimer}
                      onMouseLeave={clearLongPressTimer}
                      onTouchStart={() => startLongPress(p)}
                      onTouchEnd={clearLongPressTimer}
                      onTouchCancel={clearLongPressTimer}
                      onTouchMove={clearLongPressTimer}
                      aria-label={`${p.nickname}の写真を拡大`}
                    />
                    <Image
                      src={`${p.photoURL}${p.createdAt ? `?v=${p.createdAt.seconds}` : ""}`}
                      alt={p.nickname}
                      fill
                      sizes="(max-width: 768px) 50vw, 224px"
                      loading="lazy"
                      className="object-cover"
                      onLoad={() => setLoadedImages((prev) => new Set([...prev, p.uid]))}
                    />
                    {mutualLike && (
                      <div className="absolute top-2 right-2 z-30 bg-pink-500 rounded-full w-7 h-7 flex items-center justify-center text-white text-sm shadow-lg">
                        ♥
                      </div>
                    )}
                    {voted && (
                      <div className="absolute top-2 left-2 z-30 bg-purple-500 rounded-full w-7 h-7 flex items-center justify-center text-white text-xs shadow-lg font-bold">
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
                        onClick={() => !voted && !isVoteSending && !voteLimitReached && setVoteTarget(p)}
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

      {/* もらったいいね フローティングボタン */}
      <button
        onClick={openLikesModal}
        className="fixed bottom-36 right-4 flex items-center gap-2 bg-white border border-pink-200 text-pink-500 font-bold text-sm px-4 py-2.5 rounded-full shadow-lg hover:shadow-xl active:scale-95 transition-all z-30"
      >
        💌 もらったいいね
        {unseenLikes > 0 && (
          <span className="bg-pink-500 text-white text-xs font-black w-5 h-5 rounded-full flex items-center justify-center">
            {unseenLikes > 9 ? "9+" : unseenLikes}
          </span>
        )}
      </button>

      {/* メッセージ一覧へのフローティングボタン */}
      <Link
        href="/matches"
        className="fixed bottom-24 right-4 flex items-center gap-2 bg-white border border-fuchsia-200 text-fuchsia-500 font-bold text-sm px-4 py-2.5 rounded-full shadow-lg hover:shadow-xl active:scale-95 transition-all z-30"
      >
        💬 メッセージ
        {unreadMessages > 0 && (
          <span className="bg-red-500 text-white text-xs font-black min-w-[20px] h-5 rounded-full flex items-center justify-center px-1">
            {unreadMessages > 99 ? "99+" : unreadMessages}
          </span>
        )}
      </Link>

      <BottomNav active="participants" unreadMessages={unreadMessages} />
    </main>
  );
}
