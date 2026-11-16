"use client";

import { FormEvent, useEffect, useState } from "react";

type Caretaker = {
  id: string;
  name: string;
};

export default function LoginPage() {
  const [caretakers, setCaretakers] = useState<Caretaker[]>([]);
  const [caretakerId, setCaretakerId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/caretakers")
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok) {
          const message =
            typeof result === "object" &&
            result !== null &&
            "error" in result &&
            typeof result.error === "string"
              ? result.error
              : "โหลดรายชื่อผู้ดูแลไม่สำเร็จ";
          throw new Error(message);
        }
        if (
          !Array.isArray(result) ||
          result.some(
            (row) =>
              typeof row.id !== "string" ||
              typeof row.name !== "string" ||
              Object.keys(row).some((key) => key !== "id" && key !== "name"),
          )
        ) {
          throw new Error("รูปแบบรายชื่อผู้ดูแลไม่ถูกต้อง");
        }
        return result as Caretaker[];
      })
      .then((result) => {
        if (active) {
          setCaretakers(result);
          if (result.length === 1) setCaretakerId(result[0].id);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "เกิดข้อผิดพลาดในการโหลดรายชื่อ");
        }
      })
      .finally(() => {
        if (active) setLoadingList(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caretakerId, pin }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "เข้าสู่ระบบไม่สำเร็จ";
        throw new Error(message);
      }
      if (
        typeof result !== "object" ||
        result === null ||
        !("id" in result) ||
        typeof result.id !== "string" ||
        !("name" in result) ||
        typeof result.name !== "string"
      ) {
        throw new Error("ข้อมูลผู้ดูแลที่ได้รับไม่ถูกต้อง");
      }

      localStorage.removeItem("association.caretaker");
      window.location.assign("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand login-brand">
          <span className="brand-mark">ส</span>
          <span>สมาคม<span className="brand-caption">ระบบข้อมูลสมาชิก</span></span>
        </div>
        <p className="eyebrow login-eyebrow">CARETAKER SIGN IN</p>
        <h1>เข้าสู่ระบบผู้ดูแล</h1>
        <p className="login-copy">เลือกชื่อผู้ดูแลและกรอก PIN เพื่อเข้าสู่ระบบ</p>

        {error && <div className="error-banner" role="alert">{error}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="caretaker">ชื่อผู้ดูแล</label>
          <select
            id="caretaker"
            value={caretakerId}
            onChange={(event) => setCaretakerId(event.target.value)}
            required
            disabled={loadingList || caretakers.length === 0}
          >
            <option value="">{loadingList ? "กำลังโหลดรายชื่อ..." : "เลือกชื่อผู้ดูแล"}</option>
            {caretakers.map((caretaker) => (
              <option key={caretaker.id} value={caretaker.id}>{caretaker.name}</option>
            ))}
          </select>

          <label htmlFor="pin">PIN (4–6 หลัก)</label>
          <input
            id="pin"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            pattern="[0-9]{4,6}"
            minLength={4}
            maxLength={6}
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="กรอก PIN"
            required
          />

          <button type="submit" disabled={submitting || loadingList || caretakers.length === 0}>
            {submitting ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>
        {!loadingList && caretakers.length === 0 && !error && (
          <p className="login-empty">ยังไม่มีผู้ดูแลที่เปิดใช้งานในระบบ</p>
        )}
      </section>
    </main>
  );
}
