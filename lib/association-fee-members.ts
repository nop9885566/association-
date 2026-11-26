export const associationFeeMemberIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AssociationFeeMemberInput = {
  cycleId: string;
  studentId: string;
  memberName: string;
  contactInfo: string;
  amount: number;
  note: string;
  feeType: "membership" | "tuition";
  academicYear: number;
  semester: 1 | 2 | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isAssociationFeeMemberInput(value: unknown): value is AssociationFeeMemberInput {
  if (!isRecord(value)) return false;
  const input = value;

  return (
    typeof input.cycleId === "string" &&
    associationFeeMemberIdPattern.test(input.cycleId) &&
    typeof input.studentId === "string" &&
    input.studentId.trim().length > 0 &&
    input.studentId.trim().length <= 100 &&
    typeof input.memberName === "string" &&
    input.memberName.trim().length > 0 &&
    input.memberName.trim().length <= 200 &&
    typeof input.contactInfo === "string" &&
    input.contactInfo.length <= 200 &&
    typeof input.amount === "number" &&
    Number.isFinite(input.amount) &&
    input.amount > 0 &&
    input.amount <= 9999999999.99 &&
    Math.round(input.amount * 100) / 100 === input.amount &&
    typeof input.note === "string" &&
    input.note.length <= 1000 &&
    (input.feeType === "membership" || input.feeType === "tuition") &&
    typeof input.academicYear === "number" &&
    Number.isInteger(input.academicYear) &&
    input.academicYear >= 2500 &&
    input.academicYear <= 2700 &&
    ((input.feeType === "membership" && input.semester === null) ||
      (input.feeType === "tuition" && (input.semester === 1 || input.semester === 2)))
  );
}
