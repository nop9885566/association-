import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

type Caretaker = {
  id: string;
  name: string;
};

export async function GET() {
  try {
    const { data, error } = await getSupabase().rpc("list_caretakers_for_login");

    if (error) {
      console.error("Could not load caretaker login list:", error.message);
      return NextResponse.json({ error: "ไม่สามารถโหลดรายชื่อผู้ดูแลได้" }, { status: 500 });
    }

    if (
      !Array.isArray(data) ||
      data.some(
        (row) =>
          typeof row.id !== "string" ||
          typeof row.name !== "string" ||
          Object.keys(row).some((key) => key !== "id" && key !== "name"),
      )
    ) {
      console.error("Supabase returned an invalid caretaker login list");
      return NextResponse.json({ error: "รูปแบบรายชื่อผู้ดูแลไม่ถูกต้อง" }, { status: 500 });
    }

    return NextResponse.json(data as Caretaker[]);
  } catch (error) {
    console.error("Could not initialize caretaker login list:", error);
    return NextResponse.json({ error: "ระบบฐานข้อมูลยังตั้งค่าไม่ครบ" }, { status: 500 });
  }
}
