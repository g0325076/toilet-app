import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/app/components/ui/sonner";
import AlertNotifier from "@/app/components/AlertNotifier";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "トイレの神様",
  description: "施設トイレ在庫・状態管理システム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        {/* 通知ロジックコンポーネント（UIなし） */}
        <AlertNotifier />
        
        {/* メインコンテンツ */}
        {children}
        
        {/* トースト通知用コンポーネント */}
        <Toaster />
      </body>
    </html>
  );
}