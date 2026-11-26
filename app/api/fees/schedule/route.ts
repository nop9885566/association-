import { NextResponse } from "next/server";
import { requireCaretakerApiSession } from "@/lib/caretaker-api-session";

type FeeSchedule = {
  academicYear: number;
  membershipAmount: number;
  semester1Amount: number;
  semester2Amount: number;
  membershipOpensOn: string | null;
  membershipDueOn: string | null;
  semester1OpensOn: string | null;
  semester1DueOn: string | null;
  semester2OpensOn: string | null;
  semester2DueOn: string | null;
};

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
  if ((typeof value !== "string" && typeof value !== "number") || String(value).trim() === "") {
    return null;
  }
  const text = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const amount = Number(text);
  return Number.isFinite(amount) && amount >= 0 && amount <= 9999999999.99 ? amount : null;
}

function parseDate(value: unknown): { valid: boolean; value: string | null } {
  if (value === null) return { valid: true, value: null };
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { valid: false, value: null };
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return { valid: false, value: null };
  }
  return { valid: true, value };
}

function parseScheduleRow(value: unknown): FeeSchedule | null {
  if (!isRecord(value)) return null;
  const academicYear = Number(value.academic_year);
  const membershipAmount = parseAmount(value.membership_amount);
  const semester1Amount = parseAmount(value.semester_1_amount);
  const semester2Amount = parseAmount(value.semester_2_amount);
  const membershipOpensOn = parseDate(value.membership_opens_on);
  const membershipDueOn = parseDate(value.membership_due_on);
  const semester1OpensOn = parseDate(value.semester_1_opens_on);
  const semester1DueOn = parseDate(value.semester_1_due_on);
  const semester2OpensOn = parseDate(value.semester_2_opens_on);
  const semester2DueOn = parseDate(value.semester_2_due_on);

  if (
    !Number.isSafeInteger(academicYear) ||
    academicYear < 2500 ||
    academicYear > 2700 ||
    membershipAmount === null ||
    semester1Amount === null ||
    semester2Amount === null ||
    !membershipOpensOn.valid ||
    !membershipDueOn.valid ||
    !semester1OpensOn.valid ||
    !semester1DueOn.valid ||
    !semester2OpensOn.valid ||
    !semester2DueOn.valid
  ) {
    return null;
  }

  return {
    academicYear,
    membershipAmount,
    semester1Amount,
    semester2Amount,
    membershipOpensOn: membershipOpensOn.value,
    membershipDueOn: membershipDueOn.value,
    semester1OpensOn: semester1OpensOn.value,
    semester1DueOn: semester1DueOn.value,
    semester2OpensOn: semester2OpensOn.value,
    semester2DueOn: semester2DueOn.value,
  };
}

function sessionExpired(message: string): boolean {
  return message.includes("invalid_session");
}

function unauthorizedResponse() {
  const response = jsonResponse({ error: "กรุณาเข้าสู่ระบบ" }, 401);
  response.cookies.delete("association_session");
  return response;
}

