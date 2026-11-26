export const associationMemberIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const associationClassroomOptions = [
  "อ.1",
  "อ.2",
  "อ.3",
  "ป.1",
  "ป.2",
  "ป.3",
  "ป.4",
  "ป.5",
  "ป.6",
] as const;

export type AssociationMemberInput = {
  familyId: string;
  studentId: string;
  parent1Name: string;
  parent2Name: string;
  childName: string;
  classroom: string;
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
    typeof value.parent1Name === "string" &&
    value.parent1Name.trim().length > 0 &&
    value.parent1Name.trim().length <= 200 &&
    typeof value.parent2Name === "string" &&
    value.parent2Name.length <= 200 &&
    (!value.parent2Name.trim() || value.parent2Name.trim() !== value.parent1Name.trim()) &&
    typeof value.childName === "string" &&
    value.childName.trim().length > 0 &&
    value.childName.trim().length <= 200 &&
    typeof value.classroom === "string" &&
    value.classroom.length <= 100 &&
    typeof value.isActive === "boolean"
  );
}
