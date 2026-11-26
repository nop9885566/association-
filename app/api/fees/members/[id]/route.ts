import { NextResponse } from "next/server";
import {
  associationFeeMemberIdPattern,
  isAssociationFeeMemberInput,
} from "@/lib/association-fee-members";
import { requireCaretakerApiSession } from "@/lib/caretaker-api-session";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!associationFeeMemberIdPattern.test(id)) {
    return NextResponse.json({ error: "รหัสสมาชิกไม่ถูกต้อง" }, { status: 400 });
  }

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

    const { data, error } = await session.supabase.rpc("update_association_fee_member", {
      p_session_token: session.token,
      p_member_id: id,
      p_cycle_id: body.cycleId,
      p_student_id: body.studentId,
      p_member_name: body.memberName,
      p_contact_info: body.contactInfo,
      p_amount: body.amount,
      p_note: body.note,
      p_fee_type: body.feeType,
      p_academic_year: body.academicYear,
      p_semester: body.semester,
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
      console.error("Could not update association fee member:", error.message);
      return NextResponse.json({ error: "ไม่สามารถแก้ไขข้อมูลสมาชิกได้" }, { status: 500 });
    }
    if (data !== true && data !== false) {
      console.error("Supabase returned an invalid association fee member update result");
      return NextResponse.json({ error: "รูปแบบผลการแก้ไขสมาชิกจากฐานข้อมูลไม่ถูกต้อง" }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "ไม่พบสมาชิกที่ต้องการแก้ไข" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Could not initialize association fee member update:", error);
    return NextResponse.json({ error: "ระบบฐานข้อมูลยังตั้งค่าไม่ครบ" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!associationFeeMemberIdPattern.test(id)) {
    return NextResponse.json({ error: "รหัสสมาชิกไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const session = await requireCaretakerApiSession();
    if ("response" in session) return session.response;

    const { data, error } = await session.supabase.rpc("delete_association_fee_member", {
      p_session_token: session.token,
      p_member_id: id,
    });
    if (error) {
      if (error.message.includes("invalid_session")) {
        const response = NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
        response.cookies.delete("association_session");
        return response;
      }
      if (error.message.includes("member_has_payment_history")) {
        return NextResponse.json(
          { error: "ลบสมาชิกนี้ไม่ได้ เนื่องจากมีประวัติการชำระเงินที่ผูกอยู่" },
          { status: 409 },
        );
      }
      console.error("Could not delete association fee member:", error.message);
      return NextResponse.json({ error: "ไม่สามารถลบสมาชิกได้" }, { status: 500 });
    }
    if (data !== true && data !== false) {
      console.error("Supabase returned an invalid association fee member deletion result");
      return NextResponse.json({ error: "รูปแบบผลการลบสมาชิกจากฐานข้อมูลไม่ถูกต้อง" }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "ไม่พบสมาชิกที่ต้องการลบ" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Could not initialize association fee member deletion:", error);
    return NextResponse.json({ error: "ระบบฐานข้อมูลยังตั้งค่าไม่ครบ" }, { status: 500 });
  }
}
