import DashboardShell from "@/app/dashboard-shell";
import PaymentComparison from "@/app/payment-comparison";

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string | string[] }>;
}) {
  const { studentId } = await searchParams;
  return (
    <DashboardShell activePage="records">
      <PaymentComparison studentId={Array.isArray(studentId) ? studentId[0] : studentId ?? ""} />
    </DashboardShell>
  );
}
