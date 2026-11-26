"use client";

import { FormEvent, useEffect, useState } from "react";

type FeeSchedule = {
  academicYear: number;
  membershipAmount: number;
  semester1Amount: number;
  semester2Amount: number;
  membershipOpensOn: string | null;
  membershipDueOn: string | null;
  semester1OpensOn: string | null;
  semester1DueOn: string | null;
  semester2OpensOn: string | null;
  semester2DueOn: string | null;
};

type ScheduleForm = {
  membershipAmount: string;
  semester1Amount: string;
  semester2Amount: string;
  membershipOpensOn: string;
  membershipDueOn: string;
  semester1OpensOn: string;
  semester1DueOn: string;
  semester2OpensOn: string;
  semester2DueOn: string;
};

const emptyForm: ScheduleForm = {
  membershipAmount: "",
  semester1Amount: "",
  semester2Amount: "",
  membershipOpensOn: "",
  membershipDueOn: "",
  semester1OpensOn: "",
  semester1DueOn: "",
  semester2OpensOn: "",
  semester2DueOn: "",
};

const periods = [
  {
    key: "membership",
    title: "ค่าสมัครสมาชิก",
    amountKey: "membershipAmount",
    opensKey: "membershipOpensOn",
    dueKey: "membershipDueOn",
  },
  {
    key: "semester1",
    title: "ค่าบำรุง ภาคเรียนที่ 1",
    amountKey: "semester1Amount",
    opensKey: "semester1OpensOn",
    dueKey: "semester1DueOn",
  },
  {
    key: "semester2",
    title: "ค่าบำรุง ภาคเรียนที่ 2",
    amountKey: "semester2Amount",
    opensKey: "semester2OpensOn",
    dueKey: "semester2DueOn",
  },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFeeSchedule(value: unknown): value is FeeSchedule {
  if (!isRecord(value)) return false;
  const amounts = [value.membershipAmount, value.semester1Amount, value.semester2Amount];
  const dates = [
    value.membershipOpensOn,
    value.membershipDueOn,
    value.semester1OpensOn,
    value.semester1DueOn,
    value.semester2OpensOn,
    value.semester2DueOn,
  ];
  return (
    Number.isSafeInteger(value.academicYear) &&
    amounts.every((amount) => typeof amount === "number" && Number.isFinite(amount) && amount >= 0) &&
    dates.every((date) => date === null || typeof date === "string")
  );
}

function toForm(schedule: FeeSchedule | null): ScheduleForm {
  if (!schedule) return emptyForm;
  return {
    membershipAmount: String(schedule.membershipAmount),
    semester1Amount: String(schedule.semester1Amount),
    semester2Amount: String(schedule.semester2Amount),
    membershipOpensOn: schedule.membershipOpensOn ?? "",
    membershipDueOn: schedule.membershipDueOn ?? "",
    semester1OpensOn: schedule.semester1OpensOn ?? "",
    semester1DueOn: schedule.semester1DueOn ?? "",
    semester2OpensOn: schedule.semester2OpensOn ?? "",
    semester2DueOn: schedule.semester2DueOn ?? "",
  };
}

export default function FeeScheduleSettings() {
  const [academicYear, setAcademicYear] = useState("2569");
  const [form, setForm] = useState<ScheduleForm>(emptyForm);
  const [hasSchedule, setHasSchedule] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const year = Number(academicYear);
    if (!Number.isSafeInteger(year) || year < 2500 || year > 2700) {
      setLoading(false);
      setForm(emptyForm);
      setHasSchedule(false);
      setError("ปีการศึกษาต้องอยู่ระหว่าง 2500 ถึง 2700");
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError("");
    setMessage("");
    fetch(`/api/fees/schedule?academicYear=${year}`, { cache: "no-store" })
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
              : "อ่านการตั้งค่าอัตราค่าบำรุงไม่สำเร็จ",
          );
        }
        if (!isRecord(result) || (result.schedule !== null && !isFeeSchedule(result.schedule))) {
          throw new Error("รูปแบบการตั้งค่าอัตราค่าบำรุงไม่ถูกต้อง");
        }
        return result.schedule as FeeSchedule | null;
      })
      .then((schedule) => {
        if (!active) return;
        setHasSchedule(schedule !== null);
        setForm(toForm(schedule));
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "อ่านการตั้งค่าอัตราค่าบำรุงไม่สำเร็จ");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [academicYear]);

  async function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/fees/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYear: Number(academicYear),
          membershipAmount: form.membershipAmount,
          semester1Amount: form.semester1Amount,
          semester2Amount: form.semester2Amount,
          membershipOpensOn: form.membershipOpensOn || null,
          membershipDueOn: form.membershipDueOn || null,
          semester1OpensOn: form.semester1OpensOn || null,
          semester1DueOn: form.semester1DueOn || null,
          semester2OpensOn: form.semester2OpensOn || null,
          semester2DueOn: form.semester2DueOn || null,
        }),
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
            : "บันทึกการตั้งค่าอัตราค่าบำรุงไม่สำเร็จ",
        );
      }
      setHasSchedule(true);
      setMessage(`บันทึกอัตราและรอบชำระปีการศึกษา ${academicYear} แล้ว`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "บันทึกการตั้งค่าอัตราค่าบำรุงไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="members-section fee-schedule-section" aria-labelledby="fee-schedule-title">
      <div className="members-heading fee-schedule-heading">
        <div>
          <p className="section-kicker">FEE RATES & PAYMENT PERIODS</p>
          <h2 id="fee-schedule-title">ตั้งค่าอัตราและรอบชำระ</h2>
          <p>กำหนดยอดค่าสมัครและค่าบำรุงรายภาคเรียนแยกตามปีการศึกษา</p>
        </div>
        <a className="secondary-button fee-schedule-back" href="/fees">กลับไปรายการค่าบำรุง</a>
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}
      {message && <div className="success-banner" role="status">{message}</div>}
      {!hasSchedule && !loading && !error && (
        <p className="fee-schedule-notice">ปีการศึกษานี้ยังไม่ได้กำหนดอัตรา กรุณากรอกยอดจริงก่อนบันทึก</p>
      )}

      <form className="fee-schedule-form" onSubmit={saveSchedule}>
        <label className="fee-schedule-year">
          ปีการศึกษา (พ.ศ.)
          <input
            type="number"
            min="2500"
            max="2700"
            step="1"
            required
            value={academicYear}
            onChange={(event) => {
              setAcademicYear(event.target.value);
              setHasSchedule(false);
              setForm(emptyForm);
            }}
          />
        </label>

        <div className="fee-schedule-grid">
          {periods.map((period) => (
            <article className="fee-schedule-card" key={period.key}>
              <h3>{period.title}</h3>
              <label>
                อัตรา (บาท)
                <input
                  type="number"
                  min="0"
                  max="9999999999.99"
                  step="0.01"
                  required
                  value={form[period.amountKey]}
                  onChange={(event) => setForm((current) => ({ ...current, [period.amountKey]: event.target.value }))}
                  placeholder="กรอกอัตราที่กำหนด"
                />
              </label>
              <p>ช่วงเปิดรับชำระ</p>
              <div className="fee-schedule-dates">
                <label>
                  เริ่มวันที่
                  <input
                    type="date"
                    value={form[period.opensKey]}
                    onChange={(event) => setForm((current) => ({ ...current, [period.opensKey]: event.target.value }))}
                  />
                </label>
                <label>
                  ถึงวันที่
                  <input
                    type="date"
                    value={form[period.dueKey]}
                    onChange={(event) => setForm((current) => ({ ...current, [period.dueKey]: event.target.value }))}
                  />
                </label>
              </div>
              <small>กำหนดวันทั้งสองช่อง หรือเว้นว่างทั้งคู่</small>
            </article>
          ))}
        </div>

        <p className="fee-schedule-footnote">
          การเปลี่ยนแปลงนี้เป็นค่าอ้างอิงสำหรับสร้างรายการใหม่เท่านั้น ไม่แก้ยอดหรือประวัติรายการที่มีอยู่แล้ว
        </p>
        <div className="member-form-actions">
          <button type="submit" className="primary-button" disabled={saving || loading}>
            {saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
          </button>
          {loading && <span role="status">กำลังโหลดข้อมูล...</span>}
        </div>
      </form>
    </section>
  );
}
