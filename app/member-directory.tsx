"use client";

import { FormEvent, useEffect, useState } from "react";

type AssociationMember = {
  id: string;
  familyId: string;
  studentId: string;
  fatherName: string;
  motherName: string;
  guardianName: string;
  childName: string;
  isActive: boolean;
  hasFeeRecords: boolean;
  createdAt: string;
};

type Family = {
  id: string;
  memberCount: number;
};

type MemberForm = {
  familyId: string;
  studentId: string;
  fatherName: string;
  motherName: string;
  guardianName: string;
  childName: string;
  isActive: boolean;
};

const emptyForm: MemberForm = {
  familyId: "",
  studentId: "",
  fatherName: "",
  motherName: "",
  guardianName: "",
  childName: "",
  isActive: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export default function MemberDirectory() {
  const [members, setMembers] = useState<AssociationMember[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingHasFeeRecords, setEditingHasFeeRecords] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<MemberForm>(emptyForm);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchText.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchText]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    const query = new URLSearchParams({ page: String(page) });
    if (search) query.set("q", search);
    fetch(`/api/members?${query.toString()}`, { cache: "no-store" })
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
              : "โหลดทะเบียนสมาชิกไม่สำเร็จ",
          );
        }
        if (
          !isRecord(result) ||
          !Array.isArray(result.members) ||
          !Array.isArray(result.families) ||
          typeof result.hasMore !== "boolean" ||
          result.members.some(
            (member) =>
              !isRecord(member) ||
              typeof member.id !== "string" ||
              typeof member.familyId !== "string" ||
              typeof member.studentId !== "string" ||
              typeof member.fatherName !== "string" ||
              typeof member.motherName !== "string" ||
              typeof member.guardianName !== "string" ||
              typeof member.childName !== "string" ||
              typeof member.isActive !== "boolean" ||
              typeof member.hasFeeRecords !== "boolean" ||
              typeof member.createdAt !== "string",
          ) ||
          result.families.some(
            (family) =>
              !isRecord(family) ||
              typeof family.id !== "string" ||
              typeof family.memberCount !== "number",
          )
        ) {
          throw new Error("รูปแบบทะเบียนสมาชิกไม่ถูกต้อง");
        }
        return result as {
          members: AssociationMember[];
          families: Family[];
          hasMore: boolean;
        };
      })
      .then((result) => {
        if (!active || !result) return;
        setMembers(result.members);
        setFamilies(result.families);
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
  }, [page, reload, search]);

  function createFamily() {
    const id = crypto.randomUUID();
    setFamilies((current) => [...current.filter((family) => family.id !== id), { id, memberCount: 0 }]);
    setForm((current) => ({ ...current, familyId: id }));
    setMessage("สร้างกลุ่มครอบครัวใหม่แล้ว");
    setError("");
  }

  function editMember(member: AssociationMember) {
    setEditingId(member.id);
    setEditingHasFeeRecords(member.hasFeeRecords);
    setFormOpen(true);
    setForm({
      familyId: member.familyId,
      studentId: member.studentId,
      fatherName: member.fatherName,
      motherName: member.motherName,
      guardianName: member.guardianName,
      childName: member.childName,
      isActive: member.isActive,
    });
    setMessage("");
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingHasFeeRecords(false);
    setFormOpen(false);
    setForm((current) => ({ ...emptyForm, familyId: current.familyId }));
    setError("");
    setMessage("");
  }

  function startAddMember() {
    setEditingId(null);
    setEditingHasFeeRecords(false);
    setForm((current) => ({
      ...emptyForm,
      familyId: current.familyId || families[0]?.id || "",
    }));
    setFormOpen(true);
    setError("");
    setMessage("");
  }

  async function submitMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        editingId ? `/api/members/${editingId}` : "/api/members",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
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

      setMessage(editingId ? "แก้ไขข้อมูลสมาชิกเรียบร้อยแล้ว" : "เพิ่มสมาชิกเรียบร้อยแล้ว");
      setEditingId(null);
      setEditingHasFeeRecords(false);
      setFormOpen(false);
      setForm((current) => ({ ...emptyForm, familyId: current.familyId }));
      setPage(1);
      setReload((current) => current + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "เกิดข้อผิดพลาดในการบันทึกสมาชิก");
    } finally {
      setSaving(false);
    }
  }

  async function deleteMember(member: AssociationMember) {
    if (!window.confirm(`ยืนยันลบข้อมูล ${member.childName} (${member.studentId})?`)) return;
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/members/${member.id}`, { method: "DELETE" });
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

      setMessage("ลบข้อมูลสมาชิกเรียบร้อยแล้ว");
      if (members.length === 1 && page > 1) setPage((current) => current - 1);
      else setReload((current) => current + 1);
      if (editingId === member.id) cancelEdit();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "เกิดข้อผิดพลาดในการลบสมาชิก");
    }
  }

  return (
    <section id="member-directory" className="members-section directory-section" aria-labelledby="directory-heading">
      <div className="members-heading">
        <div>
          <p className="section-kicker">ข้อมูลหลัก · 1 รายการต่อเด็ก</p>
          <h2 id="directory-heading">ทะเบียนสมาชิก</h2>
          <p>ข้อมูลเด็กและผู้ปกครอง เชื่อมกับรายการค่าบำรุงด้วยรหัสนักเรียน</p>
        </div>
        <div className="directory-heading-actions">
          <span className="records-page">หน้า {page}</span>
          <button type="button" className="primary-button add-member-button" onClick={startAddMember}>
            <span aria-hidden="true">＋</span> เพิ่มสมาชิก
          </button>
        </div>
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}
      {message && <div className="success-banner" role="status">{message}</div>}

      <div className="directory-toolbar">
        <label className="member-search">
          <svg aria-hidden="true" viewBox="0 0 20 20">
            <circle cx="8.8" cy="8.8" r="5.6" />
            <path d="m13 13 4 4" />
          </svg>
          <input
            type="search"
            value={searchText}
            maxLength={100}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="ค้นหาชื่อเด็ก ผู้ปกครอง หรือรหัสนักเรียน"
            aria-label="ค้นหาสมาชิก"
          />
          {searchText && (
            <button type="button" onClick={() => setSearchText("")} aria-label="ล้างคำค้นหา">
              ×
            </button>
          )}
        </label>
        <span className="directory-search-hint">
          {search ? `ผลการค้นหา: ${search}` : "ค้นหาได้จากชื่อเด็ก ชื่อผู้ปกครอง และรหัสนักเรียน"}
        </span>
      </div>

      {formOpen && (
      <form className="member-form member-editor" onSubmit={submitMember}>
        <div className="member-editor-heading">
          <div>
            <p className="section-kicker">{editingId ? "แก้ไขข้อมูล" : "เพิ่มข้อมูลใหม่"}</p>
            <h3>{editingId ? "แก้ไขข้อมูลสมาชิก" : "เพิ่มสมาชิก"}</h3>
          </div>
          <button type="button" className="icon-button" onClick={cancelEdit} aria-label="ปิดแบบฟอร์ม">
            ×
          </button>
        </div>
        <div className="member-form-grid">
          <label>
            ชื่อเด็ก
            <input
              required
              maxLength={200}
              value={form.childName}
              onChange={(event) => setForm({ ...form, childName: event.target.value })}
            />
          </label>
          <label>
            รหัสนักเรียน
            <input
              required
              maxLength={100}
              value={form.studentId}
              disabled={editingHasFeeRecords}
              onChange={(event) => setForm({ ...form, studentId: event.target.value })}
            />
            {editingHasFeeRecords && <small>เปลี่ยนรหัสไม่ได้ เนื่องจากมีรายการค่าบำรุงผูกอยู่</small>}
          </label>
          <label>
            ชื่อพ่อ
            <input
              maxLength={200}
              value={form.fatherName}
              onChange={(event) => setForm({ ...form, fatherName: event.target.value })}
            />
          </label>
          <label>
            ชื่อแม่
            <input
              maxLength={200}
              value={form.motherName}
              onChange={(event) => setForm({ ...form, motherName: event.target.value })}
            />
          </label>
          <label>
            ชื่อ guardian
            <input
              maxLength={200}
              value={form.guardianName}
              onChange={(event) => setForm({ ...form, guardianName: event.target.value })}
            />
          </label>
          <label>
            ครอบครัว
            <div className="member-cycle-control">
              <select
                required
                value={form.familyId}
                onChange={(event) => setForm({ ...form, familyId: event.target.value })}
              >
                <option value="">เลือกครอบครัว</option>
                {form.familyId && !families.some((family) => family.id === form.familyId) && (
                  <option value={form.familyId}>กลุ่มใหม่ · {form.familyId.slice(0, 8)}</option>
                )}
                {families.map((family) => (
                  <option key={family.id} value={family.id}>
                    กลุ่ม {family.id.slice(0, 8)} · {family.memberCount} คน
                  </option>
                ))}
              </select>
              <button type="button" className="secondary-button" onClick={createFamily}>
                สร้างกลุ่มใหม่
              </button>
            </div>
          </label>
          <label className="member-active-field">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
            />
            สมาชิกที่ใช้งานอยู่
          </label>
        </div>
        <div className="member-form-actions">
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? "กำลังบันทึก..." : editingId ? "บันทึกการแก้ไข" : "เพิ่มสมาชิก"}
          </button>
          {editingId && (
            <button type="button" className="secondary-button" onClick={cancelEdit} disabled={saving}>
              ยกเลิก
            </button>
          )}
        </div>
      </form>
      )}

      <div className="records-table-wrap member-table-wrap directory-table-wrap">
        <table className="records-table directory-table">
          <thead>
            <tr>
              <th>ผู้ปกครอง</th>
              <th>นักเรียน</th>
              <th>รหัสนักเรียน</th>
              <th>ค่าบำรุง</th>
              <th>สถานะ</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="records-empty">กำลังโหลดทะเบียนสมาชิก...</td></tr>
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={6} className="records-empty">
                  {search ? `ไม่พบสมาชิกที่ตรงกับ “${search}”` : "ยังไม่มีข้อมูลสมาชิก"}
                </td>
              </tr>
            ) : members.map((member) => (
              <tr key={member.id}>
                <td>
                  <div className="directory-parent-cell">
                    <span className="directory-avatar" aria-hidden="true">
                      {(member.fatherName || member.motherName || member.guardianName || "ส").charAt(0)}
                    </span>
                    <div className="directory-parent-names">
                      {member.fatherName && <span><small>พ่อ</small>{member.fatherName}</span>}
                      {member.motherName && <span><small>แม่</small>{member.motherName}</span>}
                      {member.guardianName && <span><small>ผู้ปกครอง</small>{member.guardianName}</span>}
                      {!member.fatherName && !member.motherName && !member.guardianName && <span>ไม่ระบุผู้ปกครอง</span>}
                    </div>
                  </div>
                </td>
                <td>
                  <strong className="directory-child-name">{member.childName}</strong>
                </td>
                <td>{member.studentId}</td>
                <td>
                  <span className={`directory-fee-status ${member.hasFeeRecords ? "linked" : "unlinked"}`}>
                    <span aria-hidden="true">{member.hasFeeRecords ? "✓" : "·"}</span>
                    {member.hasFeeRecords ? "มีรายการ" : "ยังไม่มี"}
                  </span>
                </td>
                <td>
                  <span className={`directory-status ${member.isActive ? "active" : "inactive"}`}>
                    {member.isActive ? "ใช้งาน" : "ไม่ใช้งาน"}
                  </span>
                </td>
                <td>
                  <div className="member-row-actions">
                    <button
                      type="button"
                      className="directory-action edit-action"
                      onClick={() => editMember(member)}
                      aria-label={`แก้ไข ${member.childName}`}
                      title="แก้ไข"
                    >
                      <svg aria-hidden="true" viewBox="0 0 20 20">
                        <path d="M13.8 3.2a1.7 1.7 0 0 1 2.4 2.4L7 14.8l-3.3.8.8-3.3 9.3-9.1Z" />
                        <path d="m12.4 4.6 3 3" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="directory-action delete-action"
                      onClick={() => deleteMember(member)}
                      aria-label={`ลบ ${member.childName}`}
                      title="ลบ"
                    >
                      <svg aria-hidden="true" viewBox="0 0 20 20">
                        <path d="M4.5 6h11l-.8 10.5H5.3L4.5 6Z" />
                        <path d="M3.5 4.5h13M8 4.5V3h4v1.5m-3 4v5m2-5v5" />
                      </svg>
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
      <p className="member-delete-note"><span aria-hidden="true">ⓘ</span> ลบข้อมูลไม่ได้หากมีรายการค่าบำรุงผูกกับรหัสนักเรียนนี้ เพื่อรักษาประวัติเดิม</p>
    </section>
  );
}
