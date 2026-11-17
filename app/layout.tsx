import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "สมาคม | จัดการข้อมูลสมาชิก",
  description: "ระบบจัดการทะเบียนสมาชิก รายการค่าบำรุง และประวัติการชำระสมาคม",
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
