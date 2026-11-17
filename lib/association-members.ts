export const associationMemberIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AssociationMemberInput = {
  familyId: string;
  studentId: string;
  fatherName: string;
  motherName: string;
  guardianName: string;
  childName: string;
  isActive: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isAssociationMemberInput(value: unknown): value is AssociationMemberInput {
  if (!isRecord(value)) return false;

  return (
    typeof value.familyId === "string" &&
    associationMemberIdPattern.test(value.familyId) &&
    typeof value.studentId === "string" &&
    value.studentId.trim().length > 0 &&
    value.studentId.trim().length <= 100 &&
    typeof value.fatherName === "string" &&
    value.fatherName.length <= 200 &&
    typeof value.motherName === "string" &&
    value.motherName.length <= 200 &&
    typeof value.guardianName === "string" &&
    value.guardianName.length <= 200 &&
    typeof value.childName === "string" &&
    value.childName.trim().length > 0 &&
    value.childName.trim().length <= 200 &&
    typeof value.isActive === "boolean"
  );
}
