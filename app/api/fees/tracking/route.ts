import { NextResponse } from "next/server";
import { associationClassroomOptions } from "@/lib/association-members";
import { requireCaretakerApiSession } from "@/lib/caretaker-api-session";
import {
  getPaymentStatus,
  paymentStatusLabels,
  type PaymentTrackingRow,
} from "@/lib/payment-tracking";

const pageSize = 50;
const exportBatchSize = 1000;
const exportRowLimit = 10000;
const allowedClassrooms: ReadonlySet<string> = new Set(associationClassroomOptions);

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseAmount(value: unknown): number | null {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function parseCount(value: unknown): number | null {
  const count = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

function parsePaymentTrackingRow(value: unknown): PaymentTrackingRow | null {
  if (!isRecord(value)) return null;

  const membershipTotal = parseAmount(value.membership_total);
  const membershipPaid = parseAmount(value.membership_paid);
  const membershipItemCount = parseCount(value.membership_item_count);
  const semester1Total = parseAmount(value.semester_1_total);
  const semester1Paid = parseAmount(value.semester_1_paid);
  const semester1ItemCount = parseCount(value.semester_1_item_count);
  const semester2Total = parseAmount(value.semester_2_total);
  const semester2Paid = parseAmount(value.semester_2_paid);
  const semester2ItemCount = parseCount(value.semester_2_item_count);

  if (
    typeof value.student_id !== "string" ||
    typeof value.child_name !== "string" ||
    typeof value.classroom !== "string" ||
    typeof value.guardian_names !== "string" ||
    membershipTotal === null ||
    membershipPaid === null ||
    membershipItemCount === null ||
    typeof value.membership_waiting !== "boolean" ||
    typeof value.membership_rejected !== "boolean" ||
    semester1Total === null ||
    semester1Paid === null ||
    semester1ItemCount === null ||
    typeof value.semester_1_waiting !== "boolean" ||
    typeof value.semester_1_rejected !== "boolean" ||
    semester2Total === null ||
    semester2Paid === null ||
    semester2ItemCount === null ||
    typeof value.semester_2_waiting !== "boolean" ||
    typeof value.semester_2_rejected !== "boolean"
  ) {
    return null;
  }

  return {
    studentId: value.student_id,
    childName: value.child_name,
    classroom: value.classroom,
    guardianNames: value.guardian_names,
    membershipTotal,
    membershipPaid,
    membershipItemCount,
    membershipWaiting: value.membership_waiting,
    membershipRejected: value.membership_rejected,
    semester1Total,
    semester1Paid,
    semester1ItemCount,
    semester1Waiting: value.semester_1_waiting,
    semester1Rejected: value.semester_1_rejected,
    semester2Total,
    semester2Paid,
    semester2ItemCount,
    semester2Waiting: value.semester_2_waiting,
    semester2Rejected: value.semester_2_rejected,
  };
}

function csvCell(value: string | number): string {
  const text = String(value);
  const safeText = typeof value === "string" && /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

function toCsv(rows: PaymentTrackingRow[]): string {
  const headings = [
    "รหัสนักเรียน",
    "ชื่อนักเรียน",
    "ห้องเรียน",
    "ผู้ปกครอง",
    "ค่าสมัคร · ยอดเรียกเก็บ",
    "ค่าสมัคร · ชำระแล้ว",
    "สถานะค่าสมัคร",
    "ภาคเรียน 1 · ยอดเรียกเก็บ",
    "ภาคเรียน 1 · ชำระแล้ว",
    "สถานะภาคเรียน 1",
    "ภาคเรียน 2 · ยอดเรียกเก็บ",
    "ภาคเรียน 2 · ชำระแล้ว",
    "สถานะภาคเรียน 2",
  ];
  const lines = rows.map((row) => {
    const membershipStatus = getPaymentStatus(
      row.membershipItemCount,
      row.membershipPaid,
      row.membershipTotal,
      row.membershipWaiting,
      row.membershipRejected,
    );
    const semester1Status = getPaymentStatus(
      row.semester1ItemCount,
      row.semester1Paid,
      row.semester1Total,
      row.semester1Waiting,
      row.semester1Rejected,
    );
    const semester2Status = getPaymentStatus(
      row.semester2ItemCount,
      row.semester2Paid,
      row.semester2Total,
      row.semester2Waiting,
      row.semester2Rejected,
    );
    return [
      row.studentId,
      row.childName,
      row.classroom,
      row.guardianNames,
      row.membershipTotal.toFixed(2),
      row.membershipPaid.toFixed(2),
      paymentStatusLabels[membershipStatus],
      row.semester1Total.toFixed(2),
      row.semester1Paid.toFixed(2),
      paymentStatusLabels[semester1Status],
      row.semester2Total.toFixed(2),
      row.semester2Paid.toFixed(2),
      paymentStatusLabels[semester2Status],
    ].map(csvCell).join(",");
  });
  return `\uFEFF${[headings.map(csvCell).join(","), ...lines].join("\r\n")}`;
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const requestedPage = Number(searchParams.get("page") ?? "1");
  const search = (searchParams.get("q") ?? "").trim();
  const classroom = (searchParams.get("classroom") ?? "").trim();
  const exportCsv = searchParams.get("export") === "csv";

  if (!exportCsv && (!Number.isSafeInteger(requestedPage) || requestedPage < 1)) {
    return jsonResponse({ error: "หมายเลขหน้าไม่ถูกต้อง" }, 400);
  }
  if (search.length > 100) {
    return jsonResponse({ error: "คำค้นหายาวเกินไป" }, 400);
  }
  if (classroom && !allowedClassrooms.has(classroom)) {
    return jsonResponse({ error: "ระดับชั้นที่เลือกไม่ถูกต้อง" }, 400);
  }
  if (searchParams.has("export") && !exportCsv) {
    return jsonResponse({ error: "รูปแบบไฟล์ส่งออกไม่ถูกต้อง" }, 400);
  }
  const offset = (requestedPage - 1) * pageSize;
  if (!exportCsv && (!Number.isSafeInteger(offset) || offset > 2147483647)) {
    return jsonResponse({ error: "หมายเลขหน้าไม่ถูกต้อง" }, 400);
  }

  try {
    const session = await requireCaretakerApiSession();
    if ("response" in session) return session.response;

    const fetchRows = async (limit: number, offset: number) => {
      const { data, error } = await session.supabase.rpc("get_association_payment_tracking", {
        p_session_token: session.token,
        p_academic_year: 2569,
        p_search: search,
        p_classroom: classroom || null,
        p_limit: limit,
        p_offset: offset,
      });
      if (error) throw new Error(error.message);
      if (!Array.isArray(data)) throw new Error("invalid_report_data");
      const rows: PaymentTrackingRow[] = [];
      for (const value of data) {
        const row = parsePaymentTrackingRow(value);
        if (!row) throw new Error("invalid_report_row");
        rows.push(row);
      }
      return rows;
    };

    if (exportCsv) {
      const rows: PaymentTrackingRow[] = [];
      for (let offset = 0; ; offset += exportBatchSize) {
        const batch = await fetchRows(exportBatchSize, offset);
        rows.push(...batch);
        if (batch.length < exportBatchSize) break;
        if (rows.length >= exportRowLimit) {
          const nextRows = await fetchRows(1, offset + batch.length);
          if (nextRows.length > 0) {
            return jsonResponse({ error: "รายงานมีข้อมูลเกินขีดจำกัดการส่งออก 10,000 รายการ" }, 413);
          }
          break;
        }
      }

      return new NextResponse(toCsv(rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="payment-tracking-2569.csv"',
          "Cache-Control": "private, no-store",
        },
      });
    }

    const rows = await fetchRows(pageSize + 1, offset);
    return jsonResponse({
      students: rows.slice(0, pageSize),
      hasMore: rows.length > pageSize,
      page: requestedPage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    if (message.includes("invalid_session")) {
      const response = jsonResponse({ error: "กรุณาเข้าสู่ระบบ" }, 401);
      response.cookies.delete("association_session");
      return response;
    }
    console.error("Could not load payment tracking report:", message);
    return jsonResponse({ error: "ไม่สามารถอ่านรายงานติดตามค่าบำรุงได้" }, 500);
  }
}
