import DashboardShell from "@/app/dashboard-shell";
import MemberManagement from "@/app/member-management";

export default function FeesPage() {
  return (
    <DashboardShell activePage="fees">
      <section className="intro page-hero">
        <p className="eyebrow">FEE MANAGEMENT</p>
        <h1>จัดการรายการค่าบำรุง</h1>
        <p className="intro-copy">เพิ่มหรือแก้ไขรายการค่าบำรุงแยกตามรอบสมาชิก</p>
      </section>
      <MemberManagement />
    </DashboardShell>
  );
}
