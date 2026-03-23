"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./useAuth";

export function useUnreadMessages(): number {
  const { user } = useAuth();
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "matches"),
      where("users", "array-contains", user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let total = 0;
      snapshot.docs.forEach((d) => {
        const data = d.data();
        const unreadCount = data.unreadCount as Record<string, number> | undefined;
        if (unreadCount?.[user.uid]) {
          total += unreadCount[user.uid];
        }
      });
      setTotalUnread(total);
    });
    return () => unsubscribe();
  }, [user]);

  return totalUnread;
}
