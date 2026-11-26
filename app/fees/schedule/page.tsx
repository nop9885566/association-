import DashboardShell from "@/app/dashboard-shell";
import FeeScheduleSettings from "@/app/fee-schedule-settings";

export default function FeeSchedulePage() {
  return (
    <DashboardShell activePage="fees">
      <FeeScheduleSettings />
    </DashboardShell>
  );
}
