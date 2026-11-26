import DashboardShell from "@/app/dashboard-shell";
import MemberDirectory from "@/app/member-directory";

export default function MembersPage() {
  return (
    <DashboardShell activePage="members">
      <section className="intro hero">
        <div>
          <p className="eyebrow">ASSOCIATION · MEMBER DIRECTORY</p>
          <h1>ทะเบียนสมาชิก</h1>
          <p className="intro-copy">จัดการข้อมูลสมาชิกและค้นหาจากชื่อนักเรียน ผู้ปกครอง หรือรหัสนักเรียน</p>
        </div>
        <div className="hero-status"><span /> พื้นที่ผู้ดูแลระบบ</div>
      </section>
      <MemberDirectory />
    </DashboardShell>
  );
}