export async function GET(request: Request) {
  const academicYear = Number(new URL(request.url).searchParams.get("academicYear") ?? "2569");
  if (!Number.isSafeInteger(academicYear) || academicYear < 2500 || academicYear > 2700) {
    return jsonResponse({ error: "ปีการศึกษาไม่ถูกต้อง" }, 400);
  }

  try {
    const session = await requireCaretakerApiSession();
    if ("response" in session) return session.response;

    const { data, error } = await session.supabase.rpc("get_association_fee_schedule", {
      p_session_token: session.token,
      p_academic_year: academicYear,
    });
    if (error) {
      if (sessionExpired(error.message)) return unauthorizedResponse();
      console.error("Could not load association fee schedule:", error.message);
      return jsonResponse({ error: "ไม่สามารถอ่านการตั้งค่าอัตราค่าบำรุงได้" }, 500);
    }
    if (!Array.isArray(data) || data.length > 1) {
      console.error("Supabase returned an invalid association fee schedule");
      return jsonResponse({ error: "รูปแบบการตั้งค่าอัตราค่าบำรุงไม่ถูกต้อง" }, 500);
    }
    if (data.length === 0) return jsonResponse({ schedule: null });

    const schedule = parseScheduleRow(data[0]);
    if (!schedule) {
      console.error("Supabase returned an invalid association fee schedule row");
      return jsonResponse({ error: "รูปแบบการตั้งค่าอัตราค่าบำรุงไม่ถูกต้อง" }, 500);
    }
    return jsonResponse({ schedule });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    if (sessionExpired(message)) return unauthorizedResponse();
    console.error("Could not initialize association fee schedule query:", message);
    return jsonResponse({ error: "ระบบฐานข้อมูลยังตั้งค่าไม่ครบ" }, 500);
  }
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "ข้อมูลคำขอไม่ถูกต้อง" }, 400);
  }

  if (!isRecord(body)) return jsonResponse({ error: "ข้อมูลคำขอไม่ถูกต้อง" }, 400);

  const academicYear = Number(body.academicYear);
  const membershipAmount = parseAmount(body.membershipAmount);
  const semester1Amount = parseAmount(body.semester1Amount);
  const semester2Amount = parseAmount(body.semester2Amount);
  const membershipOpensOn = parseDate(body.membershipOpensOn);
  const membershipDueOn = parseDate(body.membershipDueOn);
  const semester1OpensOn = parseDate(body.semester1OpensOn);
  const semester1DueOn = parseDate(body.semester1DueOn);
  const semester2OpensOn = parseDate(body.semester2OpensOn);
  const semester2DueOn = parseDate(body.semester2DueOn);

  if (
    !Number.isSafeInteger(academicYear) ||
    academicYear < 2500 ||
    academicYear > 2700 ||
    membershipAmount === null ||
    semester1Amount === null ||
    semester2Amount === null ||
    !membershipOpensOn.valid ||
    !membershipDueOn.valid ||
    !semester1OpensOn.valid ||
    !semester1DueOn.valid ||
    !semester2OpensOn.valid ||
    !semester2DueOn.valid ||
    (membershipOpensOn.value === null) !== (membershipDueOn.value === null) ||
    (semester1OpensOn.value === null) !== (semester1DueOn.value === null) ||
    (semester2OpensOn.value === null) !== (semester2DueOn.value === null) ||
    (membershipDueOn.value !== null && membershipOpensOn.value !== null && membershipDueOn.value < membershipOpensOn.value) ||
    (semester1DueOn.value !== null && semester1OpensOn.value !== null && semester1DueOn.value < semester1OpensOn.value) ||
    (semester2DueOn.value !== null && semester2OpensOn.value !== null && semester2DueOn.value < semester2OpensOn.value)
  ) {
    return jsonResponse({ error: "กรุณาตรวจสอบปี อัตราค่าบำรุง และช่วงวันรับชำระ" }, 400);
  }

  try {
    const session = await requireCaretakerApiSession();
    if ("response" in session) return session.response;

    const { data, error } = await session.supabase.rpc("save_association_fee_schedule", {
      p_session_token: session.token,
      p_academic_year: academicYear,
      p_membership_amount: membershipAmount,
      p_semester_1_amount: semester1Amount,
      p_semester_2_amount: semester2Amount,
      p_membership_opens_on: membershipOpensOn.value,
      p_membership_due_on: membershipDueOn.value,
      p_semester_1_opens_on: semester1OpensOn.value,
      p_semester_1_due_on: semester1DueOn.value,
      p_semester_2_opens_on: semester2OpensOn.value,
      p_semester_2_due_on: semester2DueOn.value,
    });
    if (error) {
      if (sessionExpired(error.message)) return unauthorizedResponse();
      console.error("Could not save association fee schedule:", error.message);
      return jsonResponse({ error: "ไม่สามารถบันทึกการตั้งค่าอัตราค่าบำรุงได้" }, 500);
    }
    if (data !== true) {
      console.error("Supabase returned an invalid association fee schedule save result");
      return jsonResponse({ error: "ไม่สามารถยืนยันผลการบันทึกได้" }, 500);
    }
    return jsonResponse({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    if (sessionExpired(message)) return unauthorizedResponse();
    console.error("Could not initialize association fee schedule save:", message);
    return jsonResponse({ error: "ระบบฐานข้อมูลยังตั้งค่าไม่ครบ" }, 500);
  }
}
