import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

const pageSize = 50;
const matchStatuses = new Set([
  "matched",
  "student_item_missing",
  "student_id_missing",
  "guardian_name_missing",
]);

export async function GET(request: NextRequest) {
  const token = (await cookies()).get("association_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const requestedPage = Number(request.nextUrl.searchParams.get("page") ?? "1");
  if (!Number.isSafeInteger(requestedPage) || requestedPage < 1) {
    return NextResponse.json({ error: "หมายเลขหน้าไม่ถูกต้อง" }, { status: 400 });
  }
  const studentId = (request.nextUrl.searchParams.get("studentId") ?? "").trim();
  if (request.nextUrl.searchParams.has("studentId") && (!studentId || studentId.length > 100)) {
    return NextResponse.json({ error: "รหัสนักเรียนไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const supabase = getSupabase();
    const { data: sessionData, error: sessionError } = await supabase.rpc("get_caretaker_session", {
      p_session_token: token,
    });
    if (sessionError) {
      console.error("Could not verify caretaker before loading fee records:", sessionError.message);
      return NextResponse.json({ error: "ไม่สามารถตรวจสอบสถานะเข้าสู่ระบบได้" }, { status: 500 });
    }

    if (!Array.isArray(sessionData) || sessionData.length === 0) {
      const response = NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
      response.cookies.delete("association_session");
      return response;
    }

    const result = studentId
      ? await supabase.rpc("get_association_fee_records_for_student", {
          p_session_token: token,
          p_student_id: studentId,
          p_limit: pageSize + 1,
          p_offset: (requestedPage - 1) * pageSize,
        })
      : await supabase.rpc("get_association_fee_records", {
          p_session_token: token,
          p_limit: pageSize + 1,
          p_offset: (requestedPage - 1) * pageSize,
        });
    const { data, error } = result;
    if (error) {
      console.error("Could not load association fee records:", error.message);
      return NextResponse.json({ error: "ไม่สามารถอ่านรายการค่าบำรุงจากฐานข้อมูลได้" }, { status: 500 });
    }

    if (
      !Array.isArray(data) ||
      data.some(
        (row) =>
          typeof row.submission_id !== "string" ||
          typeof row.student_item_id !== "string" ||
          (row.student_id !== null && typeof row.student_id !== "string") ||
          (row.guardian_name !== null && typeof row.guardian_name !== "string") ||
          (typeof row.submitted_amount !== "string" && typeof row.submitted_amount !== "number") ||
          !Number.isFinite(Number(row.submitted_amount)) ||
          typeof row.payment_datetime !== "string" ||
          Number.isNaN(Date.parse(row.payment_datetime)) ||
          typeof row.status !== "string" ||
          typeof row.match_status !== "string" ||
          !matchStatuses.has(row.match_status) ||
          Object.keys(row).some(
            (key) =>
              ![
                "submission_id",
                "student_item_id",
                "student_id",
                "guardian_name",
                "submitted_amount",
                "payment_datetime",
                "status",
                "match_status",
              ].includes(key),
          ),
      )
    ) {
      console.error("Supabase returned an invalid association fee record list");
      return NextResponse.json({ error: "รูปแบบรายการค่าบำรุงจากฐานข้อมูลไม่ถูกต้อง" }, { status: 500 });
    }

    const records = data.slice(0, pageSize).map((row) => ({
      submissionId: row.submission_id,
      studentItemId: row.student_item_id,
      studentId: row.student_id,
      guardianName: row.guardian_name,
      submittedAmount: String(row.submitted_amount),
      paymentDatetime: row.payment_datetime,
      status: row.status,
    }));

    return NextResponse.json({
      records,
      hasMore: data.length > pageSize,
      page: requestedPage,
    });
  } catch (error) {
    console.error("Could not initialize association fee record query:", error);
    return NextResponse.json({ error: "ระบบฐานข้อมูลยังตั้งค่าไม่ครบ" }, { status: 500 });
  }
}
