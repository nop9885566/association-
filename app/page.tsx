"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/app/dashboard-shell";
import MemberDirectory from "@/app/member-directory";

type Summary = {
  feeTotal: number;
  feePending: number;
  feeSubmitted: number;
  submissionTotal: number;
  submissionLatest: number;
  submissionWaiting: number;
  submissionApproved: number;
  submissionRejected: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export default function Home() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/fees", { cache: "no-store" })
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok) {
          throw new Error(
            isRecord(result) && typeof result.error === "string"
              ? result.error
              : "โหลดข้อมูลสรุปไม่สำเร็จ",
          );
        }
        if (
          !isRecord(result) ||
          typeof result.feeTotal !== "number" ||
          typeof result.feePending !== "number" ||
          typeof result.feeSubmitted !== "number" ||
          typeof result.submissionTotal !== "number" ||
          typeof result.submissionLatest !== "number" ||
          typeof result.submissionWaiting !== "number" ||
          typeof result.submissionApproved !== "number" ||
          typeof result.submissionRejected !== "number"
        ) {
          throw new Error("รูปแบบข้อมูลสรุปไม่ถูกต้อง");
        }
        return result as Summary;
      })
      .then((result) => {
        if (active) setSummary(result);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "โหลดข้อมูลสรุปไม่สำเร็จ");
      });

    return () => {
      active = false;
    };
  }, []);

  const feeCards = [
    { title: "รายการทั้งหมด", value: summary?.feeTotal, description: "รายการค่าบำรุง", icon: "▤", color: "blue" },
    { title: "ส่งหลักฐานแล้ว", value: summary?.feeSubmitted, description: "มีการส่งหลักฐานแล้ว", icon: "◷", color: "amber" },
    { title: "ยังไม่ชำระ", value: summary?.feePending, description: "รายการค้างชำระ", icon: "✓", color: "green" },
  ];
  const submissionCards = [
    { title: "หลักฐานทั้งหมด", value: summary?.submissionTotal, description: "รวมประวัติการส่งซ้ำ", icon: "▤", color: "blue" },
    { title: "รายการล่าสุด", value: summary?.submissionLatest, description: "ไม่นับรายการส่งซ้ำเก่า", icon: "◉", color: "green" },
    { title: "รอตรวจสอบ", value: summary?.submissionWaiting, description: "รอเจ้าหน้าที่ตรวจสอบ", icon: "◷", color: "amber" },
    { title: "อนุมัติแล้ว", value: summary?.submissionApproved, description: "ยืนยันการชำระแล้ว", icon: "✓", color: "green" },
    { title: "ไม่อนุมัติ", value: summary?.submissionRejected, description: "หลักฐานไม่ผ่านการตรวจ", icon: "!", color: "red" },
  ];

  return (
    <DashboardShell activePage="members">
      <section className="intro hero">
        <div>
          <p className="eyebrow">ASSOCIATION · MEMBER DIRECTORY</p>
          <h1>ทะเบียนสมาชิก</h1>
          <p className="intro-copy">จัดการข้อมูลสมาชิกและค้นหาจากชื่อนักเรียน ผู้ปกครอง หรือรหัสนักเรียน</p>
        </div>
        <div className="hero-status"><span /> พื้นที่ผู้ดูแลระบบ</div>
      </section>

      {error && <div className="error-banner" role="alert">{error}</div>}

      <section id="overview" className="summary-section overview-section" aria-labelledby="fees-heading">
        <h2 id="fees-heading">ค่าบำรุงสมาชิก</h2>
        <div className="stats" aria-label="สรุปค่าบำรุง">
          {feeCards.map((card) => (
            <article className="stat-card" key={card.title}>
              <div className={`stat-icon ${card.color}`}>{card.icon}</div>
              <div>
                <p>{card.title}</p>
                <strong>{summary ? card.value?.toLocaleString("th-TH") : "—"}</strong>
                <span>{card.description}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="summary-section" aria-labelledby="submissions-heading">
        <h2 id="submissions-heading">รายการหลักฐานการชำระ</h2>
        <div className="stats submission-stats" aria-label="สรุปหลักฐานการชำระ">
          {submissionCards.map((card) => (
            <article className="stat-card" key={card.title}>
              <div className={`stat-icon ${card.color}`}>{card.icon}</div>
              <div>
                <p>{card.title}</p>
                <strong>{summary ? card.value?.toLocaleString("th-TH") : "—"}</strong>
                <span>{card.description}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <MemberDirectory />
    </DashboardShell>
  );
}
