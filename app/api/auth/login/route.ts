import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลคำขอไม่ถูกต้อง" }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "ข้อมูลคำขอไม่ถูกต้อง" }, { status: 400 });
  }

  const { caretakerId, pin } = body;
  if (
    typeof caretakerId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(caretakerId) ||
    typeof pin !== "string" ||
    !/^[0-9]{4,6}$/.test(pin)
  ) {
    return NextResponse.json({ error: "กรุณาเลือกผู้ดูแลและกรอก PIN 4–6 หลัก" }, { status: 400 });
  }

  try {
    const { data, error } = await getSupabase().rpc("verify_caretaker_pin", {
      p_caretaker_id: caretakerId,
      p_pin: pin,
    });

    if (error) {
      console.error("Could not verify caretaker PIN:", error.message);
      return NextResponse.json({ error: "ไม่สามารถตรวจสอบ PIN ได้" }, { status: 500 });
    }

    const caretaker = Array.isArray(data) ? data[0] : null;
    if (
      !caretaker ||
      typeof caretaker.id !== "string" ||
      typeof caretaker.name !== "string" ||
      typeof caretaker.session_token !== "string" ||
      !/^[0-9a-f]{64}$/.test(caretaker.session_token) ||
      Object.keys(caretaker).some((key) => key !== "id" && key !== "name" && key !== "session_token")
    ) {
      return NextResponse.json({ error: "ชื่อผู้ดูแลหรือ PIN ไม่ถูกต้อง" }, { status: 401 });
    }

    const response = NextResponse.json({ id: caretaker.id, name: caretaker.name });
    response.cookies.set("association_session", caretaker.session_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 8 * 60 * 60,
    });
    return response;
  } catch (error) {
    console.error("Could not initialize caretaker PIN verification:", error);
    return NextResponse.json({ error: "ระบบฐานข้อมูลยังตั้งค่าไม่ครบ" }, { status: 500 });
  }
}
