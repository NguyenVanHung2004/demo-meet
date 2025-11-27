import type { Metadata } from "next";
import { Geist, Geist_Mono,Inter } from "next/font/google";
import "./globals.css";

// [QUAN TRỌNG] Thêm "vietnamese" vào đây
const inter = Inter({ subsets: ["latin", "vietnamese"] });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Meeting Notes",
  description: "Ghi biên bản và tóm tắt cuộc họp",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body
        suppressHydrationWarning={true}
        className={inter.className}
      >
        {children}
      </body>
    </html>
  );
}
