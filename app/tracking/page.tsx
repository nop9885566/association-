import DashboardShell from "@/app/dashboard-shell";
import PendingPaymentTracking from "@/app/pending-payment-tracking";

export default function PaymentTrackingPage() {
  return (
    <DashboardShell activePage="tracking">
      <PendingPaymentTracking />
    </DashboardShell>
  );
}
