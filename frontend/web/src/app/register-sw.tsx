"use client";

import { useEffect } from "react";

// Đăng ký Service Worker để có thể cài đặt như 1 App (PWA) trên điện thoại.
export default function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* bỏ qua nếu môi trường không hỗ trợ */
      });
    }
  }, []);
  return null;
}
