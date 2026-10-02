"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AuthLayout from "@/components/layout/AuthLayout";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import OtpInput from "@/components/ui/OtpInput";
import { Alert, DevOtpNotice, errMsg, maskEmail, PasswordChecklist, PasswordInput, passwordIssues, ResendButton } from "@/components/auth/AuthBits";
import { registerAccount, resendRegistrationOtp, verifyRegistration } from "@/lib/api";
import type { RegisterPayload } from "@/lib/types";

type Errors = Partial<Record<keyof RegisterPayload | "confirm" | "agree", string>>;

/** Kiểm tra trước ở trình duyệt — cùng quy tắc với backend (backend vẫn kiểm tra lại) */
function validate(f: RegisterPayload & { confirm: string; agree: boolean }): Errors {
  const e: Errors = {};
  const name = f.fullName.trim().replace(/\s+/g, " ");
  if (name.length < 4 || !/^[\p{L} ]+$/u.test(name)) e.fullName = "Nhập đầy đủ họ và tên, chỉ gồm chữ cái.";
  if (!f.dob) e.dob = "Chọn ngày sinh.";
  else {
    const age = (Date.now() - new Date(f.dob).getTime()) / (365.25 * 86_400_000);
    if (!(age >= 18 && age <= 80)) e.dob = "Thí sinh phải từ 18 tuổi trở lên.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = "Email không hợp lệ.";
  if (!/^0\d{9}$/.test(f.phoneNumber.replace(/[\s.-]/g, ""))) e.phoneNumber = "Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.";
  const p = passwordIssues(f.password);
  if (!p.length || !p.letter || !p.digit) e.password = "Mật khẩu chưa đạt yêu cầu bên dưới.";
  if (f.confirm !== f.password) e.confirm = "Mật khẩu nhập lại không khớp.";
  if (!f.agree) e.agree = "Bạn cần đồng ý để tiếp tục.";
  return e;
}

function RegisterInner() {
  const router = useRouter();
  const params = useSearchParams();
  const verifyEmail = params.get("verify");

  const [step, setStep] = useState<"form" | "verify">(verifyEmail ? "verify" : "form");
  const [form, setForm] = useState({ fullName: "", dob: "", email: verifyEmail ?? "", phoneNumber: "", password: "", confirm: "", agree: false });
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState<string | undefined>();
  const [resendAfter, setResendAfter] = useState(verifyEmail ? 0 : 60);
  const [minutes, setMinutes] = useState(5);

  useEffect(() => {
    if (verifyEmail) setInfo("Tài khoản của bạn chưa được kích hoạt. Nhập mã đã gửi về email, hoặc bấm “Gửi lại mã” nếu mã đã hết hạn.");
  }, [verifyEmail]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    try {
      const res = await registerAccount({
        fullName: form.fullName.trim().replace(/\s+/g, " "),
        dob: form.dob,
        email: form.email.trim().toLowerCase(),
        phoneNumber: form.phoneNumber.replace(/[\s.-]/g, ""),
        password: form.password,
      });
      setForm((f) => ({ ...f, email: res.email ?? f.email.trim().toLowerCase() }));
      setDevOtp(res.devOtp);
      setResendAfter(res.resendAfterSeconds ?? 60);
      setMinutes(res.expiresInMinutes ?? 5);
      setOtp("");
      setInfo("");
      setStep("verify");
    } catch (e: unknown) {
      const code = (e as { error_code?: string })?.error_code;
      if (code === "EMAIL_EXISTS") setErrors({ email: errMsg(e, "") });
      else if (code === "DUPLICATE_PHONE") setErrors({ phoneNumber: errMsg(e, "") });
      else setError(errMsg(e, "Đăng ký thất bại, vui lòng thử lại."));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(code = otp) {
    if (code.length !== 6 || loading) return;
    setLoading(true);
    setError("");
    try {
      await verifyRegistration(form.email, code);
      router.replace("/profile?welcome=1");
    } catch (e) {
      setError(errMsg(e, "Xác thực thất bại, vui lòng thử lại."));
      setOtp("");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError("");
    try {
      const res = await resendRegistrationOtp(form.email);
      setDevOtp(res.devOtp);
      setMinutes(res.expiresInMinutes ?? 5);
      setInfo(`Đã gửi mã mới tới ${maskEmail(form.email)}. Mã cũ không còn dùng được.`);
      setOtp("");
      return res.resendAfterSeconds ?? 60;
    } catch (e) {
      setError(errMsg(e, "Không gửi lại được mã."));
      const m = errMsg(e, "").match(/(\d+) giây/);
      return m ? Number(m[1]) : 0;
    }
  }

  if (step === "verify") {
    return (
      <AuthLayout title="Xác thực email" subtitle={`Nhập mã 6 số vừa được gửi tới ${maskEmail(form.email)}. Mã có hiệu lực trong ${minutes} phút.`}>
        {info && <Alert tone="info">{info}</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
        <DevOtpNotice otp={devOtp} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleVerify();
          }}
        >
          <OtpInput
            value={otp}
            onChange={(v) => {
              setOtp(v);
              setError("");
              if (v.length === 6) handleVerify(v);
            }}
          />
          <Button type="submit" fullWidth className="mt-8" loading={loading} disabled={otp.length !== 6}>
            Xác nhận và kích hoạt tài khoản
          </Button>
        </form>
        <div className="mt-6 flex flex-col items-center gap-3 text-center">
          <ResendButton seconds={resendAfter} onResend={handleResend} />
          <p className="text-xs leading-relaxed text-gray-400">
            Không thấy email? Kiểm tra thư mục Spam hoặc Quảng cáo của Gmail. Thư gửi từ “Tuyển sinh Sau đại học - ĐH An Giang”.
          </p>
          <button
            type="button"
            onClick={() => {
              setStep("form");
              setError("");
              setInfo("");
            }}
            className="text-sm font-semibold text-gray-500 hover:text-gray-700"
          >
            ← Sửa thông tin đăng ký
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Đăng ký tài khoản" subtitle="Tạo tài khoản thí sinh để nộp và theo dõi hồ sơ xét tuyển sau đại học.">
      {error && <Alert tone="error">{error}</Alert>}
      <form className="flex flex-col gap-4" onSubmit={handleRegister} noValidate>
        <Input
          label="Họ và tên"
          required
          autoComplete="name"
          placeholder="Nguyễn Văn An"
          value={form.fullName}
          onChange={(e) => set("fullName", e.target.value)}
          error={errors.fullName}
          hint="Ghi đúng như trên CCCD, có dấu."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Ngày sinh" required type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} error={errors.dob} />
          <Input
            label="Số điện thoại"
            required
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="09xxxxxxxx"
            value={form.phoneNumber}
            onChange={(e) => set("phoneNumber", e.target.value)}
            error={errors.phoneNumber}
          />
        </div>
        <Input
          label="Email"
          required
          type="email"
          autoComplete="email"
          placeholder="tenban@gmail.com"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          error={errors.email}
          hint="Nên dùng Gmail. Mã xác thực và mọi thông báo hồ sơ được gửi về địa chỉ này."
        />
        <PasswordInput
          label="Mật khẩu"
          required
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
          error={errors.password}
        />
        <PasswordChecklist password={form.password} />
        <PasswordInput
          label="Nhập lại mật khẩu"
          required
          autoComplete="new-password"
          value={form.confirm}
          onChange={(e) => set("confirm", e.target.value)}
          error={errors.confirm}
        />
        <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-gray-600">
          <input
            type="checkbox"
            checked={form.agree}
            onChange={(e) => set("agree", e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#E8734A]"
          />
          <span>
            Tôi cam kết thông tin khai là đúng sự thật và đã đọc{" "}
            <Link href="/announcements?category=QUY_DINH" target="_blank" className="font-semibold text-accent hover:underline">
              quy định tuyển sinh
            </Link>
            .
            {errors.agree && <span className="mt-1 block text-xs font-medium text-danger">{errors.agree}</span>}
          </span>
        </label>
        <Button type="submit" fullWidth loading={loading} className="mt-1">
          Đăng ký và nhận mã xác thực
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

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterInner />
    </Suspense>
  );
}
