"use client";

import Link from "next/link";

export type SessionTab = "participants" | "minigame" | "dm";

const TABS: { id: SessionTab; href: string; label: string }[] = [
  { id: "participants", href: "/participants", label: "参加者一覧" },
  { id: "minigame", href: "/minigame", label: "ミニゲーム" },
  { id: "dm", href: "/matches", label: "DM" },
];

export default function SessionTabs({ active }: { active: SessionTab }) {
  return (
    <div className="bg-white border-b border-pink-100 px-4 py-3">
      <div className="grid grid-cols-3 gap-1 bg-pink-50 rounded-2xl p-1">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            className={`text-center text-xs sm:text-sm font-bold py-2.5 rounded-xl transition-colors ${
              active === tab.id ? "bg-white text-pink-500 shadow-sm" : "text-gray-400"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
