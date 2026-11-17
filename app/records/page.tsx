import DashboardShell from "@/app/dashboard-shell";
import PaymentComparison from "@/app/payment-comparison";

export default function RecordsPage() {
  return (
    <DashboardShell activePage="records">
      <PaymentComparison />
    </DashboardShell>
  );
}
