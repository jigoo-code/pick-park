import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/navigation";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pick-Park - 주차권 추첨 앱",
  description: "모바일에서 간편하게 즐기는 주차권 추첨 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${inter.className} min-h-screen bg-background antialiased pb-16 md:pb-0 md:pt-16 pt-14`}>
        <Navigation />
        <main className="container mx-auto px-4 py-6 max-w-5xl">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
