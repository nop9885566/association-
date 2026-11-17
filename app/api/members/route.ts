import { NextResponse } from "next/server";
import {
  associationMemberIdPattern,
  isAssociationMemberInput,
} from "@/lib/association-members";
import { requireCaretakerApiSession } from "@/lib/caretaker-api-session";

const pageSize = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const requestedPage = Number(searchParams.get("page") ?? "1");
  const search = (searchParams.get("q") ?? "").trim();
  if (!Number.isSafeInteger(requestedPage) || requestedPage < 1) {
    return NextResponse.json({ error: "หมายเลขหน้าไม่ถูกต้อง" }, { status: 400 });
  }
  if (search.length > 100) {
    return NextResponse.json({ error: "คำค้นหายาวเกินไป" }, { status: 400 });
  }

  try {
    const session = await requireCaretakerApiSession();
    if ("response" in session) return session.response;

    const [membersResult, familiesResult] = await Promise.all([
      session.supabase.rpc("search_association_members", {
        p_session_token: session.token,
        p_search: search,
        p_limit: pageSize + 1,
        p_offset: (requestedPage - 1) * pageSize,
      }),
      session.supabase.rpc("get_association_member_families", {
        p_session_token: session.token,
      }),
    ]);

    if (membersResult.error) {
      console.error("Could not load association members:", membersResult.error.message);
      return NextResponse.json({ error: "ไม่สามารถอ่านทะเบียนสมาชิกได้" }, { status: 500 });
    }
    if (familiesResult.error) {
      console.error("Could not load association member families:", familiesResult.error.message);
      return NextResponse.json({ error: "ไม่สามารถอ่านข้อมูลครอบครัวได้" }, { status: 500 });
    }

    const rows = membersResult.data;
    const families = familiesResult.data;
    if (
      !Array.isArray(rows) ||
      rows.some(
        (row) =>
          typeof row.id !== "string" ||
          !associationMemberIdPattern.test(row.id) ||
          typeof row.family_id !== "string" ||
          !associationMemberIdPattern.test(row.family_id) ||
          typeof row.student_id !== "string" ||
          typeof row.father_name !== "string" ||
          typeof row.mother_name !== "string" ||
          typeof row.guardian_name !== "string" ||
          typeof row.child_name !== "string" ||
          typeof row.is_active !== "boolean" ||
          typeof row.has_fee_records !== "boolean" ||
          typeof row.created_at !== "string"
      ) ||
      !Array.isArray(families) ||
      families.some(
        (family) =>
          typeof family.family_id !== "string" ||
          !associationMemberIdPattern.test(family.family_id) ||
          (typeof family.member_count !== "string" && typeof family.member_count !== "number") ||
          !Number.isSafeInteger(Number(family.member_count)) ||
          Number(family.member_count) < 1
      )
    ) {
      console.error("Supabase returned an invalid association member list");
      return NextResponse.json({ error: "รูปแบบทะเบียนสมาชิกจากฐานข้อมูลไม่ถูกต้อง" }, { status: 500 });
    }

    return NextResponse.json({
      members: rows.slice(0, pageSize).map((row) => ({
        id: row.id,
        familyId: row.family_id,
        studentId: row.student_id,
        fatherName: row.father_name,
        motherName: row.mother_name,
        guardianName: row.guardian_name,
        childName: row.child_name,
        isActive: row.is_active,
        hasFeeRecords: row.has_fee_records,
        createdAt: row.created_at,
      })),
      families: families.map((family) => ({
        id: family.family_id,
        memberCount: Number(family.member_count),
      })),
      hasMore: rows.length > pageSize,
      page: requestedPage,
    });
  } catch (error) {
    console.error("Could not initialize association member list:", error);
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
  if (!isAssociationMemberInput(body)) {
    return NextResponse.json({ error: "กรุณากรอกข้อมูลสมาชิกให้ถูกต้อง" }, { status: 400 });
  }

  try {
    const session = await requireCaretakerApiSession();
    if ("response" in session) return session.response;

    const { data, error } = await session.supabase.rpc("create_association_member", {
      p_session_token: session.token,
      p_family_id: body.familyId,
      p_student_id: body.studentId,
      p_father_name: body.fatherName,
      p_mother_name: body.motherName,
      p_guardian_name: body.guardianName,
      p_child_name: body.childName,
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
      if (error.message.includes("student_id_exists")) {
        return NextResponse.json({ error: "รหัสนักเรียนนี้มีอยู่ในทะเบียนแล้ว" }, { status: 409 });
      }
      console.error("Could not create association member:", error.message);
      return NextResponse.json({ error: "ไม่สามารถเพิ่มสมาชิกได้" }, { status: 500 });
    }
    if (typeof data !== "string" || !associationMemberIdPattern.test(data)) {
      console.error("Supabase returned an invalid new association member ID");
      return NextResponse.json({ error: "รูปแบบข้อมูลสมาชิกจากฐานข้อมูลไม่ถูกต้อง" }, { status: 500 });
    }

    return NextResponse.json({ id: data }, { status: 201 });
  } catch (error) {
    console.error("Could not initialize association member creation:", error);
    return NextResponse.json({ error: "ระบบฐานข้อมูลยังตั้งค่าไม่ครบ" }, { status: 500 });
  }
}
