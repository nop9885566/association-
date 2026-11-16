import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "สมาคม | ภาพรวมค่าบำรุง",
  description: "ระบบแสดงข้อมูลรายการค่าบำรุงสมาคม",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
