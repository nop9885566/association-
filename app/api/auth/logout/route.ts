import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST() {
  const token = (await cookies()).get("association_session")?.value;
  let errorMessage = "";

  if (token) {
    try {
      const { error } = await getSupabase().rpc("revoke_caretaker_session", {
        p_session_token: token,
      });

      if (error) {
        console.error("Could not revoke caretaker session:", error.message);
        errorMessage = "ออกจากระบบไม่สมบูรณ์ กรุณาลองอีกครั้ง";
      }
    } catch (error) {
      console.error("Could not initialize caretaker session revocation:", error);
      errorMessage = "ระบบฐานข้อมูลยังตั้งค่าไม่ครบ";
    }
  }

  const response = NextResponse.json(
    errorMessage ? { error: errorMessage } : { ok: true },
    { status: errorMessage ? 500 : 200 },
  );
  response.cookies.delete("association_session");
  return response;
}
