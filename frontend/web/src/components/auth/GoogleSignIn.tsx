"use client";

import { useEffect, useRef, useState } from "react";

// ============================================================================
// Nút "Đăng nhập với Google" thật (Google Identity Services).
// Bấm vào hiện cửa sổ chọn tài khoản Google; Google trả về id_token (JWT) và
// component gọi onCredential(idToken) để gửi lên backend xác minh.
//
// Google Client ID lấy từ backend (GET /public/auth-config, đọc GOOGLE_CLIENT_ID
// trong backend/.env) nên chỉ cần cấu hình 1 chỗ. Chưa cấu hình -> trả về null
// để trang hiện nút demo thay thế.
// ============================================================================

type GsiButtonOptions = {
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill";
  width?: number;
  locale?: string;
  logo_alignment?: "left" | "center";
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: "popup"; auto_select?: boolean; cancel_on_tap_outside?: boolean }) => void;
          renderButton: (el: HTMLElement, opts: GsiButtonOptions) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";
const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

let configPromise: Promise<{ googleClientId: string | null; googleDemo: boolean }> | null = null;
/** Đọc cấu hình đăng nhập Google từ backend (cache trong phiên) */
export function getAuthConfig() {
  if (!configPromise) {
    configPromise = fetch(`${API_BASE}/public/auth-config`)
      .then((r) => (r.ok ? r.json() : { googleClientId: null, googleDemo: true }))
      .catch(() => ({ googleClientId: null, googleDemo: true }));
  }
  return configPromise;
}

let scriptPromise: Promise<void> | null = null;
function loadScript() {
  if (typeof window !== "undefined" && window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error("Không tải được dịch vụ đăng nhập Google. Kiểm tra kết nối mạng."));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

/**
 * Hiện nút Google thật khi đã cấu hình Client ID; nếu chưa thì render `fallback`
 * (nút demo của trang). Trong lúc kiểm tra cấu hình, giữ chỗ để trang không bị nhảy.
 */
export default function GoogleSignIn({
  onCredential,
  onError,
  fallback,
  header,
  text = "signin_with",
}: {
  onCredential: (idToken: string) => void;
  onError?: (message: string) => void;
  fallback: React.ReactNode;
  /** Chỉ hiện phía trên nút khi nút Google thật đã sẵn sàng (ví dụ đường kẻ "HOẶC") */
  header?: React.ReactNode;
  text?: GsiButtonOptions["text"];
}) {
  const box = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"loading" | "google" | "fallback">("loading");
  const cb = useRef(onCredential);
  cb.current = onCredential;

  useEffect(() => {
    let cancelled = false;
    getAuthConfig().then(async (cfg) => {
      if (cancelled) return;
      if (!cfg.googleClientId) {
        setMode("fallback");
        return;
      }
      try {
        await loadScript();
        if (cancelled || !box.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: cfg.googleClientId,
          callback: (r) => cb.current(r.credential),
          ux_mode: "popup",
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        const width = Math.min(400, Math.max(240, Math.round(box.current.getBoundingClientRect().width)));
        window.google.accounts.id.renderButton(box.current, { theme: "outline", size: "large", text, shape: "rectangular", width, locale: "vi", logo_alignment: "center" });
        setMode("google");
      } catch (e) {
        setMode("fallback");
        onError?.((e as Error).message);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {mode === "google" && header}
      <div ref={box} className={`flex min-h-[44px] w-full justify-center ${mode === "fallback" ? "hidden" : ""}`} aria-busy={mode === "loading"} />
      {mode === "fallback" && fallback}
    </>
  );
}
