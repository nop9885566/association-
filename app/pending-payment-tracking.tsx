"use client";

import { useEffect, useState } from "react";
import { associationClassroomOptions } from "@/lib/association-members";
import {
  getPaymentStatus,
  paymentStatusLabels,
  type PaymentTrackingRow,
} from "@/lib/payment-tracking";

const pageSize = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPaymentTrackingRow(value: unknown): value is PaymentTrackingRow {
  if (!isRecord(value)) return false;
  const amounts = [
    value.membershipTotal,
    value.membershipPaid,
    value.semester1Total,
    value.semester1Paid,
    value.semester2Total,
    value.semester2Paid,
  ];
  const counts = [
    value.membershipItemCount,
    value.semester1ItemCount,
    value.semester2ItemCount,
  ];
  const flags = [
    value.membershipWaiting,
    value.membershipRejected,
    value.semester1Waiting,
    value.semester1Rejected,
    value.semester2Waiting,
    value.semester2Rejected,
  ];
  return (
    typeof value.studentId === "string" &&
    typeof value.childName === "string" &&
    typeof value.classroom === "string" &&
    typeof value.guardianNames === "string" &&
    amounts.every((amount) => typeof amount === "number" && Number.isFinite(amount) && amount >= 0) &&
    counts.every((count) => typeof count === "number" && Number.isSafeInteger(count) && count >= 0) &&
    flags.every((flag) => typeof flag === "boolean")
  );
}

