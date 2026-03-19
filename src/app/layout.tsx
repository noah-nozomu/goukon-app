import type { Metadata } from "next";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";

export const metadata: Metadata = {
  title: "合コンマッチング 🎉",
  description: "その場限りのリアルタイムマッチング",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-gradient-to-br from-rose-50 via-pink-50 to-fuchsia-50 min-h-screen">
        <div className="max-w-md mx-auto min-h-screen bg-white shadow-2xl relative overflow-hidden">
          <ClientLayout>{children}</ClientLayout>
        </div>
      </body>
    </html>
  );
}