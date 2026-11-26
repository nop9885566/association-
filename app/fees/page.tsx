import DashboardShell from "@/app/dashboard-shell";
import MemberManagement from "@/app/member-management";

export default function FeesPage() {
  return (
    <DashboardShell activePage="fees">
      <section className="intro page-hero">
        <p className="eyebrow">FEE MANAGEMENT</p>
        <h1>จัดการรายการค่าบำรุง</h1>
        <p className="intro-copy">เพิ่มหรือแก้ไขรายการค่าบำรุงแยกตามรอบสมาชิก</p>
        <a className="primary-button fee-schedule-link" href="/fees/schedule">
          ตั้งค่าอัตราและรอบชำระ
        </a>
      </section>
      <MemberManagement />
    </DashboardShell>
  );
}
