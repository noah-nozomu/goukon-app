"use client";

import { useEffect, useState } from "react";
import {
  signInAnonymously,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  User,
  Unsubscribe,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: Unsubscribe | undefined;

    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
          if (currentUser) {
            setUser(currentUser);
          } else {
            try {
              const result = await signInAnonymously(auth);
              setUser(result.user);
            } catch (error) {
              console.error("匿名ログイン失敗:", error);
            }
          }
          setLoading(false);
        });
      })
      .catch((error) => {
        console.error("Persistence設定失敗:", error);
        setLoading(false);
      });

    return () => unsubscribe?.();
  }, []);

  return { user, loading };
}
