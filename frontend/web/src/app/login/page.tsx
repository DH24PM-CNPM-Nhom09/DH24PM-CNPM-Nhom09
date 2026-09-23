"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthLayout from "@/components/layout/AuthLayout";
import Button from "@/components/ui/Button";
import { loginWithGoogle } from "@/lib/api";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");
    try {
      // TODO (Backend/Frontend tích hợp thật): thay bằng Google Identity Services
      // lấy id_token thật rồi truyền vào loginWithGoogle(idToken).
      await loginWithGoogle("mock-google-id-token");
      router.push("/dashboard");
    } catch (e: any) {
      setError(e?.message ?? "Đăng nhập thất bại, vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Đăng nhập" subtitle="Đăng nhập để nộp và theo dõi hồ sơ xét tuyển sau đại học.">
      {error && (
        <div className="mb-5 rounded-input bg-danger-50 px-4 py-3 text-[13px] font-medium text-danger">
          {error}
        </div>
      )}

      <Button
        variant="outline"
        fullWidth
        loading={loading}
        onClick={handleGoogleLogin}
        className="flex items-center justify-center gap-2.5"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.81.54-1.85.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18z" />
          <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.16.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03z" />
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z" />
        </svg>
        Đăng nhập với Google
      </Button>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs font-semibold text-gray-400">HOẶC</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <p className="text-center text-sm text-gray-500">
        Quên tài khoản Google đã đăng ký?{" "}
        <Link href="/forgot-password" className="font-semibold text-accent hover:underline">
          Lấy lại quyền truy cập
        </Link>
      </p>

      <p className="mt-8 text-center text-sm text-gray-500">
        Chưa có tài khoản?{" "}
        <Link href="/register" className="font-semibold text-accent hover:underline">
          Đăng ký ngay
        </Link>
      </p>
    </AuthLayout>
  );
}
