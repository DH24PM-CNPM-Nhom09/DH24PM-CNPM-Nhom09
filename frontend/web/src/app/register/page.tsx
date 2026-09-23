"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthLayout from "@/components/layout/AuthLayout";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import OtpInput from "@/components/ui/OtpInput";
import { loginWithGoogle } from "@/lib/api";

export default function RegisterPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmitStep1(e: React.FormEvent) {
    e.preventDefault();
    setStep(2); // TODO: gọi API gửi OTP xác thực email khi Backend sẵn sàng
  }

  async function handleVerify() {
    setLoading(true);
    try {
      await loginWithGoogle("mock-google-id-token");
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  if (step === 2) {
    return (
      <AuthLayout title="Xác thực email" subtitle={`Nhập mã 6 số vừa được gửi tới ${email || "email của bạn"}.`}>
        <OtpInput value={otp} onChange={setOtp} />
        <Button
          fullWidth
          className="mt-8"
          loading={loading}
          disabled={otp.length !== 6}
          onClick={handleVerify}
        >
          Xác nhận
        </Button>
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
    <AuthLayout title="Đăng ký tài khoản" subtitle="Tạo tài khoản để bắt đầu nộp hồ sơ xét tuyển sau đại học.">
      <form className="flex flex-col gap-4" onSubmit={handleSubmitStep1}>
        <Input label="Họ và tên" required placeholder="Nguyễn Văn A" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Input label="Email" required type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Số điện thoại" required placeholder="09xxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Button type="submit" fullWidth className="mt-2">
          Tiếp tục
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-gray-500">
        Đã có tài khoản?{" "}
        <Link href="/login" className="font-semibold text-accent hover:underline">
          Đăng nhập
        </Link>
      </p>
    </AuthLayout>
  );
}
