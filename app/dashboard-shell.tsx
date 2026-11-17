"use client";

import { ReactNode, useEffect, useState } from "react";

type Caretaker = {
  id: string;
  name: string;
};

type DashboardShellProps = {
  activePage: "members" | "fees" | "records";
  children: ReactNode;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export default function DashboardShell({ activePage, children }: DashboardShellProps) {
  const [caretaker, setCaretaker] = useState<Caretaker | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" })
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
              : "ตรวจสอบสถานะเข้าสู่ระบบไม่สำเร็จ",
          );
        }
        if (!isRecord(result) || typeof result.id !== "string" || typeof result.name !== "string") {
          throw new Error("ข้อมูลผู้ดูแลที่ได้รับไม่ถูกต้อง");
        }
        return { id: result.id, name: result.name };
      })
      .then((result) => {
        if (active && result) setCaretaker(result);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "ตรวจสอบสถานะเข้าสู่ระบบไม่สำเร็จ");
      })
      .finally(() => {
        if (active) setChecked(true);
      });

    return () => {
      active = false;
    };
  }, []);

  async function logout() {
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        const result: unknown = await response.json();
        throw new Error(
          isRecord(result) && typeof result.error === "string"
            ? result.error
            : "ออกจากระบบไม่สำเร็จ",
        );
      }
      window.location.replace("/login");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ออกจากระบบไม่สำเร็จ");
    }
  }

  if (!checked) {
    return (
      <main className="shell auth-loading" role="status">
        <p>กำลังตรวจสอบการเข้าสู่ระบบ...</p>
      </main>
    );
  }

  if (!caretaker) {
    return (
      <main className="shell">
        <div className="error-banner" role="alert">{error || "ไม่สามารถตรวจสอบการเข้าสู่ระบบได้"}</div>
        <a className="login-link" href="/login">กลับไปหน้าเข้าสู่ระบบ</a>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand brand-link" href="/" aria-label="หน้าทะเบียนสมาชิก">
          <span className="brand-mark">ส</span>
          <span>สมาคม<span className="brand-caption">ระบบข้อมูลสมาชิก</span></span>
        </a>
        <div className="topbar-actions">
          <span className="signed-in">ผู้ดูแล: {caretaker.name}</span>
          <button className="logout-button" onClick={logout}>ออกจากระบบ</button>
        </div>
      </header>

      <nav className="page-nav" aria-label="เมนูหลัก">
        <a href="/" className={activePage === "members" ? "active" : ""} aria-current={activePage === "members" ? "page" : undefined}>
          ทะเบียนสมาชิก
        </a>
        <a href="/fees" className={activePage === "fees" ? "active" : ""} aria-current={activePage === "fees" ? "page" : undefined}>
          จัดการรายการค่าบำรุง
        </a>
        <a href="/records" className={activePage === "records" ? "active" : ""} aria-current={activePage === "records" ? "page" : undefined}>
          เปรียบเทียบผู้ปกครองกับนักเรียน
        </a>
      </nav>

      {error && <div className="error-banner" role="alert">{error}</div>}
      {children}
      <footer>จัดการสมาชิกและตรวจสอบข้อมูลค่าบำรุงสมาคม</footer>
    </main>
  );
}
