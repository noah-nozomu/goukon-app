"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import BottomNav from "@/components/BottomNav";
import SessionTabs from "@/components/SessionTabs";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { rankTopThree } from "@/lib/minigame";
import type { MinigameCurrent, MinigameVote, Participant } from "@/types";

const RANK_LABEL = ["", "1位", "2位", "3位"];

export default function MinigamePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const unreadMessages = useUnreadMessages();
  const [current, setCurrent] = useState<MinigameCurrent | null>(null);
  const [currentReady, setCurrentReady] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [votes, setVotes] = useState<MinigameVote[]>([]);
  const [readError, setReadError] = useState(false);
  const [voteTarget, setVoteTarget] = useState<Participant | null>(null);
  const [sending, setSending] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "minigame", "current"),
      (snap) => {
        setCurrent(snap.exists() ? (snap.data() as MinigameCurrent) : null);
        setCurrentReady(true);
        setReadError(false);
      },
      (err) => {
        console.error("ミニゲーム状態の取得に失敗:", err);
        setReadError(true);
        setCurrentReady(true);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "participants"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setParticipants(snap.docs.map((d) => d.data() as Participant));
      },
      (err) => {
        console.error("参加者一覧の取得に失敗:", err);
      }
    );
    return () => unsubscribe();
  }, []);

  const themeId = current?.themeId ?? "";
  const status = current?.status ?? "waiting";

  useEffect(() => {
    if (!themeId || status === "waiting") {
      setVotes([]);
      return;
    }
    const q = query(collection(db, "minigame_votes"), where("themeId", "==", themeId));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setVotes(snap.docs.map((d) => d.data() as MinigameVote));
      },
      (err) => {
        console.error("ミニゲーム投票の取得に失敗:", err);
        setReadError(true);
      }
    );
    return () => unsubscribe();
  }, [themeId, status]);

  const others = participants.filter((p) => p.uid !== user?.uid);
  const myVote = votes.find((vote) => vote.voterId === user?.uid);
  const ranked = useMemo(() => {
    const counts = new Map<string, number>();
    for (const vote of votes) {
      counts.set(vote.targetId, (counts.get(vote.targetId) ?? 0) + 1);
    }
    return rankTopThree(counts);
  }, [votes]);

  const participantById = useMemo(() => {
    const map = new Map<string, Participant>();
    for (const participant of participants) map.set(participant.uid, participant);
    return map;
  }, [participants]);

  const submitVote = async () => {
    if (!user || !voteTarget || !themeId || status !== "voting" || myVote || sending) return;
    setSending(true);
    setVoteError(null);
    try {
      await setDoc(doc(db, "minigame_votes", `${themeId}_${user.uid}`), {
        themeId,
        voterId: user.uid,
        targetId: voteTarget.uid,
        createdAt: serverTimestamp(),
      });
      setVoteTarget(null);
    } catch (err) {
      console.error("ミニゲーム投票に失敗:", err);
      const code = (err as { code?: string } | null)?.code ?? "";
      setVoteError(
        code === "permission-denied"
          ? "投票できませんでした。締め切られたか、すでに投票済みです。"
          : "投票に失敗しました。もう一度お試しください。"
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="min-h-screen pb-24">
      <header className="bg-gradient-to-r from-pink-500 to-rose-500 px-6 pt-12 pb-6 text-white">
        <button
          onClick={() => router.replace("/participants")}
          className="mb-3 flex items-center gap-1 text-pink-100 text-sm hover:text-white transition-colors"
        >
          ← 戻る
        </button>
        <h1 className="text-2xl font-black">なんでもランキング</h1>
        <p className="text-pink-100 text-sm mt-1">テーマにいちばん近い人を1人だけ選ぶ</p>
      </header>

      <SessionTabs active="minigame" />

      <div className="p-4">
        {authLoading || !currentReady ? (
          <div className="flex justify-center items-center h-48">
            <div className="w-8 h-8 border-4 border-pink-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : readError ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">⚠️</p>
            <p className="font-bold">ミニゲームを表示できません</p>
            <p className="text-sm mt-1">通信状況を確認して、開き直してください</p>
          </div>
        ) : status === "voting" && current?.themeText ? (
          <VotingView
            themeText={current.themeText}
            others={others}
            voted={Boolean(myVote)}
            onSelect={setVoteTarget}
          />
        ) : status === "result" && current?.themeText ? (
          <ResultView
            themeText={current.themeText}
            ranked={ranked}
            participantById={participantById}
            totalVotes={votes.length}
          />
        ) : (
          <div className="text-center py-20 text-gray-400">
            <p className="text-5xl mb-3">⏳</p>
            <p className="font-bold text-gray-600">ゲーム開始待ち中...</p>
            <p className="text-sm mt-2">幹事がテーマを出したら、この画面が切り替わります</p>
          </div>
        )}
      </div>

      {voteTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center px-4 pb-6">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-xl">
            <p className="text-center text-sm text-gray-400">この人に投票しますか？</p>
            <p className="text-center font-black text-xl text-gray-800 mt-2">{voteTarget.nickname}</p>
            <p className="text-center text-xs text-gray-400 mt-2">投票すると変更できません</p>
            {voteError && <p className="text-center text-red-500 text-sm mt-3">{voteError}</p>}
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => {
                  setVoteTarget(null);
                  setVoteError(null);
                }}
                disabled={sending}
                className="flex-1 py-3 border-2 border-gray-200 text-gray-500 font-bold rounded-2xl"
              >
                キャンセル
              </button>
              <button
                onClick={submitVote}
                disabled={sending}
                className="flex-1 py-3 bg-pink-500 text-white font-bold rounded-2xl disabled:opacity-40"
              >
                {sending ? "送信中..." : "投票する"}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav active="participants" unreadMessages={unreadMessages} />
    </main>
  );
}

function VotingView({
  themeText,
  others,
  voted,
  onSelect,
}: {
  themeText: string;
  others: Participant[];
  voted: boolean;
  onSelect: (participant: Participant) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-pink-50 border border-pink-100 rounded-3xl px-5 py-6 text-center">
        <p className="text-xs font-bold text-pink-400 tracking-widest">THEME</p>
        <p className="text-xl font-black text-gray-800 mt-2 leading-snug">{themeText}</p>
      </div>
      {voted && (
        <div className="bg-white border border-pink-200 text-pink-500 font-black text-center py-3 rounded-2xl">
          投票済み ✅
        </div>
      )}
      {others.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>投票できる相手がいません</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {others.map((participant) => (
            <button
              key={participant.uid}
              type="button"
              disabled={voted}
              onClick={() => onSelect(participant)}
              className="rounded-3xl overflow-hidden shadow-md bg-white border border-gray-100 text-left disabled:opacity-70"
            >
              <div className="aspect-square bg-gray-200">
                {participant.photoURL ? (
                  <img
                    src={participant.photoURL}
                    alt={participant.nickname}
                    className="w-full h-full object-cover"
                  />
                ) : null}
              </div>
              <p className="px-3 py-3 font-bold text-gray-700 text-sm truncate">{participant.nickname}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ResultView({
  themeText,
  ranked,
  participantById,
  totalVotes,
}: {
  themeText: string;
  ranked: { uid: string; votes: number; rank: number }[];
  participantById: Map<string, Participant>;
  totalVotes: number;
}) {
  const groups = [1, 2, 3]
    .map((rank) => ranked.filter((entry) => entry.rank === rank))
    .filter((group) => group.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-pink-50 border border-pink-100 rounded-3xl px-5 py-6 text-center">
        <p className="text-xs font-bold text-pink-400 tracking-widest">RESULT</p>
        <p className="text-xl font-black text-gray-800 mt-2 leading-snug">{themeText}</p>
        <p className="text-xs text-gray-400 mt-2">{totalVotes}票</p>
      </div>
      {groups.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="font-bold">投票はありませんでした</p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group[0].rank} className="flex flex-col gap-2">
            <p className="font-black text-pink-500">{RANK_LABEL[group[0].rank]}</p>
            {group.map((entry) => {
              const participant = participantById.get(entry.uid);
              return (
                <div
                  key={entry.uid}
                  className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-3 shadow-sm"
                >
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                    {participant?.photoURL ? (
                      <img
                        src={participant.photoURL}
                        alt={participant.nickname}
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 truncate">
                      {participant?.nickname ?? "退室した参加者"}
                    </p>
                  </div>
                  <p className="font-black text-pink-500">{entry.votes}票</p>
                </div>
              );
            })}
          </section>
        ))
      )}
    </div>
  );
}
