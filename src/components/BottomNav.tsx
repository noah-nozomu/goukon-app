"use client";

import Link from "next/link";

type Tab = "participants" | "matches";

export default function BottomNav({
  active,
  unreadMessages = 0,
}: {
  active: Tab;
  unreadMessages?: number;
}) {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 flex z-40">
      <Link
        href="/participants"
        className={`flex-1 flex flex-col items-center py-3 gap-0.5 text-xs font-bold transition-colors ${
          active === "participants" ? "text-pink-500" : "text-gray-400"
        }`}
      >
        <span className="text-xl">👤</span>
        <span>参加者</span>
      </Link>
      <Link
        href="/matches"
        className={`relative flex-1 flex flex-col items-center py-3 gap-0.5 text-xs font-bold transition-colors ${
          active === "matches" ? "text-pink-500" : "text-gray-400"
        }`}
      >
        <span className="relative inline-block text-xl">
          💕
          {unreadMessages > 0 && (
            <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-black min-w-[16px] h-4 rounded-full flex items-center justify-center px-0.5 leading-none">
              {unreadMessages > 99 ? "99+" : unreadMessages}
            </span>
          )}
        </span>
        <span>マッチング</span>
      </Link>
    </nav>
  );
}
