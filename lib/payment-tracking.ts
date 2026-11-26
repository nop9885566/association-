export type PaymentStatus = "paid" | "partial" | "review" | "rejected" | "pending" | "missing";

export type PaymentTrackingRow = {
  studentId: string;
  childName: string;
  classroom: string;
  guardianNames: string;
  membershipTotal: number;
  membershipPaid: number;
  membershipItemCount: number;
  membershipWaiting: boolean;
  membershipRejected: boolean;
  semester1Total: number;
  semester1Paid: number;
  semester1ItemCount: number;
  semester1Waiting: boolean;
  semester1Rejected: boolean;
  semester2Total: number;
  semester2Paid: number;
  semester2ItemCount: number;
  semester2Waiting: boolean;
  semester2Rejected: boolean;
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  paid: "ชำระครบ",
  partial: "ชำระบางส่วน",
  review: "รอตรวจสอบ",
  rejected: "ไม่อนุมัติ · ค้างชำระ",
  pending: "ค้างชำระ",
  missing: "ยังไม่มีรายการ",
};

export function getPaymentStatus(
  count: number,
  paid: number,
  total: number,
  waiting: boolean,
  rejected: boolean,
): PaymentStatus {
  if (count === 0) return "missing";
  if (paid >= total) return "paid";
  if (waiting) return "review";
  if (paid > 0) return "partial";
  if (rejected) return "rejected";
  return "pending";
}
