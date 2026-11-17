import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function requireCaretakerApiSession() {
  const token = (await cookies()).get("association_session")?.value;
  if (!token) {
    return { response: NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 }) };
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("get_caretaker_session", {
    p_session_token: token,
  });
  if (error) {
    console.error("Could not verify caretaker before member management:", error.message);
    return { response: NextResponse.json({ error: "ไม่สามารถตรวจสอบสถานะเข้าสู่ระบบได้" }, { status: 500 }) };
  }

  if (!Array.isArray(data) || data.length === 0) {
    const response = NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    response.cookies.delete("association_session");
    return { response };
  }

  return { token, supabase };
}
