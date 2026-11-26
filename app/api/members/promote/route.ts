import { NextResponse } from "next/server";
import { requireCaretakerApiSession } from "@/lib/caretaker-api-session";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCount(value: unknown): boolean {
  const count = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(count) && count >= 0;
}

export async function POST(request: Request) {
  try {
    const session = await requireCaretakerApiSession();
    if ("response" in session) return session.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "คำขอยืนยันเลื่อนชั้นไม่ถูกต้อง" }, { status: 400 });
    }
    if (
      !isRecord(body) ||
      typeof body.previewHash !== "string" ||
      !/^[0-9a-f]{64}$/.test(body.previewHash)
    ) {
      return NextResponse.json({ error: "กรุณาตรวจสอบรายชื่อก่อนยืนยันเลื่อนชั้น" }, { status: 400 });
    }

    const { data, error } = await session.supabase.rpc("promote_association_members", {
      p_session_token: session.token,
      p_expected_preview_hash: body.previewHash,
    });
    if (error) {
      if (error.message.includes("invalid_session")) {
        const response = NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
        response.cookies.delete("association_session");
        return response;
      }
      if (error.message.includes("stale_promotion_preview")) {
        return NextResponse.json(
          { error: "ข้อมูลห้องเรียนเปลี่ยนหลังจากเปิดหน้าตรวจสอบ กรุณาปิดแล้วตรวจสอบรายชื่อใหม่อีกครั้ง" },
          { status: 409 },
        );
      }
      console.error("Could not promote association members:", error.message);
      return NextResponse.json({ error: "ไม่สามารถเลื่อนชั้นนักเรียนได้" }, { status: 500 });
    }

    const result = Array.isArray(data) ? data[0] : null;
    if (
      !result ||
      !isCount(result.promoted_count) ||
      !isCount(result.graduated_count) ||
      !isCount(result.skipped_count)
    ) {
      console.error("Supabase returned an invalid student promotion result");
      return NextResponse.json({ error: "รูปแบบผลการเลื่อนชั้นจากฐานข้อมูลไม่ถูกต้อง" }, { status: 500 });
    }

    return NextResponse.json({
      promoted: Number(result.promoted_count),
      graduated: Number(result.graduated_count),
      skipped: Number(result.skipped_count),
    });
  } catch (error) {
    console.error("Could not initialize student promotion:", error);
    return NextResponse.json({ error: "ระบบฐานข้อมูลยังตั้งค่าไม่ครบ" }, { status: 500 });
  }
}
