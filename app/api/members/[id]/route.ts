import { NextResponse } from "next/server";
import {
  associationMemberIdPattern,
  isAssociationMemberInput,
} from "@/lib/association-members";
import { requireCaretakerApiSession } from "@/lib/caretaker-api-session";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!associationMemberIdPattern.test(id)) {
    return NextResponse.json({ error: "รหัสสมาชิกไม่ถูกต้อง" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลคำขอไม่ถูกต้อง" }, { status: 400 });
  }
  if (!isAssociationMemberInput(body)) {
    return NextResponse.json({ error: "กรุณากรอกข้อมูลสมาชิกให้ถูกต้อง" }, { status: 400 });
  }

  try {
    const session = await requireCaretakerApiSession();
    if ("response" in session) return session.response;

    const { data, error } = await session.supabase.rpc("update_association_member", {
      p_session_token: session.token,
      p_member_id: id,
      p_family_id: body.familyId,
      p_student_id: body.studentId,
      p_father_name: body.parent1Name,
      p_mother_name: body.parent2Name,
      p_guardian_name: "",
      p_child_name: body.childName,
      p_classroom: body.classroom,
      p_is_active: body.isActive,
    });
    if (error) {
      if (error.message.includes("invalid_session")) {
        const response = NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
        response.cookies.delete("association_session");
        return response;
      }
      if (error.message.includes("invalid_member_data")) {
        return NextResponse.json({ error: "กรุณากรอกข้อมูลสมาชิกให้ถูกต้อง" }, { status: 400 });
      }
      if (error.message.includes("student_id_in_use")) {
        return NextResponse.json(
          { error: "แก้ไขรหัสนักเรียนไม่ได้ เพราะมีรายการค่าบำรุงผูกอยู่" },
          { status: 409 },
        );
      }
      if (error.message.includes("student_id_exists")) {
        return NextResponse.json({ error: "รหัสนักเรียนนี้มีอยู่ในทะเบียนแล้ว" }, { status: 409 });
      }
      console.error("Could not update association member:", error.message);
      return NextResponse.json({ error: "ไม่สามารถแก้ไขข้อมูลสมาชิกได้" }, { status: 500 });
    }
    if (data !== true && data !== false) {
      console.error("Supabase returned an invalid association member update result");
      return NextResponse.json({ error: "รูปแบบผลการแก้ไขสมาชิกจากฐานข้อมูลไม่ถูกต้อง" }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "ไม่พบสมาชิกที่ต้องการแก้ไข" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Could not initialize association member update:", error);
    return NextResponse.json({ error: "ระบบฐานข้อมูลยังตั้งค่าไม่ครบ" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!associationMemberIdPattern.test(id)) {
    return NextResponse.json({ error: "รหัสสมาชิกไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const session = await requireCaretakerApiSession();
    if ("response" in session) return session.response;

    const { data, error } = await session.supabase.rpc("delete_association_member", {
      p_session_token: session.token,
      p_member_id: id,
    });
    if (error) {
      if (error.message.includes("invalid_session")) {
        const response = NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
        response.cookies.delete("association_session");
        return response;
      }
      if (error.message.includes("member_has_fee_records")) {
        return NextResponse.json(
          { error: "ลบสมาชิกนี้ไม่ได้ เพราะมีรายการค่าบำรุงผูกอยู่" },
          { status: 409 },
        );
      }
      console.error("Could not delete association member:", error.message);
      return NextResponse.json({ error: "ไม่สามารถลบสมาชิกได้" }, { status: 500 });
    }
    if (data !== true && data !== false) {
      console.error("Supabase returned an invalid association member deletion result");
      return NextResponse.json({ error: "รูปแบบผลการลบสมาชิกจากฐานข้อมูลไม่ถูกต้อง" }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "ไม่พบสมาชิกที่ต้องการลบ" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Could not initialize association member deletion:", error);
    return NextResponse.json({ error: "ระบบฐานข้อมูลยังตั้งค่าไม่ครบ" }, { status: 500 });
  }
}
