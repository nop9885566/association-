"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/app/dashboard-shell";
import PendingPaymentTracking from "@/app/pending-payment-tracking";

type Summary = {
  activeGuardians: number;
  activeStudents: number;
  membershipPaid: number;
  tuitionSemester1Paid: number;
  tuitionSemester2Paid: number;
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
          typeof result.activeGuardians !== "number" ||
          typeof result.activeStudents !== "number" ||
          typeof result.membershipPaid !== "number" ||
          typeof result.tuitionSemester1Paid !== "number" ||
          typeof result.tuitionSemester2Paid !== "number"
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

  const paymentCards = [
    { title: "ผู้ปกครองในทะเบียน", value: summary?.activeGuardians, description: "นับชื่อไม่ซ้ำภายในครอบครัว", icon: "♙", color: "blue" },
    { title: "ค่าสมัครสมาชิก ปี 2569", value: summary?.membershipPaid, description: `ชำระแล้ว จาก ${summary?.activeStudents ?? "—"} คน · ค้าง ${summary ? summary.activeStudents - summary.membershipPaid : "—"}`, icon: "✓", color: "amber" },
    { title: "ค่าบำรุง ภาคเรียน 1 ปี 2569", value: summary?.tuitionSemester1Paid, description: `ชำระแล้ว จาก ${summary?.activeStudents ?? "—"} คน · ค้าง ${summary ? summary.activeStudents - summary.tuitionSemester1Paid : "—"}`, icon: "✓", color: "amber" },
    { title: "ค่าบำรุง ภาคเรียน 2 ปี 2569", value: summary?.tuitionSemester2Paid, description: `ชำระแล้ว จาก ${summary?.activeStudents ?? "—"} คน · ค้าง ${summary ? summary.activeStudents - summary.tuitionSemester2Paid : "—"}`, icon: "✓", color: "amber" },
  ];

  return (
    <DashboardShell activePage="dashboard">
      <section className="dashboard-title">
        <p className="section-kicker">ASSOCIATION · PAYMENT OVERVIEW</p>
        <h1>ภาพรวมการชำระค่าบำรุง</h1>
      </section>

      {error && <div className="error-banner" role="alert">{error}</div>}

      <section className="summary-section dashboard-summary" aria-labelledby="academic-year-heading">
        <h2 id="academic-year-heading">สถานะสมาชิกและการชำระ · ปีการศึกษา 2569</h2>
        <div className="stats submission-stats" aria-label="สรุปสมาชิกและการชำระปีการศึกษา 2569">
          {paymentCards.map((card) => (
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
        <p className="dashboard-summary-note">
          นับยอดชำระเมื่อเจ้าหน้าที่อนุมัติหลักฐานแล้ว ·{" "}
          <a href="/fees">จัดการรายการค่าบำรุง</a>
        </p>
      </section>

      <PendingPaymentTracking />
    </DashboardShell>
  );
}
