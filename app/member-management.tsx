"use client";

import { FormEvent, useEffect, useState } from "react";

type Member = {
  id: string;
  cycleId: string;
  studentId: string;
  memberName: string;
  contactInfo: string;
  amount: number;
  status: string;
  note: string | null;
  createdAt: string;
  feeType: "membership" | "tuition" | null;
  academicYear: number | null;
  semester: number | null;
};

type Cycle = {
  id: string;
  memberCount: number;
};

type MemberForm = {
  cycleId: string;
  studentId: string;
  memberName: string;
  contactInfo: string;
  amount: string;
  note: string;
  feeType: "" | "membership" | "tuition";
  academicYear: string;
  semester: "" | "1" | "2";
};

const emptyForm: MemberForm = {
  cycleId: "",
  studentId: "",
  memberName: "",
  contactInfo: "",
  amount: "",
  note: "",
  feeType: "membership",
  academicYear: "2569",
  semester: "",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export default function MemberManagement() {
  const [members, setMembers] = useState<Member[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "submitted">("all");
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rateLoading, setRateLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<MemberForm>(emptyForm);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    const query = new URLSearchParams({ page: String(page) });
    if (statusFilter !== "all") query.set("status", statusFilter);
    fetch(`/api/fees/members?${query.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        const result: unknown = await response.json();
        if (response.status === 401) {
          window.location.replace("/login");
          return null;
        }
        if (!response.ok) {
          throw new Error(
            isRecord(result) && typeof result.error === "string"
              ? result.error
              : "โหลดข้อมูลสมาชิกไม่สำเร็จ",
          );
        }
        if (
          !isRecord(result) ||
          !Array.isArray(result.members) ||
          !Array.isArray(result.cycles) ||
          typeof result.hasMore !== "boolean" ||
          result.members.some(
            (member) =>
              !isRecord(member) ||
              typeof member.id !== "string" ||
              typeof member.cycleId !== "string" ||
              typeof member.studentId !== "string" ||
              typeof member.memberName !== "string" ||
              typeof member.contactInfo !== "string" ||
              typeof member.amount !== "number" ||
              typeof member.status !== "string" ||
              (member.note !== null && typeof member.note !== "string") ||
              (member.feeType !== null && member.feeType !== "membership" && member.feeType !== "tuition") ||
              (member.academicYear !== null && typeof member.academicYear !== "number") ||
              (member.semester !== null && typeof member.semester !== "number") ||
              typeof member.createdAt !== "string",
          ) ||
          result.cycles.some(
            (cycle) =>
              !isRecord(cycle) ||
              typeof cycle.id !== "string" ||
              typeof cycle.memberCount !== "number",
          )
        ) {
          throw new Error("รูปแบบข้อมูลสมาชิกไม่ถูกต้อง");
        }
        return result as { members: Member[]; cycles: Cycle[]; hasMore: boolean };
      })
      .then((result) => {
        if (!active || !result) return;
        setMembers(result.members);
        setCycles(result.cycles);
        setHasMore(result.hasMore);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "เกิดข้อผิดพลาดในการโหลดสมาชิก");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, reload, statusFilter]);

  function startNewCycle() {
    const id = crypto.randomUUID();
    setCycles((current) => [...current.filter((cycle) => cycle.id !== id), { id, memberCount: 0 }]);
    setForm((current) => ({ ...current, cycleId: id }));
    setMessage("สร้างรอบใหม่แล้ว รอบจะถูกบันทึกเมื่อเพิ่มสมาชิกคนแรก");
    setError("");
  }

  function editMember(member: Member) {
    setEditingId(member.id);
    setFormOpen(true);
    setForm({
      cycleId: member.cycleId,
      studentId: member.studentId,
      memberName: member.memberName,
      contactInfo: member.contactInfo,
      amount: String(member.amount),
      note: member.note || "",
      feeType: member.feeType || "",
      academicYear: member.academicYear ? String(member.academicYear) : "",
      semester: member.semester === 1 ? "1" : member.semester === 2 ? "2" : "",
    });
    setMessage("");
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setFormOpen(false);
    setForm((current) => ({ ...emptyForm, cycleId: current.cycleId }));
    setError("");
    setMessage("");
  }

  function startAddFeeItem() {
    setEditingId(null);
    setForm((current) => ({
      ...emptyForm,
      cycleId: current.cycleId || cycles[0]?.id || "",
    }));
    setFormOpen(true);
    setError("");
    setMessage("");
  }

  async function applyScheduleRate() {
    const academicYear = Number(form.academicYear);
    if (
      !Number.isSafeInteger(academicYear) ||
      academicYear < 2500 ||
      academicYear > 2700 ||
      !form.feeType ||
      (form.feeType === "tuition" && !form.semester)
    ) {
      setError("กรุณาเลือกประเภทค่าบำรุง ปีการศึกษา และภาคเรียนให้ครบ");
      return;
    }

    setRateLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/fees/schedule?academicYear=${academicYear}`, { cache: "no-store" });
      const result: unknown = await response.json();
      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }
      if (!response.ok) {
        throw new Error(
          isRecord(result) && typeof result.error === "string"
            ? result.error
            : "อ่านอัตราค่าบำรุงไม่สำเร็จ",
        );
      }
      if (!isRecord(result) || !isRecord(result.schedule)) {
        throw new Error("ยังไม่ได้กำหนดอัตราค่าบำรุงสำหรับปีการศึกษานี้");
      }

      const rateKey =
        form.feeType === "membership"
          ? "membershipAmount"
          : form.semester === "1"
            ? "semester1Amount"
            : "semester2Amount";
      const amount = Number(result.schedule[rateKey]);
      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error("อัตราค่าบำรุงที่บันทึกไว้ไม่ถูกต้อง");
      }

      setForm((current) => ({ ...current, amount: String(amount) }));
      setMessage(`นำอัตราปีการศึกษา ${academicYear} มาใส่ในรายการแล้ว`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "อ่านอัตราค่าบำรุงไม่สำเร็จ");
    } finally {
      setRateLoading(false);
    }
  }

  async function submitMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        editingId ? `/api/fees/members/${editingId}` : "/api/fees/members",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            amount: Number(form.amount),
            academicYear: Number(form.academicYear),
            semester: form.feeType === "membership" ? null : Number(form.semester),
          }),
        },
      );
      const result: unknown = await response.json();
      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }
      if (!response.ok) {
        throw new Error(
          isRecord(result) && typeof result.error === "string"
            ? result.error
            : "บันทึกข้อมูลสมาชิกไม่สำเร็จ",
        );
      }

      setMessage(editingId ? "แก้ไขรายการค่าบำรุงเรียบร้อยแล้ว" : "เพิ่มรายการค่าบำรุงเรียบร้อยแล้ว");
      setEditingId(null);
      setFormOpen(false);
      setForm((current) => ({ ...emptyForm, cycleId: current.cycleId }));
      setPage(1);
      setReload((current) => current + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "เกิดข้อผิดพลาดในการบันทึกสมาชิก");
    } finally {
      setSaving(false);
    }
  }

  async function deleteMember(member: Member) {
    if (!window.confirm(`ยืนยันลบสมาชิก ${member.memberName} (${member.studentId})?`)) return;
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/fees/members/${member.id}`, { method: "DELETE" });
      const result: unknown = await response.json();
      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }
      if (!response.ok) {
        throw new Error(
          isRecord(result) && typeof result.error === "string"
            ? result.error
            : "ลบสมาชิกไม่สำเร็จ",
        );
      }

      setMessage("ลบสมาชิกเรียบร้อยแล้ว");
      if (members.length === 1 && page > 1) setPage((current) => current - 1);
      else setReload((current) => current + 1);
      if (editingId === member.id) cancelEdit();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "เกิดข้อผิดพลาดในการลบสมาชิก");
    }
  }

  const statusLabels: Record<string, string> = {
    pending: "ยังไม่ชำระ",
    submitted: "ส่งหลักฐานแล้ว",
    waiting_for_review: "รอตรวจสอบ",
    rejected: "ไม่อนุมัติ · ค้างชำระ",
    approved: "ชำระแล้ว",
  };

  return (
    <section id="fee-management" className="members-section fee-management-section" aria-labelledby="members-heading">
      <div className="members-heading">
        <div>
          <p className="section-kicker">ข้อมูลตามรอบ · สถานะค่าบำรุง</p>
          <h2 id="members-heading">จัดการรายการค่าบำรุง</h2>
          <p>เพิ่ม แก้ไข หรือลบรายการค่าบำรุงรายสมาชิกในแต่ละรอบ</p>
        </div>
        <div className="directory-heading-actions">
          <span className="records-page">หน้า {page}</span>
          <button type="button" className="secondary-button add-member-button" onClick={startAddFeeItem}>
            <span aria-hidden="true">＋</span> เพิ่มรายการ
          </button>
        </div>
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}
      {message && <div className="success-banner" role="status">{message}</div>}

      {formOpen && (
      <form className="member-form member-editor" onSubmit={submitMember}>
        <div className="member-editor-heading">
          <div>
            <p className="section-kicker">{editingId ? "แก้ไขข้อมูล" : "เพิ่มข้อมูลใหม่"}</p>
            <h3>{editingId ? "แก้ไขรายการค่าบำรุง" : "เพิ่มรายการค่าบำรุง"}</h3>
          </div>
          <button type="button" className="icon-button" onClick={cancelEdit} aria-label="ปิดแบบฟอร์ม">
            ×
          </button>
        </div>
        <div className="member-form-grid">
          <label>
            ชื่อสมาชิก
            <input
              required
              maxLength={200}
              value={form.memberName}
              onChange={(event) => setForm({ ...form, memberName: event.target.value })}
              autoComplete="name"
            />
          </label>
          <label>
            รหัสนักเรียน
            <input
              required
              maxLength={100}
              value={form.studentId}
              onChange={(event) => setForm({ ...form, studentId: event.target.value })}
            />
          </label>
          <label>
            ช่องทางติดต่อ
            <input
              maxLength={200}
              value={form.contactInfo}
              onChange={(event) => setForm({ ...form, contactInfo: event.target.value })}
              placeholder="เช่น เบอร์โทรศัพท์"
              autoComplete="tel"
            />
          </label>
          <label>
            รอบค่าบำรุง
            <div className="member-cycle-control">
              <select
                required
                value={form.cycleId}
                onChange={(event) => setForm({ ...form, cycleId: event.target.value })}
              >
                <option value="">เลือกรอบค่าบำรุง</option>
                {form.cycleId && !cycles.some((cycle) => cycle.id === form.cycleId) && (
                  <option value={form.cycleId}>รอบ {form.cycleId} (ไม่มีสมาชิก)</option>
                )}
                {cycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {cycle.memberCount > 0
                      ? `รอบ ${cycle.id} (${cycle.memberCount} คน)`
                      : `รอบใหม่ ${cycle.id}`}
                  </option>
                ))}
              </select>
              <button type="button" className="secondary-button" onClick={startNewCycle}>
                สร้างรอบใหม่
              </button>
            </div>
          </label>
          <label>
            จำนวนเงิน (บาท)
            <div className="fee-amount-control">
              <input
                required
                type="number"
                min="0.01"
                max="9999999999.99"
                step="0.01"
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
              />
              <button
                type="button"
                className="secondary-button"
                onClick={applyScheduleRate}
                disabled={rateLoading}
              >
                {rateLoading ? "กำลังดึง..." : "ใช้อัตราที่ตั้งไว้"}
              </button>
            </div>
          </label>
          <label>
            ประเภทค่าธรรมเนียม
            <select
              required
              value={form.feeType}
              onChange={(event) => {
                const feeType: MemberForm["feeType"] =
                  event.target.value === "tuition"
                    ? "tuition"
                    : event.target.value === "membership"
                      ? "membership"
                      : "";
                setForm({ ...form, feeType, semester: feeType === "tuition" ? "1" : "" });
              }}
            >
              <option value="">เลือกประเภท</option>
              <option value="membership">ค่าสมัครสมาชิก</option>
              <option value="tuition">ค่าบำรุงรายภาคเรียน</option>
            </select>
          </label>
          <label>
            ปีการศึกษา (พ.ศ.)
            <input
              required
              type="number"
              min="2500"
              max="2700"
              step="1"
              value={form.academicYear}
              onChange={(event) => setForm({ ...form, academicYear: event.target.value })}
            />
          </label>
          {form.feeType === "tuition" && (
            <label>
              ภาคเรียน
              <select
                required
                value={form.semester}
                onChange={(event) => {
                  const semester: MemberForm["semester"] =
                    event.target.value === "1" || event.target.value === "2"
                      ? event.target.value
                      : "";
                  setForm({ ...form, semester });
                }}
              >
                <option value="1">ภาคเรียนที่ 1</option>
                <option value="2">ภาคเรียนที่ 2</option>
              </select>
            </label>
          )}
          <label className="member-note-field">
            หมายเหตุ
            <textarea
              maxLength={1000}
              rows={2}
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
            />
          </label>
        </div>
        <div className="member-form-actions">
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? "กำลังบันทึก..." : editingId ? "บันทึกการแก้ไข" : "เพิ่มรายการค่าบำรุง"}
          </button>
          {editingId && (
            <button type="button" className="secondary-button" onClick={cancelEdit} disabled={saving}>
              ยกเลิก
            </button>
          )}
        </div>
      </form>
      )}

      <div className="records-table-wrap member-table-wrap fee-table-wrap">
        <label className="member-search fee-status-filter">
          สถานะรายการ
          <select
            value={statusFilter}
            onChange={(event) => {
              const status: typeof statusFilter =
                event.target.value === "pending" || event.target.value === "submitted"
                  ? event.target.value
                  : "all";
              setStatusFilter(status);
              setPage(1);
            }}
          >
            <option value="all">ทั้งหมด</option>
            <option value="pending">ยังไม่อนุมัติ / ค้างชำระ</option>
            <option value="submitted">ส่งหลักฐานแล้ว</option>
          </select>
        </label>
        <table className="records-table members-table">
          <thead>
            <tr>
              <th>ชื่อสมาชิก</th>
              <th>รหัสนักเรียน</th>
              <th>ช่องทางติดต่อ</th>
              <th>รอบค่าบำรุง</th>
              <th>จำนวนเงิน</th>
              <th>ประเภท / ปี / ภาคเรียน</th>
              <th>สถานะ</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="records-empty">กำลังโหลดสมาชิก...</td></tr>
            ) : members.length === 0 ? (
              <tr><td colSpan={8} className="records-empty">ยังไม่มีข้อมูลสมาชิก</td></tr>
            ) : members.map((member) => (
              <tr key={member.id}>
                <td>{member.memberName || "—"}</td>
                <td>{member.studentId}</td>
                <td>{member.contactInfo || "—"}</td>
                <td><span className="member-cycle-id">{member.cycleId}</span></td>
                <td>{member.amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                <td>
                  {member.feeType === "membership"
                    ? `ค่าสมัคร · ${member.academicYear ?? "ไม่ระบุ"}`
                    : member.feeType === "tuition"
                      ? `ค่าบำรุง · ${member.academicYear ?? "ไม่ระบุ"} · ภาค ${member.semester ?? "—"}`
                      : "ยังไม่ระบุประเภท"}
                </td>
                <td>{statusLabels[member.status] || member.status}</td>
                <td>
                  <div className="member-row-actions">
                    <button type="button" className="text-button" onClick={() => editMember(member)}>
                      แก้ไข
                    </button>
                    <button type="button" className="text-button danger-button" onClick={() => deleteMember(member)}>
                      ลบ
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="records-pagination">
        <button type="button" onClick={() => setPage((current) => current - 1)} disabled={page <= 1 || loading}>
          ก่อนหน้า
        </button>
        <button type="button" onClick={() => setPage((current) => current + 1)} disabled={!hasMore || loading}>
          ถัดไป
        </button>
      </div>
      <p className="member-delete-note">สมาชิกที่มีประวัติการชำระเงินจะไม่สามารถลบได้ เพื่อรักษาประวัติเดิม</p>
    </section>
  );
}
