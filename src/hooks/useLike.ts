"use client";

import { useState, useEffect } from "react";
import {
  doc,
  setDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./useAuth";
import { generateLikeId } from "@/lib/utils";

export function useLike() {
  const { user } = useAuth();
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "likes"), where("from", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMyLikes(new Set(snapshot.docs.map((d) => d.data().to as string)));
    });
    return () => unsubscribe();
  }, [user]);

  const sendLike = async (toUid: string) => {
    if (!user) return;
    await setDoc(doc(db, "likes", generateLikeId(user.uid, toUid)), {
      from: user.uid,
      to: toUid,
      createdAt: serverTimestamp(),
    });
  };

  return { myLikes, sendLike };
}
