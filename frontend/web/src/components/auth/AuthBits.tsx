"use client";

import { useEffect, useId, useState, type InputHTMLAttributes, type ReactNode } from "react";

/** Khung báo lỗi / thành công / lưu ý dùng chung cho các trang đăng nhập, đăng ký */
export function Alert({ tone, children }: { tone: "error" | "success" | "info" | "warning"; children: ReactNode }) {
  const cls = {
    error: "bg-danger-50 text-danger",
    success: "bg-success-50 text-[#166534]",
    info: "bg-info-50 text-[#1D4ED8]",
    warning: "bg-warning-50 text-[#92400E]",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`mb-5 rounded-input px-4 py-3 text-[13px] font-medium leading-relaxed ${cls}`}>
      {children}
    </div>
  );
}

/** Ô mật khẩu có nút Hiện/Ẩn (nút nằm ngoài <label> để tên ô chỉ là nhãn) */
export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement> & { label: string; required?: boolean; error?: string; hint?: string }) {
  const { label, required, error, hint, className = "", id, ...rest } = props;
  const [show, setShow] = useState(false);
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="flex w-full flex-col gap-1.5">
      <label htmlFor={inputId} className="text-[13px] font-semibold text-gray-700">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={show ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          className={`w-full rounded-input border border-gray-300 py-[12px] pl-[14px] pr-16 text-sm text-gray-900 outline-none transition-colors focus:border-accent ${error ? "border-danger" : ""} ${className}`}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label={show ? `Ẩn ${label.toLowerCase()}` : `Hiện ${label.toLowerCase()}`}
        >
          {show ? "Ẩn" : "Hiện"}
        </button>
      </div>
      {hint && !error && <span className="text-xs text-gray-400">{hint}</span>}
      {error && <span className="text-xs font-medium text-danger">{error}</span>}
    </div>
  );
}

/** Các tiêu chí mật khẩu — khớp quy tắc backend: ≥ 8 ký tự, có chữ và số */
export function passwordIssues(pw: string) {
  return {
    length: pw.length >= 8,
    letter: /[A-Za-z]/.test(pw),
    digit: /\d/.test(pw),
  };
}

export function PasswordChecklist({ password }: { password: string }) {
  const c = passwordIssues(password);
  const Item = ({ ok, children }: { ok: boolean; children: ReactNode }) => (
    <li className={`flex items-center gap-1.5 ${ok ? "text-success" : "text-gray-400"}`}>
      <span aria-hidden="true">{ok ? "✓" : "○"}</span>
      {children}
    </li>
  );
  return (
    <ul className="-mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium" aria-label="Yêu cầu mật khẩu">
      <Item ok={c.length}>Ít nhất 8 ký tự</Item>
      <Item ok={c.letter}>Có chữ cái</Item>
      <Item ok={c.digit}>Có chữ số</Item>
    </ul>
  );
}

/** Nút "Gửi lại mã" có đếm ngược */
export function ResendButton({ seconds, onResend }: { seconds: number; onResend: () => Promise<number | void> }) {
  const [left, setLeft] = useState(seconds);
  const [busy, setBusy] = useState(false);

  useEffect(() => setLeft(seconds), [seconds]);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  return (
    <button
      type="button"
      disabled={left > 0 || busy}
      onClick={async () => {
        setBusy(true);
        try {
          const next = await onResend();
          setLeft(typeof next === "number" ? next : 60);
        } finally {
          setBusy(false);
        }
      }}
      className="text-sm font-semibold text-accent hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline"
    >
      {busy ? "Đang gửi…" : left > 0 ? `Gửi lại mã sau ${left} giây` : "Gửi lại mã"}
    </button>
  );
}

/** Chỉ hiện khi backend chưa cấu hình gửi email (chế độ phát triển) */
export function DevOtpNotice({ otp }: { otp?: string }) {
  if (!otp) return null;
  return (
    <Alert tone="warning">
      Máy chủ chưa cấu hình gửi email nên mã chưa được gửi thật. Mã để thử: <b className="font-mono tracking-widest">{otp}</b>
      <span className="mt-1 block text-xs font-normal">Dòng này tự biến mất sau khi cấu hình Gmail cho backend.</span>
    </Alert>
  );
}

export function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  return `${user.slice(0, 2)}${"•".repeat(Math.max(1, Math.min(6, user.length - 2)))}@${domain}`;
}

export function errMsg(e: unknown, fallback: string) {
  return (e as { message?: string })?.message ?? fallback;
}
