"use client";

import { FormEvent, useEffect, useState } from "react";
import { associationClassroomOptions } from "@/lib/association-members";

type AssociationMember = {
  id: string;
  familyId: string;
  studentId: string;
  parent1Name: string;
  parent2Name: string;
  hasExtraParentNames: boolean;
  childName: string;
  classroom: string;
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
  parent1Name: string;
  parent2Name: string;
  childName: string;
  classroom: string;
  isActive: boolean;
};

type PromotionPreviewRow = {
  memberId: string;
  studentId: string;
  childName: string;
  registryClassroom: string;
  sourceClassroom: string;
  sourceMatches: number;
  targetClassroom: string | null;
  action: "promote" | "graduate" | "student_missing" | "duplicate_student" | "missing_class" | "invalid_class";
};

type PromotionPreview = {
  rows: PromotionPreviewRow[];
  previewHash: string;
  promoted: number;
  graduated: number;
  skipped: number;
  mismatched: number;
};

type PromotionFilter = "all" | "mismatched" | "skipped";

const emptyForm: MemberForm = {
  familyId: "",
  studentId: "",
  parent1Name: "",
  parent2Name: "",
  childName: "",
  classroom: "",
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
  const [classroomFilter, setClassroomFilter] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [loadingPromotionPreview, setLoadingPromotionPreview] = useState(false);
  const [promotionPreview, setPromotionPreview] = useState<PromotionPreview | null>(null);
  const [promotionFilter, setPromotionFilter] = useState<PromotionFilter>("all");
  const [promotionAcknowledged, setPromotionAcknowledged] = useState(false);
  const [promotionError, setPromotionError] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingHasFeeRecords, setEditingHasFeeRecords] = useState(false);
  const [editingHasExtraParentNames, setEditingHasExtraParentNames] = useState(false);
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
    if (classroomFilter) query.set("classroom", classroomFilter);
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
              typeof member.parent1Name !== "string" ||
              typeof member.parent2Name !== "string" ||
              typeof member.hasExtraParentNames !== "boolean" ||
              typeof member.childName !== "string" ||
              typeof member.classroom !== "string" ||
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
  }, [classroomFilter, page, reload, search]);

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
    setEditingHasExtraParentNames(member.hasExtraParentNames);
    setFormOpen(true);
    setForm({
      familyId: member.familyId,
      studentId: member.studentId,
      parent1Name: member.parent1Name,
      parent2Name: member.parent2Name,
      childName: member.childName,
      classroom: member.classroom,
      isActive: member.isActive,
    });
    setMessage("");
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingHasFeeRecords(false);
    setEditingHasExtraParentNames(false);
    setFormOpen(false);
    setForm((current) => ({ ...emptyForm, familyId: current.familyId }));
    setError("");
    setMessage("");
  }

  function startAddMember() {
    setEditingId(null);
    setEditingHasFeeRecords(false);
    setEditingHasExtraParentNames(false);
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
    if (
      editingHasExtraParentNames &&
      !window.confirm("ข้อมูลเดิมมีชื่อผู้ปกครองมากกว่า 2 คน การบันทึกจะเก็บไว้เฉพาะ 2 ชื่อแรก ต้องการดำเนินการต่อหรือไม่?")
    ) return;
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
      setEditingHasExtraParentNames(false);
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

  async function promoteStudents() {
    setLoadingPromotionPreview(true);
    setError("");
    setMessage("");
    setPromotionError("");
    setPromotionAcknowledged(false);
    try {
      const response = await fetch("/api/members/promote/preview", {
        method: "POST",
        cache: "no-store",
      });
      const result: unknown = await response.json();
      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }
      if (!response.ok) {
        throw new Error(
          isRecord(result) && typeof result.error === "string"
            ? result.error
            : "ตรวจสอบรายชื่อนักเรียนไม่สำเร็จ",
        );
      }
      if (
        !isRecord(result) ||
        !Array.isArray(result.rows) ||
        result.rows.some(
          (row) =>
            !isRecord(row) ||
            typeof row.memberId !== "string" ||
            typeof row.studentId !== "string" ||
            typeof row.childName !== "string" ||
            typeof row.registryClassroom !== "string" ||
            typeof row.sourceClassroom !== "string" ||
            typeof row.sourceMatches !== "number" ||
            (row.targetClassroom !== null && typeof row.targetClassroom !== "string") ||
            !["promote", "graduate", "student_missing", "duplicate_student", "missing_class", "invalid_class"].includes(
              String(row.action),
            ),
        ) ||
        typeof result.previewHash !== "string" ||
        !/^[0-9a-f]{64}$/.test(result.previewHash) ||
        typeof result.promoted !== "number" ||
        typeof result.graduated !== "number" ||
        typeof result.skipped !== "number" ||
        typeof result.mismatched !== "number"
      ) {
        throw new Error("รูปแบบข้อมูลตรวจสอบห้องเรียนไม่ถูกต้อง");
      }

      setPromotionPreview(result as PromotionPreview);
      setPromotionFilter("all");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ตรวจสอบรายชื่อนักเรียนไม่สำเร็จ");
    } finally {
      setLoadingPromotionPreview(false);
    }
  }

  async function applyPromotion() {
    if (!promotionPreview || !promotionAcknowledged) return;

    setPromoting(true);
    setError("");
    setPromotionError("");
    try {
      const response = await fetch("/api/members/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previewHash: promotionPreview.previewHash }),
      });
      const result: unknown = await response.json();
      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }
      if (!response.ok) {
        const message = isRecord(result) && typeof result.error === "string"
          ? result.error
          : "เลื่อนชั้นนักเรียนไม่สำเร็จ";
        if (response.status === 409) {
          setPromotionPreview(null);
          setPromotionAcknowledged(false);
        }
        throw new Error(message);
      }
      if (
        !isRecord(result) ||
        typeof result.promoted !== "number" ||
        typeof result.graduated !== "number" ||
        typeof result.skipped !== "number"
      ) {
        throw new Error("รูปแบบผลการเลื่อนชั้นไม่ถูกต้อง");
      }

      setMessage(
        `เลื่อนชั้น ${result.promoted.toLocaleString("th-TH")} คน · จบการศึกษา ${result.graduated.toLocaleString("th-TH")} คน · ข้าม ${result.skipped.toLocaleString("th-TH")} คน`,
      );
      setPromotionPreview(null);
      setPromotionAcknowledged(false);
      setPage(1);
      setReload((current) => current + 1);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "เลื่อนชั้นนักเรียนไม่สำเร็จ";
      setError(message);
      setPromotionError(message);
    } finally {
      setPromoting(false);
    }
  }

  function closePromotionPreview() {
    if (promoting) return;
    setPromotionPreview(null);
    setPromotionAcknowledged(false);
    setPromotionError("");
  }

  const filteredPromotionRows = promotionPreview?.rows.filter((row) => {
    if (promotionFilter === "mismatched") {
      return row.sourceMatches === 1 && row.registryClassroom !== row.sourceClassroom;
    }
    if (promotionFilter === "skipped") {
      return ["student_missing", "duplicate_student", "missing_class", "invalid_class"].includes(row.action);
    }
    return true;
  }) ?? [];

  useEffect(() => {
    if (!promotionPreview) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !promoting) closePromotionPreview();
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [promotionPreview, promoting]);

  return (
    <section id="member-directory" className="members-section directory-section" aria-labelledby="directory-heading">
      <div className="members-heading">
        <div>
          <p className="section-kicker">ข้อมูลหลัก · 1 รายการต่อเด็ก</p>
          <h2 id="directory-heading">ทะเบียนสมาชิก</h2>
          <p>ข้อมูลเด็กและผู้ปกครอง เชื่อมกับรายการค่าบำรุงด้วยรหัสนักเรียน</p>
          <p>เลื่อนชั้นตามรูปแบบ อ.1–อ.3 และ ป.1–ป.6; ห้องเรียนที่ไม่ตรงรูปแบบจะข้ามไป</p>
        </div>
        <div className="directory-heading-actions">
          <span className="records-page">หน้า {page}</span>
          <button
            type="button"
            className="secondary-button add-member-button"
            onClick={promoteStudents}
            disabled={promoting || loadingPromotionPreview}
          >
            {loadingPromotionPreview
              ? "กำลังตรวจสอบรายชื่อ..."
              : promoting
                ? "กำลังบันทึก..."
                : "เลื่อนชั้น / จบการศึกษา"}
          </button>
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
            placeholder="ค้นหาชื่อเด็ก ผู้ปกครอง ห้องเรียน หรือรหัสนักเรียน"
            aria-label="ค้นหาสมาชิก"
          />
          {searchText && (
            <button type="button" onClick={() => setSearchText("")} aria-label="ล้างคำค้นหา">
              ×
            </button>
          )}
        </label>
        <div className="directory-filter-controls">
          <label className="directory-class-filter">
            เลือกชั้น
            <select
              value={classroomFilter}
              onChange={(event) => {
                setClassroomFilter(event.target.value);
                setPage(1);
              }}
              aria-label="กรองตามระดับชั้น"
            >
              <option value="">ทุกชั้น</option>
              {associationClassroomOptions.map((classroom) => (
                <option key={classroom} value={classroom}>{classroom}</option>
              ))}
            </select>
          </label>
          <span className="directory-search-hint">
            {search
              ? `ผลการค้นหา: ${search}`
              : classroomFilter
                ? `แสดงชั้น ${classroomFilter} ทุกห้อง`
                : "ค้นหาได้จากชื่อเด็ก ผู้ปกครอง ห้องเรียน หรือรหัสนักเรียน"}
          </span>
        </div>
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
            ห้องเรียน / ระดับชั้น
            <input
              maxLength={100}
              value={form.classroom}
              onChange={(event) => setForm({ ...form, classroom: event.target.value })}
              placeholder="เช่น ป.6/2"
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
            ผู้ปกครองคนที่ 1
            <input
              required
              maxLength={200}
              value={form.parent1Name}
              onChange={(event) => setForm({ ...form, parent1Name: event.target.value })}
            />
          </label>
          <label>
            ผู้ปกครองคนที่ 2 (ถ้ามี)
            <input
              maxLength={200}
              value={form.parent2Name}
              onChange={(event) => setForm({ ...form, parent2Name: event.target.value })}
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
            กำลังศึกษาอยู่
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
              <th>ห้องเรียน</th>
              <th>ค่าบำรุง</th>
              <th>สถานะ</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="records-empty">กำลังโหลดทะเบียนสมาชิก...</td></tr>
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={7} className="records-empty">
                  {search ? `ไม่พบสมาชิกที่ตรงกับ “${search}”` : "ยังไม่มีข้อมูลสมาชิก"}
                </td>
              </tr>
            ) : members.map((member) => (
              <tr key={member.id}>
                <td>
                  <div className="directory-parent-cell">
                    <span className="directory-avatar" aria-hidden="true">
                      {(member.parent1Name || member.parent2Name || "ส").charAt(0)}
                    </span>
                    <div className="directory-parent-names">
                      {member.parent1Name && <span><small>ผู้ปกครอง 1</small>{member.parent1Name}</span>}
                      {member.parent2Name && <span><small>ผู้ปกครอง 2</small>{member.parent2Name}</span>}
                      {!member.parent1Name && <span>ไม่ระบุผู้ปกครอง</span>}
                      {member.hasExtraParentNames && <small>ข้อมูลเดิมมีชื่อเกิน 2 คน</small>}
                    </div>
                  </div>
                </td>
                <td>
                  <strong className="directory-child-name">{member.childName}</strong>
                </td>
                <td>{member.studentId}</td>
                <td>{member.classroom || "—"}</td>
                <td>
                  <span className={`directory-fee-status ${member.hasFeeRecords ? "linked" : "unlinked"}`}>
                    <span aria-hidden="true">{member.hasFeeRecords ? "✓" : "·"}</span>
                    {member.hasFeeRecords ? "มีรายการ" : "ยังไม่มี"}
                  </span>
                </td>
                <td>
                  <span className={`directory-status ${member.isActive ? "active" : "inactive"}`}>
                    {member.isActive ? "กำลังศึกษา" : "จบ/พ้นสภาพ"}
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

      {promotionPreview && (
        <div
          className="promotion-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePromotionPreview();
          }}
        >
          <section
            className="promotion-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="promotion-modal-title"
            aria-describedby="promotion-modal-description"
          >
            <header className="promotion-modal-header">
              <div>
                <p className="section-kicker">ตรวจสอบก่อนบันทึก</p>
                <h2 id="promotion-modal-title">ตัวอย่างการเลื่อนชั้นนักเรียน</h2>
                <p id="promotion-modal-description">
                  เปรียบเทียบห้องในทะเบียนกับ <strong>public.student.grade</strong> โดยใช้รหัสนักเรียน
                  และจะใช้ข้อมูลจาก public.student เป็นหลัก
                </p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={closePromotionPreview}
                disabled={promoting}
                aria-label="ปิดหน้าตรวจสอบ"
              >
                ×
              </button>
            </header>

            {promotionError && <div className="error-banner" role="alert">{promotionError}</div>}

            <div className="promotion-summary">
              <div><strong>{promotionPreview.rows.length.toLocaleString("th-TH")}</strong><span>นักเรียนที่กำลังศึกษา</span></div>
              <div><strong>{promotionPreview.promoted.toLocaleString("th-TH")}</strong><span>เลื่อนชั้น</span></div>
              <div><strong>{promotionPreview.graduated.toLocaleString("th-TH")}</strong><span>จบการศึกษา</span></div>
              <div><strong>{promotionPreview.skipped.toLocaleString("th-TH")}</strong><span>ข้าม / ต้องตรวจสอบ</span></div>
              <div className={promotionPreview.mismatched ? "needs-review" : ""}>
                <strong>{promotionPreview.mismatched.toLocaleString("th-TH")}</strong><span>ห้องไม่ตรงกับทะเบียน</span>
              </div>
            </div>

            <div className="promotion-rules">
              <strong>หลักการทำงาน</strong>
              <span>อ.1–อ.3 → ป.1–ป.6 → จบการศึกษา · ผู้ที่เรียนซ้ำให้แก้ห้องรายคนหลังเลื่อนชั้น</span>
            </div>

            <div className="promotion-list-tools">
              <div className="promotion-filter" aria-label="ตัวกรองรายชื่อ">
                <button
                  type="button"
                  className={promotionFilter === "all" ? "selected" : ""}
                  onClick={() => setPromotionFilter("all")}
                >
                  ทั้งหมด ({promotionPreview.rows.length})
                </button>
                <button
                  type="button"
                  className={promotionFilter === "mismatched" ? "selected" : ""}
                  onClick={() => setPromotionFilter("mismatched")}
                >
                  ห้องไม่ตรง ({promotionPreview.mismatched})
                </button>
                <button
                  type="button"
                  className={promotionFilter === "skipped" ? "selected" : ""}
                  onClick={() => setPromotionFilter("skipped")}
                >
                  ข้าม / ตรวจสอบ ({promotionPreview.skipped})
                </button>
              </div>
              <span>แสดง {filteredPromotionRows.length.toLocaleString("th-TH")} รายการ</span>
            </div>

            <div className="promotion-table-wrap">
              <table className="promotion-table">
                <thead>
                  <tr>
                    <th>นักเรียน / รหัส</th>
                    <th>ห้องในทะเบียน</th>
                    <th>ห้องใน public.student</th>
                    <th>ผลลัพธ์</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPromotionRows.length === 0 ? (
                    <tr><td colSpan={4} className="records-empty">ไม่มีรายการในตัวกรองนี้</td></tr>
                  ) : filteredPromotionRows.map((row) => {
                    const mismatch = row.sourceMatches === 1 && row.registryClassroom !== row.sourceClassroom;
                    const status = row.action === "promote"
                      ? "เลื่อนชั้น"
                      : row.action === "graduate"
                        ? "จบการศึกษา"
                        : row.action === "student_missing"
                          ? "ไม่พบใน student"
                          : row.action === "duplicate_student"
                            ? `รหัสซ้ำใน student (${row.sourceMatches})`
                            : row.action === "missing_class"
                              ? "ไม่มีข้อมูลชั้น"
                              : "รูปแบบชั้นไม่รองรับ";
                    return (
                      <tr key={row.memberId} className={mismatch ? "promotion-row-mismatch" : ""}>
                        <td>
                          <strong>{row.childName || "ไม่ระบุชื่อ"}</strong>
                          <small>{row.studentId}</small>
                        </td>
                        <td>{row.registryClassroom || "—"}</td>
                        <td>{row.sourceMatches === 1 ? row.sourceClassroom || "—" : row.sourceMatches === 0 ? "ไม่พบรหัส" : `พบ ${row.sourceMatches} รายการ`}</td>
                        <td>
                          <span className={`promotion-action ${row.action === "promote" || row.action === "graduate" ? "ready" : "skipped"}`}>
                            {status}{row.targetClassroom ? ` · ${row.targetClassroom}` : ""}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <label className="promotion-acknowledgement">
              <input
                type="checkbox"
                checked={promotionAcknowledged}
                onChange={(event) => setPromotionAcknowledged(event.target.checked)}
                disabled={promoting}
              />
              <span>ฉันตรวจสอบรายชื่อและยืนยันให้เลื่อนชั้นตามข้อมูลใน public.student</span>
            </label>

            <footer className="promotion-modal-actions">
              <button type="button" className="secondary-button" onClick={closePromotionPreview} disabled={promoting}>
                ยกเลิก
              </button>
              <button
                type="button"
                className="primary-button promotion-confirm-button"
                onClick={applyPromotion}
                disabled={
                  promoting ||
                  !promotionAcknowledged ||
                  promotionPreview.promoted + promotionPreview.graduated === 0
                }
              >
                {promoting ? "กำลังบันทึก..." : "ยืนยันเลื่อนชั้น / จบการศึกษา"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
