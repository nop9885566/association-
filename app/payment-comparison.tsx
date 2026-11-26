"use client";

import { useEffect, useState } from "react";

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

export default function PaymentComparison({ studentId = "" }: { studentId?: string }) {
  const [records, setRecords] = useState<FeeRecord[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    const query = new URLSearchParams({ page: String(page) });
    if (studentId) query.set("studentId", studentId);
    fetch(`/api/fees/records?${query.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        const result: unknown = await response.json();
        if (response.status === 401) {
          window.location.replace("/login");
          return null;
        }
        if (!response.ok) {
          throw new Error(
            isRecord(result) && typeof result.error === "string"
              ? result.error
              : "โหลดรายการชำระไม่สำเร็จ",
          );
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
              typeof row.status !== "string",
          )
        ) {
          throw new Error("รูปแบบรายการชำระไม่ถูกต้อง");
        }
        return result as { records: FeeRecord[]; hasMore: boolean };
      })
      .then((result) => {
        if (active && result) {
          setRecords(result.records);
          setHasMore(result.hasMore);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "เกิดข้อผิดพลาดในการโหลดรายการ");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, studentId]);

  const statusLabels: Record<string, string> = {
    waiting_for_review: "รอตรวจสอบ",
    approved: "อนุมัติแล้ว",
    rejected: "ไม่อนุมัติ",
    pending: "ยังไม่ชำระ",
    submitted: "ส่งหลักฐานแล้ว",
  };

  return (
    <>
      <section className="intro page-hero">
        <p className="eyebrow">PAYMENT RECORDS</p>
        <h1>เปรียบเทียบผู้ปกครองกับนักเรียน</h1>
        <p className="intro-copy">
          {studentId
            ? `ตรวจสอบรายการส่งหลักฐานของนักเรียนรหัส ${studentId}`
            : "ตรวจสอบชื่อผู้ส่งหลักฐานคู่กับรหัสนักเรียนในรายการค่าบำรุง"}
        </p>
      </section>

      <section className="records-section records-page-section" aria-labelledby="records-heading">
        <div className="records-heading">
          <div>
            <h2 id="records-heading">ประวัติการส่งหลักฐานล่าสุด</h2>
            <p>แสดงรายการล่าสุดของแต่ละรายการค่าบำรุง</p>
          </div>
          <span className="records-page">หน้า {page}</span>
        </div>

        {error && <div className="error-banner" role="alert">{error}</div>}
        <div className="records-table-wrap">
          <table className="records-table comparison-table">
            <thead>
              <tr>
                <th>ผู้ปกครอง/ผู้ส่ง</th>
                <th>รหัสนักเรียน</th>
                <th>จำนวนเงิน</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
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
                  <td>
                    <span className={`payment-status status-${record.status}`}>
                      {statusLabels[record.status] || record.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="records-pagination">
          <button type="button" onClick={() => setPage((current) => current - 1)} disabled={page <= 1 || loading}>
            ก่อนหน้า
          </button>
          <button type="button" onClick={() => setPage((current) => current + 1)} disabled={!hasMore || loading}>
            ถัดไป
          </button>
        </div>
      </section>
    </>
  );
}
