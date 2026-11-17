import { NextResponse } from "next/server";
import {
  associationFeeMemberIdPattern,
  isAssociationFeeMemberInput,
} from "@/lib/association-fee-members";
import { requireCaretakerApiSession } from "@/lib/caretaker-api-session";

const pageSize = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function GET(request: Request) {
  const requestedPage = Number(new URL(request.url).searchParams.get("page") ?? "1");
  if (!Number.isSafeInteger(requestedPage) || requestedPage < 1) {
    return NextResponse.json({ error: "หมายเลขหน้าไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const session = await requireCaretakerApiSession();
    if ("response" in session) return session.response;

    const [membersResult, cyclesResult] = await Promise.all([
      session.supabase.rpc("get_association_fee_members", {
        p_session_token: session.token,
        p_limit: pageSize + 1,
        p_offset: (requestedPage - 1) * pageSize,
      }),
      session.supabase.rpc("get_association_fee_member_cycles", {
        p_session_token: session.token,
      }),
    ]);

    if (membersResult.error) {
      console.error("Could not load association fee members:", membersResult.error.message);
      return NextResponse.json({ error: "ไม่สามารถอ่านข้อมูลสมาชิกได้" }, { status: 500 });
    }
    if (cyclesResult.error) {
      console.error("Could not load association fee member cycles:", cyclesResult.error.message);
      return NextResponse.json({ error: "ไม่สามารถอ่านรอบค่าบำรุงได้" }, { status: 500 });
    }

    const rows = membersResult.data;
    const cycles = cyclesResult.data;
    if (
      !Array.isArray(rows) ||
      rows.some(
        (row) =>
          typeof row.id !== "string" ||
          !associationFeeMemberIdPattern.test(row.id) ||
          typeof row.cycle_id !== "string" ||
          !associationFeeMemberIdPattern.test(row.cycle_id) ||
          typeof row.student_id !== "string" ||
          typeof row.member_name !== "string" ||
          typeof row.contact_info !== "string" ||
          (typeof row.amount !== "string" && typeof row.amount !== "number") ||
          !Number.isFinite(Number(row.amount)) ||
          typeof row.status !== "string" ||
          (row.note !== null && typeof row.note !== "string") ||
          typeof row.created_at !== "string"
      ) ||
      !Array.isArray(cycles) ||
      cycles.some(
        (cycle) =>
          typeof cycle.cycle_id !== "string" ||
          !associationFeeMemberIdPattern.test(cycle.cycle_id) ||
          (typeof cycle.member_count !== "string" && typeof cycle.member_count !== "number") ||
          !Number.isSafeInteger(Number(cycle.member_count)) ||
          Number(cycle.member_count) < 1
      )
    ) {
      console.error("Supabase returned an invalid association fee member list");
      return NextResponse.json({ error: "รูปแบบข้อมูลสมาชิกจากฐานข้อมูลไม่ถูกต้อง" }, { status: 500 });
    }

    return NextResponse.json({
      members: rows.slice(0, pageSize).map((row) => ({
        id: row.id,
        cycleId: row.cycle_id,
        studentId: row.student_id,
        memberName: row.member_name,
        contactInfo: row.contact_info,
        amount: Number(row.amount),
        status: row.status,
        note: row.note,
        createdAt: row.created_at,
      })),
      cycles: cycles.map((cycle) => ({
        id: cycle.cycle_id,
        memberCount: Number(cycle.member_count),
      })),
      hasMore: rows.length > pageSize,
      page: requestedPage,
    });
  } catch (error) {
    console.error("Could not initialize association fee member list:", error);
    return NextResponse.json({ error: "ระบบฐานข้อมูลยังตั้งค่าไม่ครบ" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลคำขอไม่ถูกต้อง" }, { status: 400 });
  }

  if (!isAssociationFeeMemberInput(body)) {
    return NextResponse.json({ error: "กรุณากรอกข้อมูลสมาชิกและจำนวนเงินให้ถูกต้อง" }, { status: 400 });
  }

  try {
    const session = await requireCaretakerApiSession();
    if ("response" in session) return session.response;

    const { data, error } = await session.supabase.rpc("create_association_fee_member", {
      p_session_token: session.token,
      p_cycle_id: body.cycleId,
      p_student_id: body.studentId,
      p_member_name: body.memberName,
      p_contact_info: body.contactInfo,
      p_amount: body.amount,
      p_note: body.note,
    });
    if (error) {
      if (error.message.includes("invalid_session")) {
        const response = NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
        response.cookies.delete("association_session");
        return response;
      }
      if (error.message.includes("invalid_member_data")) {
        return NextResponse.json({ error: "กรุณากรอกข้อมูลสมาชิกและจำนวนเงินให้ถูกต้อง" }, { status: 400 });
      }
      console.error("Could not create association fee member:", error.message);
      return NextResponse.json({ error: "ไม่สามารถเพิ่มสมาชิกได้" }, { status: 500 });
    }

    if (typeof data !== "string" || !associationFeeMemberIdPattern.test(data)) {
      console.error("Supabase returned an invalid new association fee member ID");
      return NextResponse.json({ error: "รูปแบบข้อมูลสมาชิกจากฐานข้อมูลไม่ถูกต้อง" }, { status: 500 });
    }

    return NextResponse.json({ id: data }, { status: 201 });
  } catch (error) {
    console.error("Could not initialize association fee member creation:", error);
    return NextResponse.json({ error: "ระบบฐานข้อมูลยังตั้งค่าไม่ครบ" }, { status: 500 });
  }
}
