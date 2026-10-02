"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AuthLayout from "@/components/layout/AuthLayout";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert, errMsg, PasswordInput } from "@/components/auth/AuthBits";
import { loginWithGoogle, loginWithPassword } from "@/lib/api";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  const notice = params.get("reset") ? "Đã đặt lại mật khẩu. Đăng nhập bằng mật khẩu mới." : params.get("expired") ? "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại." : "";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setUnverifiedEmail(null);
    if (!emailOrPhone.trim() || !password) {
      setError("Nhập email hoặc số điện thoại và mật khẩu.");
      return;
    }
    setLoading(true);
    try {
      await loginWithPassword(emailOrPhone.trim(), password);
      const next = params.get("next");
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
    } catch (e: unknown) {
      const err = e as { error_code?: string; detail?: string };
      if (err?.error_code === "ACCOUNT_NOT_VERIFIED" && err.detail) setUnverifiedEmail(err.detail);
      setError(errMsg(e, "Đăng nhập thất bại, vui lòng thử lại."));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    setError("");
    try {
      // TODO (tích hợp Google thật): thay bằng Google Identity Services lấy id_token
      // rồi truyền vào loginWithGoogle(idToken). Hiện backend ở chế độ phát triển
      // coi token giả này là tài khoản thí sinh demo.
      await loginWithGoogle("mock-google-id-token");
      router.push("/dashboard");
    } catch (e) {
      setError(errMsg(e, "Đăng nhập thất bại, vui lòng thử lại."));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <AuthLayout title="Đăng nhập" subtitle="Đăng nhập để nộp và theo dõi hồ sơ xét tuyển sau đại học.">
      {notice && !error && <Alert tone="success">{notice}</Alert>}
      {error && (
        <Alert tone="error">
          {error}
          {unverifiedEmail && (
            <Link href={`/register?verify=${encodeURIComponent(unverifiedEmail)}`} className="mt-2 block font-bold underline">
              Nhập mã xác thực ngay →
            </Link>
          )}
        </Alert>
      )}

      <form className="flex flex-col gap-4" onSubmit={handleLogin} noValidate>
        <Input
          label="Email hoặc số điện thoại"
          autoComplete="username"
          placeholder="tenban@gmail.com hoặc 09xxxxxxxx"
          value={emailOrPhone}
          onChange={(e) => setEmailOrPhone(e.target.value)}
        />
        <PasswordInput label="Mật khẩu" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="-mt-1 text-right">
          <Link href="/forgot-password" className="text-[13px] font-semibold text-accent hover:underline">
            Quên mật khẩu?
          </Link>
        </div>
        <Button type="submit" fullWidth loading={loading}>
          Đăng nhập
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs font-semibold text-gray-400">HOẶC</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <Button variant="outline" fullWidth loading={googleLoading} onClick={handleGoogleLogin} className="flex items-center justify-center gap-2.5">
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.81.54-1.85.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18z" />
          <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.16.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03z" />
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z" />
        </svg>
        Đăng nhập với Google
      </Button>

      <p className="mt-8 text-center text-sm text-gray-500">
        Chưa có tài khoản?{" "}
        <Link href="/register" className="font-semibold text-accent hover:underline">
          Đăng ký ngay
        </Link>
      </p>
      <p className="mt-3 text-center text-sm text-gray-500">
        <Link href="/announcements" className="font-semibold text-navy-800 hover:underline">
          Xem thông báo tuyển sinh và quy định →
        </Link>
      </p>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
