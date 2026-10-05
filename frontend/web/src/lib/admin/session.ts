"use client";

// Phiên đăng nhập của CÁN BỘ — tách hẳn khỏi phiên thí sinh (access_token),
// để 1 máy có thể vừa thử cổng thí sinh vừa thử cổng quản lý khi demo.
import { useEffect, useState } from "react";
import type { StaffAccount } from "./types";

export interface StaffSession {
  accessToken: string;
  staff: StaffAccount;
}

const KEY = "staff_session";
const listeners = new Set<() => void>();

export function readSession(): StaffSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StaffSession) : null;
  } catch {
    return null;
  }
}

export function writeSession(session: StaffSession | null) {
  if (typeof window === "undefined") return;
  if (session) window.localStorage.setItem(KEY, JSON.stringify(session));
  else window.localStorage.removeItem(KEY);
  listeners.forEach((l) => l());
}

/** undefined = đang đọc phiên (chưa biết), null = chưa đăng nhập */
export function useStaffSession(): StaffSession | null | undefined {
  const [session, setSession] = useState<StaffSession | null | undefined>(undefined);
  useEffect(() => {
    const update = () => setSession(readSession());
    update();
    listeners.add(update);
    window.addEventListener("storage", update);
    return () => {
      listeners.delete(update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return session;
}
