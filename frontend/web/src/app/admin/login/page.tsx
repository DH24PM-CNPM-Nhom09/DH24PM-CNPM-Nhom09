"use client";

import BrandMark from "@/components/BrandMark";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { GoogleMark } from "@/components/admin/Icons";
import GoogleSignIn from "@/components/auth/GoogleSignIn";
import { Btn, fieldCls, Label } from "@/components/admin/ui";
import { DEMO_PASSWORD, demoAccounts, staffLogin, staffLoginWithGoogle, USE_MOCK } from "@/lib/admin/api";
import { errorMessage } from "@/lib/admin/format";
import { ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/admin/permissions";
import { readSession } from "@/lib/admin/session";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const target = next && next.startsWith("/admin") && !next.startsWith("/admin/login") ? next : "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState<"password" | "google" | null>(null);
  const [demos, setDemos] = useState<ReturnType<typeof demoAccounts>>([]);

  useEffect(() => {
    if (readSession()) router.replace(target);
    setDemos(demoAccounts());
  }, [router, target]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Nhập email công tác và mật khẩu.");
      return;
    }
    setLoading("password");
    try {
      await staffLogin(email, password);
      router.replace(target);
    } catch (err) {
      setError(errorMessage(err));
      setLoading(null);
    }
  }

  /** Đăng nhập Google thật: idToken do Google Identity Services trả về khi cán bộ chọn tài khoản */
  async function googleReal(idToken: string) {
    setError("");
    setLoading("google");
    try {
      await staffLoginWithGoogle(idToken);
      router.replace(target);
    } catch (err) {
      setError(errorMessage(err));
      setLoading(null);
    }
  }

  async function google() {
    setError("");
    if (USE_MOCK && !email.trim()) {
      setError("Ở chế độ dữ liệu mẫu, nhập email công tác trước để giả lập tài khoản Google.");
      return;
    }
    setLoading("google");
    try {
      // Thật: lấy id_token từ Google Identity Services rồi truyền vào đây
      await staffLoginWithGoogle(email);
      router.replace(target);
    } catch (err) {
      setError(errorMessage(err));
      setLoading(null);
    }
  }

  async function quick(acc: (typeof demos)[number]) {
    setEmail(acc.email);
    setPassword(DEMO_PASSWORD);
    setError("");
    setLoading("password");
    try {
      await staffLogin(acc.email, DEMO_PASSWORD);
      router.replace(target);
    } catch (err) {
      setError(errorMessage(err));
      setLoading(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 lg:flex-row">
      <div className="flex flex-col justify-between bg-navy-900 px-6 py-8 text-white lg:w-[44%] lg:px-14 lg:py-14">
        <div className="flex items-center gap-3">
          <BrandMark size={44} onDark />
          <div className="leading-tight">
            <p className="text-sm font-bold">Tuyển Sinh Sau Đại Học</p>
            <p className="text-xs text-white/60">Trường Đại học An Giang, ĐHQG-HCM</p>
          </div>
        </div>

        <div className="mt-10 hidden lg:block">
          <h1 className="max-w-md text-[34px] font-extrabold leading-[1.15]">Cổng Quản lý dành cho cán bộ tuyển sinh</h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/70">
            Tiếp nhận và thẩm định hồ sơ, cấu hình đợt tuyển sinh, xử lý phúc khảo. Mỗi tài khoản chỉ thấy đúng phần việc theo vai trò được cấp.
          </p>
          <dl className="mt-10 grid max-w-md grid-cols-2 gap-x-6 gap-y-5 text-sm">
            {(Object.keys(ROLE_LABEL) as (keyof typeof ROLE_LABEL)[]).map((r) => (
              <div key={r}>
                <dt className="font-semibold text-white">{ROLE_LABEL[r]}</dt>
                <dd className="mt-1 text-[13px] leading-snug text-white/60">{ROLE_DESCRIPTION[r]}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="mt-6 hidden text-xs text-white/40 lg:block">Thao tác trên cổng này được ghi nhật ký theo quy định bảo mật.</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-5 py-10 lg:px-10">
        <div className="w-full max-w-[420px]">
          <h2 className="text-[26px] font-extrabold text-gray-900">Đăng nhập cán bộ</h2>
          <p className="mt-1.5 text-sm text-gray-500">Dùng email công tác do Phòng Đào tạo Sau đại học cấp.</p>

          {error && (
            <div role="alert" className="mt-5 rounded-input border border-[#F3C9C9] bg-danger-50 px-4 py-3 text-[13px] font-medium text-[#991B1B]">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <div>
              <Label htmlFor="email">Email công tác</Label>
              <input id="email" type="email" autoComplete="username" className={fieldCls} placeholder="ten@agu.edu.vn" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="password">Mật khẩu</Label>
              <input id="password" type="password" autoComplete="current-password" className={fieldCls} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Btn type="submit" variant="primary" className="w-full" loading={loading === "password"}>
              Đăng nhập
            </Btn>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-gray-400">
            <div className="h-px flex-1 bg-gray-200" />
            hoặc
            <div className="h-px flex-1 bg-gray-200" />
          </div>
          {USE_MOCK ? (
            <Btn className="w-full" onClick={google} loading={loading === "google"}>
              <GoogleMark /> Đăng nhập với Google
            </Btn>
          ) : (
            <GoogleSignIn
              onCredential={googleReal}
              onError={setError}
              fallback={
                <Btn className="w-full" onClick={google} loading={loading === "google"}>
                  <GoogleMark /> Đăng nhập với Google (bản demo: nhập email công tác trước)
                </Btn>
              }
            />
          )}

          {demos.length > 0 && (
            <div className="mt-8 rounded-card border border-dashed border-gray-300 bg-white p-4">
              <p className="text-[13px] font-semibold text-gray-700">Tài khoản demo</p>
              <p className="mt-0.5 text-xs text-gray-500">
                Bấm để vào nhanh với từng vai trò{USE_MOCK ? "" : ` (mật khẩu ${DEMO_PASSWORD})`}. Chỉ dùng khi demo, tắt trước khi triển khai thật.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {demos.map((d) => (
                  <button
                    key={d.staffAccountId}
                    type="button"
                    onClick={() => quick(d)}
                    disabled={!!loading}
                    className="rounded-input border border-gray-200 px-3 py-2.5 text-left transition-colors hover:border-accent hover:bg-accent-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
                  >
                    <span className="block text-[13px] font-semibold text-gray-900">{ROLE_LABEL[d.roles[0]]}</span>
                    <span className="block truncate text-xs text-gray-500">{d.email}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="mt-8 text-center text-sm text-gray-500">
            Bạn là thí sinh?{" "}
            <Link href="/login" className="font-semibold text-accent hover:underline">
              Vào cổng thí sinh
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
