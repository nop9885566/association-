"use client";

import { useEffect, useState } from "react";

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

type SignedInCaretaker = {
  id: string;
  name: string;
};

type FeeRecord = {
  submissionId: string;
  studentItemId: string;
  studentId: string | null;
  guardianName: string | null;
  submittedAmount: string;
  paymentDatetime: string;
  status: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export default function Home() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [caretaker, setCaretaker] = useState<SignedInCaretaker | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [records, setRecords] = useState<FeeRecord[]>([]);
  const [recordsPage, setRecordsPage] = useState(1);
  const [recordsHasMore, setRecordsHasMore] = useState(false);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        const result: unknown = await response.json();
        if (response.status === 401) {
          window.location.replace("/login");
          return null;
        }
        if (!response.ok) {
          const message = isRecord(result) && typeof result.error === "string"
            ? result.error
            : "ตรวจสอบสถานะเข้าสู่ระบบไม่สำเร็จ";
          throw new Error(message);
        }
        if (!isRecord(result) || typeof result.id !== "string" || typeof result.name !== "string") {
          throw new Error("ข้อมูลผู้ดูแลที่ได้รับไม่ถูกต้อง");
        }
        return { id: result.id, name: result.name };
      })
      .then((result) => {
        if (active && result) {
          setCaretaker(result);
          setAuthChecked(true);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "ตรวจสอบสถานะเข้าสู่ระบบไม่สำเร็จ");
          setAuthChecked(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!caretaker) return;
    let active = true;
    fetch("/api/fees")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "โหลดข้อมูลไม่สำเร็จ");
        return result as Summary;
      })
      .then((result) => {
        if (active) setSummary(result);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "เกิดข้อผิดพลาดในการโหลดข้อมูล");
      });

    return () => {
      active = false;
    };
  }, [caretaker]);

  useEffect(() => {
    if (!caretaker) return;
    let active = true;
    setRecordsLoading(true);
    setRecordsError("");

    fetch(`/api/fees/records?page=${recordsPage}`, { cache: "no-store" })
    .then(async (response) => {
      const result: unknown = await response.json();
      if (response.status === 401) {
        window.location.replace("/login");
        return null;
      }
      if (!response.ok) {
        const message = isRecord(result) && typeof result.error === "string"
          ? result.error
          : "โหลดรายการชำระไม่สำเร็จ";
        throw new Error(message);
      }
      if (
        !isRecord(result) ||
        !Array.isArray(result.records) ||
        typeof result.hasMore !== "boolean" ||
        result.records.some(
          (row) =>
            !isRecord(row) ||
            typeof row.submissionId !== "string" ||
            typeof row.studentItemId !== "string" ||
            (row.studentId !== null && typeof row.studentId !== "string") ||
            (row.guardianName !== null && typeof row.guardianName !== "string") ||
            typeof row.submittedAmount !== "string" ||
            typeof row.paymentDatetime !== "string" ||
            typeof row.status !== "string"
        )
      ) {
        throw new Error("รูปแบบรายการชำระไม่ถูกต้อง");
      }
      return result as { records: FeeRecord[]; hasMore: boolean };
    })
    .then((result) => {
      if (active && result) {
        setRecords(result.records);
        setRecordsHasMore(result.hasMore);
      }
    })
    .catch((reason: unknown) => {
      if (active) {
        setRecordsError(reason instanceof Error ? reason.message : "เกิดข้อผิดพลาดในการโหลดรายการ");
      }
    })
    .finally(() => {
      if (active) setRecordsLoading(false);
    });

    return () => {
    active = false;
    };
  }, [caretaker, recordsPage]);

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

  if (!authChecked) {
    return (
      <main className="shell auth-loading" role="status">
        <p>กำลังตรวจสอบการเข้าสู่ระบบ...</p>
      </main>
    );
  }

  if (!caretaker) {
    return (
      <main className="shell">
        <div className="error-banner" role="alert">{error || "ไม่สามารถตรวจสอบการเข้าสู่ระบบได้"}</div>
        <a className="login-link" href="/login">กลับไปหน้าเข้าสู่ระบบ</a>
      </main>
    );
  }

  const statusLabels: Record<string, string> = {
    waiting_for_review: "รอตรวจสอบ",
    approved: "อนุมัติแล้ว",
    rejected: "ไม่อนุมัติ",
    pending: "ยังไม่ชำระ",
    submitted: "ส่งหลักฐานแล้ว",
  };
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">ส</span><span>สมาคม<span className="brand-caption">ระบบข้อมูลสมาชิก</span></span></div>
        <div className="topbar-actions">
          <span className="signed-in">ผู้ดูแล: {caretaker.name}</span>
          <button
            className="logout-button"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.replace("/login");
            }}
          >
            ออกจากระบบ
          </button>
        </div>
      </header>

      <section className="intro">
        <p className="eyebrow">ASSOCIATION · PUBLIC OVERVIEW</p>
        <h1>ภาพรวมค่าบำรุงสมาชิก</h1>
        <p className="intro-copy">สรุปรายการค่าบำรุงและสถานะตรวจสอบหลักฐาน</p>
      </section>

      {error && <div className="error-banner" role="alert">{error}</div>}

      <section className="summary-section" aria-labelledby="fees-heading">
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

      <section className="records-section" aria-labelledby="records-heading">
        <div className="records-heading">
          <div>
            <h2 id="records-heading">เปรียบเทียบผู้ปกครองกับรายการนักเรียน</h2>
            <p>แสดงชื่อผู้ส่งหลักฐานคู่กับ student_id ของรายการนักเรียน</p>
          </div>
          <span className="records-page">หน้า {recordsPage}</span>
        </div>

        {recordsError && <div className="error-banner" role="alert">{recordsError}</div>}
        <div className="records-table-wrap">
          <table className="records-table">
            <thead>
              <tr>
                <th>ชื่อผู้ปกครอง/ผู้ส่ง</th>
                <th>student_id (นักเรียน)</th>
                <th>จำนวนเงิน</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {recordsLoading ? (
                <tr><td colSpan={4} className="records-empty">กำลังโหลดรายการ...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={4} className="records-empty">ไม่พบรายการในหน้านี้</td></tr>
              ) : records.map((record) => (
                <tr key={record.submissionId}>
                  <td>{record.guardianName || "—"}</td>
                  <td>
                    <span className="student-id">{record.studentId || "—"}</span>
                    <small className="record-reference">รายการ {record.studentItemId}</small>
                  </td>
                  <td>{Number(record.submittedAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                  <td>{statusLabels[record.status] || record.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="records-pagination">
          <button type="button" onClick={() => setRecordsPage((page) => page - 1)} disabled={recordsPage <= 1 || recordsLoading}>
            ก่อนหน้า
          </button>
          <button type="button" onClick={() => setRecordsPage((page) => page + 1)} disabled={!recordsHasMore || recordsLoading}>
            ถัดไป
          </button>
        </div>
      </section>

      <section className="privacy-card">
        <div className="privacy-icon">i</div>
        <div>
          <h2>การแสดงข้อมูลรายบุคคล</h2>
          <p>แสดงเฉพาะชื่อผู้ส่งหลักฐานและ student_id เพื่อเทียบรายการ ไม่แสดงรหัสนักศึกษาจากแหล่งอื่นหรือหลักฐานการโอน</p>
        </div>
      </section>

      <footer>แสดงเฉพาะข้อมูลสรุปจากระบบค่าบำรุงสมาคม <span>·</span> ระบบสำหรับดูข้อมูลเท่านั้น</footer>
    </main>
  );
}
