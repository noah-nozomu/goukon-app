"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import type { Match, Message, Participant } from "@/types";

export default function ChatPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const { user } = useAuth();
  const router = useRouter();

  const [partner, setPartner] = useState<Participant | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // マッチ確認 + 相手情報取得
  useEffect(() => {
    if (!user || !matchId) return;
    (async () => {
      const matchSnap = await getDoc(doc(db, "matches", matchId));
      if (!matchSnap.exists()) {
        router.push("/matches");
        return;
      }
      const match = matchSnap.data() as Match;
      if (!match.users.includes(user.uid)) {
        router.push("/matches");
        return;
      }
      const partnerUid = match.users.find((u) => u !== user.uid)!;
      const partnerSnap = await getDoc(doc(db, "participants", partnerUid));
      setPartner(partnerSnap.data() as Participant);
    })();
  }, [user, matchId, router]);

  // メッセージのリアルタイム購読
  useEffect(() => {
    if (!matchId) return;
    const q = query(
      collection(db, "messages", matchId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Message))
      );
    });
    return () => unsubscribe();
  }, [matchId]);

  // 新着メッセージで最下部にスクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !user || sending) return;
    setText("");
    setSending(true);
    try {
      await addDoc(collection(db, "messages", matchId, "messages"), {
        senderId: user.uid,
        text: trimmed,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "matches", matchId), {
        lastMessage: trimmed,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="flex flex-col h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="flex-shrink-0 bg-gradient-to-r from-fuchsia-500 to-pink-500 px-4 pt-12 pb-4 text-white flex items-center gap-3">
        <button
          onClick={() => router.push("/matches")}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors text-lg"
        >
          ←
        </button>
        {partner ? (
          <>
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/40 flex-shrink-0">
              <img
                src={partner.photoURL}
                alt={partner.nickname}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">{partner.nickname}さん</p>
              <p className="text-pink-100 text-xs">マッチング成立 💕</p>
            </div>
          </>
        ) : (
          <div className="h-10 w-32 bg-white/20 rounded-full animate-pulse" />
        )}
      </header>

      {/* メッセージ一覧 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-300 text-sm">
            <p className="text-4xl mb-3">👋</p>
            <p>最初のメッセージを送ってみよう！</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMine = msg.senderId === user?.uid;
          return (
            <div
              key={msg.id}
              className={`flex ${isMine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[72%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
                  isMine
                    ? "bg-gradient-to-br from-pink-500 to-rose-500 text-white rounded-br-sm shadow-sm"
                    : "bg-white text-gray-800 rounded-bl-sm shadow-sm border border-gray-100"
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* 入力エリア */}
      <div className="flex-shrink-0 bg-white border-t border-gray-100 px-4 py-3 flex items-center gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="メッセージを入力..."
          className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-300 transition-shadow"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white text-lg disabled:opacity-40 transition-opacity flex-shrink-0 shadow-md"
        >
          ↑
        </button>
      </div>
    </main>
  );
}
