"use client";

import { ReactNode, useEffect, useState } from "react";

type Caretaker = {
  id: string;
  name: string;
};

type DashboardShellProps = {
  activePage: "dashboard" | "members" | "fees" | "tracking" | "records";
  children: ReactNode;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export default function DashboardShell({ activePage, children }: DashboardShellProps) {
  const [caretaker, setCaretaker] = useState<Caretaker | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

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

  const pageTitle = activePage === "dashboard"
    ? "ภาพรวมการชำระ"
    : activePage === "members"
    ? "ทะเบียนสมาชิก"
    : activePage === "fees"
      ? "จัดการรายการค่าบำรุง"
      : activePage === "tracking"
        ? "รายงานสถานะการชำระ"
        : "เปรียบเทียบการชำระ";

  return (
    <main className={`shell app-shell${sidebarOpen ? "" : " sidebar-closed"}`}>
      <aside id="primary-sidebar" className="app-sidebar">
        <a className="brand brand-link sidebar-brand" href="/" aria-label="หน้าภาพรวม" title="ภาพรวม">
          <span className="brand-mark">ส</span>
          <span>สมาคม<span className="brand-caption">ระบบข้อมูลสมาชิก</span></span>
        </a>
        <nav className="page-nav sidebar-nav" aria-label="เมนูหลัก">
          <a href="/" className={activePage === "dashboard" ? "active" : ""} aria-current={activePage === "dashboard" ? "page" : undefined} aria-label="ภาพรวม" title="ภาพรวม">
            <span className="sidebar-icon" aria-hidden="true">⌂</span>
            <span>ภาพรวม</span>
          </a>
          <a href="/members" className={activePage === "members" ? "active" : ""} aria-current={activePage === "members" ? "page" : undefined} aria-label="ทะเบียนสมาชิก" title="ทะเบียนสมาชิก">
            <span className="sidebar-icon" aria-hidden="true">⌂</span>
            <span>ทะเบียนสมาชิก</span>
          </a>
          <a href="/fees" className={activePage === "fees" ? "active" : ""} aria-current={activePage === "fees" ? "page" : undefined} aria-label="จัดการค่าบำรุง" title="จัดการค่าบำรุง">
            <span className="sidebar-icon" aria-hidden="true">฿</span>
            <span>จัดการค่าบำรุง</span>
          </a>
          <a href="/tracking" className={activePage === "tracking" ? "active" : ""} aria-current={activePage === "tracking" ? "page" : undefined} aria-label="ติดตามการชำระ" title="ติดตามการชำระ">
            <span className="sidebar-icon" aria-hidden="true">▥</span>
            <span>ติดตามการชำระ</span>
          </a>
          <a href="/records" className={activePage === "records" ? "active" : ""} aria-current={activePage === "records" ? "page" : undefined} aria-label="เปรียบเทียบการชำระ" title="เปรียบเทียบการชำระ">
            <span className="sidebar-icon" aria-hidden="true">▤</span>
            <span>เปรียบเทียบการชำระ</span>
          </a>
        </nav>
        <div className="sidebar-footer">
          <span className="sidebar-status-dot" />
          <span>ระบบจัดการสมาชิก</span>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-leading">
            <button
              className="sidebar-toggle"
              type="button"
              aria-label={sidebarOpen ? "ย่อเมนูด้านข้าง" : "ขยายเมนูด้านข้าง"}
              aria-expanded={sidebarOpen}
              aria-controls="primary-sidebar"
              onClick={() => setSidebarOpen((open) => !open)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {sidebarOpen
                  ? <path d="m15 18-6-6 6-6" />
                  : <path d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
            <div className="topbar-page-title">
              <span>สมาคมผู้ปกครองและครู</span>
              <strong>{pageTitle}</strong>
            </div>
          </div>
          <div className="topbar-actions">
            <span className="signed-in">ผู้ดูแล: {caretaker.name}</span>
            <button className="logout-button" onClick={logout}>ออกจากระบบ</button>
          </div>
        </header>

        {error && <div className="error-banner" role="alert">{error}</div>}
        {children}
        <footer>จัดการสมาชิกและตรวจสอบข้อมูลค่าบำรุงสมาคม</footer>
      </div>
    </main>
  );
}
