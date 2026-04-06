"use client";

import { useRouter } from "next/navigation";
import ProfileForm from "@/components/profile/ProfileForm";

export default function ProfileEditPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen flex flex-col">
      <header className="relative overflow-hidden bg-gradient-to-br from-pink-500 via-rose-400 to-fuchsia-500 pt-14 pb-10 px-6 text-white">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-white/10" />
        <div className="relative z-10">
          <button
            onClick={() => router.replace("/participants")}
            className="mb-4 flex items-center gap-1 text-pink-100 text-sm hover:text-white transition-colors"
          >
            ← 戻る
          </button>
          <h1 className="text-3xl font-black leading-tight">プロフィール編集</h1>
          <p className="text-pink-100 text-sm mt-3">あとから何度でも更新できます</p>
        </div>
      </header>

      <div className="flex-1 px-6 py-8">
        <ProfileForm />
      </div>
    </main>
  );
}
