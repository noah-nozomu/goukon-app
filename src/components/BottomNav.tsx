"use client";

import Link from "next/link";

type Tab = "participants" | "matches";

export default function BottomNav({ active }: { active: Tab }) {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 flex z-40">
      <Link
        href="/participants"
        className={`flex-1 flex flex-col items-center py-3 gap-0.5 text-xs font-bold transition-colors ${
          active === "participants" ? "text-pink-500" : "text-gray-400"
        }`}
      >
        <span className="text-xl">👀</span>
        <span>参加者</span>
      </Link>
      <Link
        href="/matches"
        className={`flex-1 flex flex-col items-center py-3 gap-0.5 text-xs font-bold transition-colors ${
          active === "matches" ? "text-pink-500" : "text-gray-400"
        }`}
      >
        <span className="text-xl">💕</span>
        <span>マッチング</span>
      </Link>
    </nav>
  );
}
