"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthLayout from "@/components/layout/AuthLayout";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import OtpInput from "@/components/ui/OtpInput";
import { Alert, DevOtpNotice, errMsg, PasswordChecklist, PasswordInput, passwordIssues, ResendButton } from "@/components/auth/AuthBits";
import { requestPasswordResetOtp, resetPassword } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [devOtp, setDevOtp] = useState<string | undefined>();
  const [resendAfter, setResendAfter] = useState(60);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!emailOrPhone.trim()) {
      setError("Nhập email hoặc số điện thoại đã đăng ký.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await requestPasswordResetOtp(emailOrPhone.trim());
      setDevOtp(res.devOtp);
      setResendAfter(res.resendAfterSeconds ?? 60);
      setInfo("");
      setStep(2);
    } catch (e) {
      setError(errMsg(e, "Không gửi được mã xác thực."));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError("");
    try {
      const res = await requestPasswordResetOtp(emailOrPhone.trim());
      setDevOtp(res.devOtp);
      setOtp("");
      setInfo("Đã gửi mã mới. Mã cũ không còn dùng được.");
      return res.resendAfterSeconds ?? 60;
    } catch (e) {
      setError(errMsg(e, "Không gửi lại được mã."));
      const m = errMsg(e, "").match(/(\d+) giây/);
      return m ? Number(m[1]) : 0;
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const p = passwordIssues(newPassword);
    if (!p.length || !p.letter || !p.digit) {
      setError("Mật khẩu mới cần ít nhất 8 ký tự, gồm cả chữ và số.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(emailOrPhone.trim(), otp, newPassword);
      router.push("/login?reset=1");
    } catch (e) {
      setError(errMsg(e, "Đặt lại mật khẩu thất bại."));
    } finally {
      setLoading(false);
    }
  }

  if (step === 2) {
    return (
      <AuthLayout
        title="Đặt lại mật khẩu"
        subtitle="Nếu thông tin bạn nhập khớp với một tài khoản, mã 6 số đã được gửi về email đăng ký của tài khoản đó."
      >
        {info && <Alert tone="info">{info}</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
        <DevOtpNotice otp={devOtp} />
        <form className="flex flex-col gap-5" onSubmit={handleReset}>
          <OtpInput value={otp} onChange={setOtp} />
          <PasswordInput label="Mật khẩu mới" required autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <PasswordChecklist password={newPassword} />
          <PasswordInput
            label="Nhập lại mật khẩu mới"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <Button type="submit" fullWidth loading={loading} disabled={otp.length !== 6}>
            Đặt lại mật khẩu
          </Button>
        </form>
        <div className="mt-6 flex flex-col items-center gap-3">
          <ResendButton seconds={resendAfter} onResend={handleResend} />
          <button
            type="button"
            onClick={() => {
              setStep(1);
              setError("");
            }}
            className="text-sm font-semibold text-gray-500 hover:text-gray-700"
          >
            ← Quay lại
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Quên mật khẩu" subtitle="Nhập email hoặc số điện thoại đã đăng ký. Mã xác thực sẽ được gửi về email của tài khoản.">
      {error && <Alert tone="error">{error}</Alert>}
      <form className="flex flex-col gap-5" onSubmit={handleSendOtp} noValidate>
        <Input
          label="Email hoặc số điện thoại"
          required
          autoComplete="username"
          placeholder="tenban@gmail.com hoặc 09xxxxxxxx"
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
