import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("get_association_fee_summary");

    if (error) {
      console.error("Could not load association fee summary:", error.message);
      return NextResponse.json({ error: "ไม่สามารถอ่านข้อมูลสรุปจากฐานข้อมูลได้" }, { status: 500 });
    }

    const summary = Array.isArray(data) ? data[0] : null;
    const fields = [
      "fee_total",
      "fee_pending",
      "fee_submitted",
      "submission_total",
      "submission_latest",
      "submission_waiting",
      "submission_approved",
      "submission_rejected",
    ] as const;
    if (!summary || fields.some((field) => !Number.isSafeInteger(summary[field]) || summary[field] < 0)) {
      console.error("Supabase returned an invalid association fee summary");
      return NextResponse.json({ error: "รูปแบบข้อมูลสรุปจากฐานข้อมูลไม่ถูกต้อง" }, { status: 500 });
    }

    return NextResponse.json({
      feeTotal: summary.fee_total,
      feePending: summary.fee_pending,
      feeSubmitted: summary.fee_submitted,
      submissionTotal: summary.submission_total,
      submissionLatest: summary.submission_latest,
      submissionWaiting: summary.submission_waiting,
      submissionApproved: summary.submission_approved,
      submissionRejected: summary.submission_rejected,
    });
  } catch (error) {
    console.error("Could not initialize Supabase:", error);
    return NextResponse.json({ error: "ระบบฐานข้อมูลยังตั้งค่าไม่ครบ" }, { status: 500 });
  }
}