function formatAmount(amount: number): string {
  return amount.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function getOutstandingFees(student: PaymentTrackingRow) {
  return [
    {
      label: "ค่าสมัครสมาชิก",
      total: student.membershipTotal,
      paid: student.membershipPaid,
      count: student.membershipItemCount,
      waiting: student.membershipWaiting,
    },
    {
      label: "ค่าบำรุง ภาคเรียน 1",
      total: student.semester1Total,
      paid: student.semester1Paid,
      count: student.semester1ItemCount,
      waiting: student.semester1Waiting,
    },
    {
      label: "ค่าบำรุง ภาคเรียน 2",
      total: student.semester2Total,
      paid: student.semester2Paid,
      count: student.semester2ItemCount,
      waiting: student.semester2Waiting,
    },
  ]
    .filter((fee) => fee.count > 0 && fee.paid < fee.total)
    .map((fee) => ({
      ...fee,
      outstanding: Math.max(0, fee.total - fee.paid),
    }));
}

function createReminderMessage(student: PaymentTrackingRow): string {
  const feeLines = getOutstandingFees(student).map((fee) =>
    fee.waiting
      ? `- ${fee.label}: ส่งหลักฐานแล้ว รอตรวจสอบ`
      : `- ${fee.label}: คงเหลือ ${formatAmount(fee.outstanding)} บาท`,
  );
  return [
    `เรียน ${student.guardianNames || "ผู้ปกครอง"}`,
    `ขอแจ้งสถานะค่าบำรุงของ ${student.childName} (รหัส ${student.studentId}${student.classroom ? ` ห้อง ${student.classroom}` : ""})`,
    ...feeLines,
    "หากชำระแล้วหรือส่งหลักฐานแล้ว สามารถละเว้นข้อความนี้ได้",
  ].join("\n");
}

function PaymentCell({
  total,
  paid,
  count,
  waiting,
  rejected,
}: {
  total: number;
  paid: number;
  count: number;
  waiting: boolean;
  rejected: boolean;
}) {
  const status = getPaymentStatus(count, paid, total, waiting, rejected);
  return (
    <td>
      <strong className="tracking-amount">{count === 0 ? "—" : `${formatAmount(total)} บาท`}</strong>
      {count > 0 && paid > 0 && paid < total && (
        <small className="tracking-paid-amount">อนุมัติแล้ว {formatAmount(paid)} บาท</small>
      )}
      <span className={`tracking-status tracking-status-${status}`}>{paymentStatusLabels[status]}</span>
    </td>
  );
}

export default function PendingPaymentTracking() {
  const [students, setStudents] = useState<PaymentTrackingRow[]>([]);
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [classroom, setClassroom] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  const allVisibleSelected =
    students.length > 0 && students.every((student) => selectedStudentIds.has(student.studentId));
  const selectedStudents = students.filter((student) => selectedStudentIds.has(student.studentId));

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchText.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchText]);

  useEffect(() => {
    setSelectedStudentIds(new Set());
    setActionMessage("");
  }, [classroom, page, search]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    const query = new URLSearchParams({ page: String(page) });
    if (search) query.set("q", search);
    if (classroom) query.set("classroom", classroom);

    fetch(`/api/fees/tracking?${query.toString()}`, { cache: "no-store" })
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
              : "โหลดรายงานติดตามค่าบำรุงไม่สำเร็จ",
          );
        }
        if (!isRecord(result) || !Array.isArray(result.students) || typeof result.hasMore !== "boolean") {
          throw new Error("รูปแบบรายงานติดตามค่าบำรุงไม่ถูกต้อง");
        }
        const students: PaymentTrackingRow[] = [];
        for (const row of result.students) {
          if (!isPaymentTrackingRow(row)) {
            throw new Error("รูปแบบรายงานติดตามค่าบำรุงไม่ถูกต้อง");
          }
          students.push(row);
        }
        return {
          students,
          hasMore: result.hasMore,
        };
      })
      .then((result) => {
        if (!active || !result) return;
        setStudents(result.students);
        setHasMore(result.hasMore);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "โหลดรายงานติดตามค่าบำรุงไม่สำเร็จ");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [classroom, page, search]);

  const exportQuery = new URLSearchParams({ export: "csv" });
  if (search) exportQuery.set("q", search);
  if (classroom) exportQuery.set("classroom", classroom);

  async function copyReminderMessages(targetStudents: PaymentTrackingRow[]) {
    const messages = targetStudents
      .filter((student) => getOutstandingFees(student).length > 0)
      .map(createReminderMessage);
    if (messages.length === 0) {
      setActionMessage("ไม่มีรายการค้างชำระที่ต้องแจ้งเตือน");
      return;
    }

    try {
      await navigator.clipboard.writeText(messages.join("\n\n"));
      setActionMessage(`คัดลอกข้อความแจ้งเตือน ${messages.length} รายการแล้ว นำไปส่งผ่านช่องทางที่ใช้งานได้เลย`);
    } catch {
      setActionMessage("คัดลอกข้อความไม่ได้ กรุณาอนุญาตการใช้ clipboard แล้วลองอีกครั้ง");
    }
  }

  return (
    <section className="records-section payment-tracking-section" aria-labelledby="payment-tracking-title">
      <div className="records-heading payment-tracking-heading">
        <div>
          <p className="section-kicker">PENDING PAYMENT TRACKING · ปีการศึกษา 2569</p>
          <h2 id="payment-tracking-title">รายชื่อผู้ปกครองและนักเรียนค้างจ่าย</h2>
          <p>ตรวจสอบยอดค่าสมัครและค่าบำรุงรายภาคเรียน พร้อมสถานะหลักฐานการชำระ</p>
        </div>
        <a className="tracking-export-button" href={`/api/fees/tracking?${exportQuery.toString()}`}>
          <span aria-hidden="true">↓</span> Export Excel
        </a>
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}
      {actionMessage && <div className="tracking-action-message" role="status">{actionMessage}</div>}

      <div className="tracking-toolbar">
        <label className="tracking-search">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={searchText}
            maxLength={100}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="ค้นหาชื่อ รหัสนักเรียน ผู้ปกครอง หรือห้อง"
            aria-label="ค้นหารายงานการชำระ"
          />
        </label>
        <span className="tracking-filter-label">Filter tools</span>
        <label className="tracking-class-filter">
          <span className="visually-hidden">ระดับชั้น</span>
          <select
            value={classroom}
            onChange={(event) => {
              setClassroom(event.target.value);
              setPage(1);
            }}
          >
            <option value="">ทุกชั้น</option>
            {associationClassroomOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <span className="tracking-result-count">
          {classroom ? `${classroom} · ` : ""}
          {search ? `ค้นหา “${search}” · ` : ""}
          หน้า ${page}{selectedStudents.length ? ` · เลือก ${selectedStudents.length} คน` : ""}
        </span>
        {selectedStudents.length > 0 && (
          <button
            type="button"
            className="tracking-bulk-reminder"
            onClick={() => copyReminderMessages(selectedStudents)}
          >
            แจ้งเตือนที่เลือก
          </button>
        )}
      </div>

      <div className="records-table-wrap tracking-table-wrap">
        <table className="records-table tracking-table">
          <thead>
            <tr>
              <th className="tracking-select-column">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  disabled={loading || students.length === 0}
                  onChange={() => {
                    setSelectedStudentIds((current) => {
                      const next = new Set(current);
                      if (allVisibleSelected) students.forEach((student) => next.delete(student.studentId));
                      else students.forEach((student) => next.add(student.studentId));
                      return next;
                    });
                    setActionMessage("");
                  }}
                  aria-label="เลือกนักเรียนทั้งหมดในหน้านี้"
                />
              </th>
              <th>รหัสนักเรียน</th>
              <th>ชื่อ-สกุลนักเรียน</th>
              <th>ห้องเรียน</th>
              <th>ชื่อผู้ปกครอง</th>
              <th>ค่าสมัครสมาชิก</th>
              <th>ค่าบำรุง ภาคเรียน 1</th>
              <th>ค่าบำรุง ภาคเรียน 2</th>
              <th>การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="records-empty">กำลังโหลดรายงาน...</td></tr>
            ) : students.length === 0 ? (
              <tr><td colSpan={9} className="records-empty">ไม่พบข้อมูลตามตัวกรองนี้</td></tr>
            ) : students.map((student) => (
              <tr key={student.studentId} className={selectedStudentIds.has(student.studentId) ? "tracking-row-selected" : ""}>
                <td className="tracking-select-column">
                  <input
                    type="checkbox"
                    checked={selectedStudentIds.has(student.studentId)}
                    onChange={() => {
                      setSelectedStudentIds((current) => {
                        const next = new Set(current);
                        if (next.has(student.studentId)) next.delete(student.studentId);
                        else next.add(student.studentId);
                        return next;
                      });
                      setActionMessage("");
                    }}
                    aria-label={`เลือก ${student.childName} รหัส ${student.studentId}`}
                  />
                </td>
                <td><span className="tracking-student-id">{student.studentId}</span></td>
                <td><strong className="tracking-student-name">{student.childName || "—"}</strong></td>
                <td>{student.classroom || "—"}</td>
                <td>{student.guardianNames || "ไม่ระบุ"}</td>
                <PaymentCell
                  total={student.membershipTotal}
                  paid={student.membershipPaid}
                  count={student.membershipItemCount}
                  waiting={student.membershipWaiting}
                  rejected={student.membershipRejected}
                />
                <PaymentCell
                  total={student.semester1Total}
                  paid={student.semester1Paid}
                  count={student.semester1ItemCount}
                  waiting={student.semester1Waiting}
                  rejected={student.semester1Rejected}
                />
                <PaymentCell
                  total={student.semester2Total}
                  paid={student.semester2Paid}
                  count={student.semester2ItemCount}
                  waiting={student.semester2Waiting}
                  rejected={student.semester2Rejected}
                />
                <td>
                  <div className="tracking-actions">
                    <button
                      type="button"
                      className="tracking-reminder-button"
                      onClick={() => copyReminderMessages([student])}
                      disabled={getOutstandingFees(student).length === 0}
                      title="คัดลอกข้อความสำหรับส่งแจ้งเตือนผู้ปกครอง"
                    >
                      แจ้งเตือน
                    </button>
                    <a
                      className="tracking-review-button"
                      href={`/records?studentId=${encodeURIComponent(student.studentId)}`}
                    >
                      ตรวจสอบ
                    </a>
                  </div>
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
  );
}
