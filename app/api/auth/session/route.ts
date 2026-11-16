import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const token = (await cookies()).get("association_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  try {
    const { data, error } = await getSupabase().rpc("get_caretaker_session", {
      p_session_token: token,
    });

    if (error) {
      console.error("Could not verify caretaker session:", error.message);
      return NextResponse.json({ error: "ไม่สามารถตรวจสอบสถานะเข้าสู่ระบบได้" }, { status: 500 });
    }

    const caretaker = Array.isArray(data) ? data[0] : null;
    if (!caretaker || typeof caretaker.id !== "string" || typeof caretaker.name !== "string") {
      const response = NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
      response.cookies.delete("association_session");
      return response;
    }

    return NextResponse.json({ id: caretaker.id, name: caretaker.name });
  } catch (error) {
    console.error("Could not initialize caretaker session verification:", error);
    return NextResponse.json({ error: "ระบบฐานข้อมูลยังตั้งค่าไม่ครบ" }, { status: 500 });
  }
}
