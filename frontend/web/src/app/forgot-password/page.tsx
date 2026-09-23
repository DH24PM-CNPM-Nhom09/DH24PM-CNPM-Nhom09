"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthLayout from "@/components/layout/AuthLayout";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import OtpInput from "@/components/ui/OtpInput";
import { requestPasswordResetOtp, resetPassword } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await requestPasswordResetOtp(emailOrPhone);
      setStep(2);
    } catch (e: any) {
      setError(e?.message ?? "Không gửi được mã xác thực.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(emailOrPhone, otp, newPassword);
      router.push("/login");
    } catch (e: any) {
      setError(e?.message ?? "Đặt lại mật khẩu thất bại.");
    } finally {
      setLoading(false);
    }
  }

  if (step === 2) {
    return (
      <AuthLayout title="Đặt lại mật khẩu" subtitle={`Nhập mã đã gửi tới ${emailOrPhone} và mật khẩu mới.`}>
        {error && (
          <div className="mb-5 rounded-input bg-danger-50 px-4 py-3 text-[13px] font-medium text-danger">
            {error}
          </div>
        )}
        <form className="flex flex-col gap-5" onSubmit={handleReset}>
          <OtpInput value={otp} onChange={setOtp} />
          <Input
            label="Mật khẩu mới"
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Input
            label="Xác nhận mật khẩu mới"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <Button type="submit" fullWidth loading={loading} disabled={otp.length !== 6}>
            Đặt lại mật khẩu
          </Button>
        </form>
        <button
          type="button"
          onClick={() => setStep(1)}
          className="mt-4 w-full text-center text-sm font-semibold text-gray-500 hover:text-gray-700"
        >
          ← Quay lại
        </button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Quên mật khẩu" subtitle="Nhập email hoặc số điện thoại đã đăng ký để nhận mã xác thực.">
      {error && (
        <div className="mb-5 rounded-input bg-danger-50 px-4 py-3 text-[13px] font-medium text-danger">
          {error}
        </div>
      )}
      <form className="flex flex-col gap-5" onSubmit={handleSendOtp}>
        <Input
          label="Email hoặc số điện thoại"
          required
          placeholder="email@example.com hoặc 09xxxxxxxx"
          value={emailOrPhone}
          onChange={(e) => setEmailOrPhone(e.target.value)}
        />
        <Button type="submit" fullWidth loading={loading}>
          Gửi mã xác thực
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-gray-500">
        Nhớ lại mật khẩu?{" "}
        <Link href="/login" className="font-semibold text-accent hover:underline">
          Đăng nhập
        </Link>
      </p>
    </AuthLayout>
  );
}
