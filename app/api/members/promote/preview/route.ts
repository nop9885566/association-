import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { requireCaretakerApiSession } from "@/lib/caretaker-api-session";

type PromotionPreviewRow = {
  memberId: string;
  studentId: string;
  childName: string;
  registryClassroom: string;
  sourceClassroom: string;
  sourceMatches: number;
  targetClassroom: string | null;
  action: "promote" | "graduate" | "student_missing" | "duplicate_student" | "missing_class" | "invalid_class";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asCount(value: unknown): number | null {
  const count = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

function parseRow(value: unknown): PromotionPreviewRow | null {
  if (!isRecord(value)) return null;

  const sourceMatches = asCount(value.source_matches);
  const actions = [
    "promote",
    "graduate",
    "student_missing",
    "duplicate_student",
    "missing_class",
    "invalid_class",
  ] as const;
  if (
    typeof value.member_id !== "string" ||
    typeof value.student_id !== "string" ||
    typeof value.child_name !== "string" ||
    typeof value.registry_classroom !== "string" ||
    typeof value.source_classroom !== "string" ||
    sourceMatches === null ||
    (value.target_classroom !== null && typeof value.target_classroom !== "string") ||
    typeof value.action !== "string" ||
    !actions.includes(value.action as PromotionPreviewRow["action"])
  ) {
    return null;
  }

  return {
    memberId: value.member_id,
    studentId: value.student_id,
    childName: value.child_name,
    registryClassroom: value.registry_classroom,
    sourceClassroom: value.source_classroom,
    sourceMatches,
    targetClassroom: value.target_classroom,
    action: value.action as PromotionPreviewRow["action"],
  };
}

export async function POST() {
  try {
    const session = await requireCaretakerApiSession();
    if ("response" in session) return session.response;

    const { data, error } = await session.supabase.rpc("get_association_member_promotion_preview", {
      p_session_token: session.token,
    });
    if (error) {
      if (error.message.includes("invalid_session")) {
        const response = NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
        response.cookies.delete("association_session");
        return response;
      }
      console.error("Could not load student promotion preview:", error.message);
      return NextResponse.json({ error: "ไม่สามารถอ่านทะเบียนนักเรียนเพื่อเตรียมเลื่อนชั้นได้" }, { status: 500 });
    }

    if (!Array.isArray(data)) {
      console.error("Supabase returned an invalid student promotion preview");
      return NextResponse.json({ error: "รูปแบบข้อมูลตรวจสอบห้องเรียนจากฐานข้อมูลไม่ถูกต้อง" }, { status: 500 });
    }

    const rows = data.map(parseRow);
    if (rows.some((row) => row === null)) {
      console.error("Supabase returned an invalid row in the student promotion preview");
      return NextResponse.json({ error: "ข้อมูลตรวจสอบห้องเรียนจากฐานข้อมูลไม่ครบถ้วน" }, { status: 500 });
    }
    const previewRows = (rows as PromotionPreviewRow[]).sort((left, right) =>
      left.memberId < right.memberId ? -1 : left.memberId > right.memberId ? 1 : 0,
    );
    const hashInput = previewRows
      .map((row) =>
        [
          row.memberId,
          row.studentId,
          row.childName,
          row.registryClassroom,
          row.sourceClassroom,
          String(row.sourceMatches),
        ].join("\t"),
      )
      .join("\n");
    const previewHash = createHash("sha256").update(hashInput, "utf8").digest("hex");

    return NextResponse.json({
      rows: previewRows,
      previewHash,
      promoted: previewRows.filter((row) => row.action === "promote").length,
      graduated: previewRows.filter((row) => row.action === "graduate").length,
      skipped: previewRows.filter((row) =>
        ["student_missing", "duplicate_student", "missing_class", "invalid_class"].includes(row.action),
      ).length,
      mismatched: previewRows.filter(
        (row) => row.sourceMatches === 1 && row.registryClassroom !== row.sourceClassroom,
      ).length,
    });
  } catch (error) {
    console.error("Could not initialize student promotion preview:", error);
    return NextResponse.json({ error: "ระบบฐานข้อมูลยังตั้งค่าไม่ครบ" }, { status: 500 });
  }
}
