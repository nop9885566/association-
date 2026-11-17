import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

function isCount(value: unknown): number | null {
  const count = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  return Number.isSafeInteger(count) && count >= 2 ? count : null;
}

export async function GET() {
  const token = (await cookies()).get("association_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  try {
    const supabase = getSupabase();
    const { data: sessionData, error: sessionError } = await supabase.rpc("get_caretaker_session", {
      p_session_token: token,
    });
    if (sessionError) {
      console.error("Could not verify caretaker before duplicate checks:", sessionError.message);
      return NextResponse.json({ error: "ไม่สามารถตรวจสอบสถานะเข้าสู่ระบบได้" }, { status: 500 });
    }

    if (!Array.isArray(sessionData) || sessionData.length === 0) {
      const response = NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
      response.cookies.delete("association_session");
      return response;
    }

    const [paymentResult, studentIdResult] = await Promise.all([
      supabase.rpc("get_duplicate_fee_submissions", { p_session_token: token }),
      supabase.rpc("get_duplicate_student_ids", { p_session_token: token }),
    ]);

    if (paymentResult.error) {
      console.error("Could not load duplicate fee submissions:", paymentResult.error.message);
      return NextResponse.json({ error: "ไม่สามารถตรวจรายการส่งหลักฐานซ้ำได้" }, { status: 500 });
    }
    if (studentIdResult.error) {
      console.error("Could not load duplicate student IDs:", studentIdResult.error.message);
      return NextResponse.json({ error: "ไม่สามารถตรวจรหัสนักเรียนซ้ำได้" }, { status: 500 });
    }

    const duplicatePayments = paymentResult.data;
    const duplicateStudentIds = studentIdResult.data;
    if (
      !Array.isArray(duplicatePayments) ||
      duplicatePayments.some(
        (row) =>
          typeof row.student_item_id !== "string" ||
          (row.student_id !== null && typeof row.student_id !== "string") ||
          !Array.isArray(row.guardian_names) ||
          row.guardian_names.some((name: unknown) => typeof name !== "string") ||
          isCount(row.submission_count) === null ||
          Object.keys(row).some(
            (key) => !["student_item_id", "student_id", "guardian_names", "submission_count"].includes(key),
          ),
      ) ||
      !Array.isArray(duplicateStudentIds) ||
      duplicateStudentIds.some(
        (row) =>
          typeof row.cycle_id !== "string" ||
          typeof row.student_id !== "string" ||
          isCount(row.item_count) === null ||
          !Array.isArray(row.student_item_ids) ||
          row.student_item_ids.some((id: unknown) => typeof id !== "string") ||
          Object.keys(row).some(
            (key) => !["cycle_id", "student_id", "item_count", "student_item_ids"].includes(key),
          ),
      )
    ) {
      console.error("Supabase returned an invalid duplicate report");
      return NextResponse.json({ error: "รูปแบบรายงานรายการซ้ำจากฐานข้อมูลไม่ถูกต้อง" }, { status: 500 });
    }

    return NextResponse.json({
      duplicatePayments: duplicatePayments.map((row) => ({
        studentItemId: row.student_item_id,
        studentId: row.student_id,
        guardianNames: row.guardian_names,
        submissionCount: Number(row.submission_count),
      })),
      duplicateStudentIds: duplicateStudentIds.map((row) => ({
        cycleId: row.cycle_id,
        studentId: row.student_id,
        itemCount: Number(row.item_count),
        studentItemIds: row.student_item_ids,
      })),
    });
  } catch (error) {
    console.error("Could not initialize duplicate report:", error);
    return NextResponse.json({ error: "ระบบฐานข้อมูลยังตั้งค่าไม่ครบ" }, { status: 500 });
  }
}
