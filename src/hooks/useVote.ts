"use client";

import { useState, useEffect } from "react";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./useAuth";
import { generateMatchId } from "@/lib/utils";

export function useVote(voteLimit: number) {
  const { user } = useAuth();
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "votes"), where("from", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMyVotes(new Set(snapshot.docs.map((d) => d.data().to as string)));
    });
    return () => unsubscribe();
  }, [user]);

  const sendVote = async (
    toUid: string
  ): Promise<{ matched: boolean; matchId?: string }> => {
    if (!user) return { matched: false };
    if (myVotes.size >= voteLimit) return { matched: false };

    await setDoc(doc(db, "votes", `${user.uid}_${toUid}`), {
      from: user.uid,
      to: toUid,
      createdAt: serverTimestamp(),
    });

    // 相手も自分に投票済みか確認
    const reverseSnap = await getDoc(doc(db, "votes", `${toUid}_${user.uid}`));
    if (reverseSnap.exists()) {
      const matchId = generateMatchId(user.uid, toUid);
      await setDoc(doc(db, "matches", matchId), {
        users: [user.uid, toUid].sort(),
        createdAt: serverTimestamp(),
      });
      return { matched: true, matchId };
    }

    return { matched: false };
  };

  return { myVotes, sendVote };
}
