"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import PhotoUpload from "./PhotoUpload";
import type { Participant } from "@/types";

export default function ProfileForm() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [nickname, setNickname] = useState<string>("");
  const [photoURL, setPhotoURL] = useState<string>("");
  const [bio, setBio] = useState<string>("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getDoc(doc(db, "participants", user.uid))
      .then((snap) => {
        if (!snap.exists() || cancelled) return;
        const data = snap.data() as Partial<Participant>;
        setNickname(data.nickname ?? "");
        setPhotoURL(data.photoURL ?? "");
        setBio(data.bio ?? "");
        setHasProfile(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleSubmit = async () => {
    if (!user) return;
    if (!photoURL) {
      setError("写真を登録してください");
      return;
    }
    if (!nickname.trim()) {
      setError("呼び名を入力してください");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const ref = doc(db, "participants", user.uid);
      const existing = await getDoc(ref);
      if (existing.exists()) {
        // 既存ユーザーはプロフィールを更新（createdAt も更新して画像キャッシュを無効化）
        await updateDoc(ref, {
          nickname: nickname.trim(),
          photoURL,
          bio: bio.trim(),
          createdAt: serverTimestamp(),
        });
      } else {
        await setDoc(ref, {
          uid: user.uid,
          nickname: nickname.trim(),
          photoURL,
          bio: bio.trim(),
          createdAt: serverTimestamp(),
        });
      }
      router.push("/participants");
    } catch (err) {
      console.error("登録失敗:", err);
      setError("登録に失敗しました。もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  };

  if (loading || loadingProfile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-pink-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col items-center gap-2">
        <h2 className="text-sm font-semibold text-gray-500 tracking-widest uppercase">Photo</h2>
        {user && (
          <PhotoUpload
            userId={user.uid}
            onUploadComplete={(url) => {
              setPhotoURL(url);
              setError(null);
            }}
          />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-500 tracking-widest uppercase">呼び名</h2>
        <input
          type="text"
          value={nickname}
          onChange={(e) => { setNickname(e.target.value); setError(null); }}
          placeholder="例：たろう、はなちゃん"
          maxLength={20}
          className="w-full py-3 px-4 border-2 border-gray-200 rounded-2xl text-base font-bold text-black outline-none focus:border-pink-400 transition-colors"
        />
        <p className="text-xs text-gray-400">参加者一覧に表示される名前です（最大20文字）</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-500 tracking-widest uppercase">詳細プロフィール</h2>
        <textarea
          value={bio}
          onChange={(e) => { setBio(e.target.value); setError(null); }}
          placeholder="例：映画好きです。週末はカフェ巡りしています。"
          maxLength={200}
          rows={5}
          className="w-full py-3 px-4 border-2 border-gray-200 rounded-2xl text-sm text-black outline-none focus:border-pink-400 transition-colors resize-none"
        />
        <p className="text-xs text-gray-400 text-right">{bio.length}/200</p>
      </section>

      {error && (
        <p className="text-center text-red-500 text-sm bg-red-50 py-2 rounded-xl">{error}</p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={saving}
        className="w-full py-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-black text-lg rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? "保存中..." : hasProfile ? "💾 プロフィールを更新" : "🎉 参加する！"}
      </button>
    </div>
  );
}
