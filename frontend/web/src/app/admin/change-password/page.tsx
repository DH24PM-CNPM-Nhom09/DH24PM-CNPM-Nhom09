"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { IconKey } from "@/components/admin/Icons";
import { Btn, fieldCls, Label } from "@/components/admin/ui";
import { changeOwnPassword, staffLogout } from "@/lib/admin/api";
import { errorMessage } from "@/lib/admin/format";
import { useStaffSession } from "@/lib/admin/session";

/** Quy tắc mật khẩu cán bộ — khớp backend: ≥ 8 ký tự, có chữ hoa, chữ thường, chữ số */
function rules(pw: string) {
  return [
    { ok: pw.length >= 8, label: "Ít nhất 8 ký tự" },
    { ok: /[A-Z]/.test(pw), label: "Có chữ hoa" },
    { ok: /[a-z]/.test(pw), label: "Có chữ thường" },
    { ok: /\d/.test(pw), label: "Có chữ số" },
  ];
}

export default function ChangePasswordPage() {
  const session = useStaffSession();
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session === null) router.replace("/admin/login?next=/admin/change-password");
  }, [session, router]);

  if (!session) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  const forced = !!session.staff.mustChangePassword;
  const googleOnly = !session.staff.hasPassword;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!current) return setError("Nhập mật khẩu hiện tại.");
    if (rules(next).some((r) => !r.ok)) return setError("Mật khẩu mới chưa đạt yêu cầu bên dưới.");
    if (next !== confirm) return setError("Mật khẩu nhập lại không khớp.");
    setLoading(true);
    try {
      await changeOwnPassword(current, next);
      setDone(true);
      setTimeout(() => router.replace("/admin"), 1200);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-[440px] rounded-card border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-navy-50 text-navy-800">
          <IconKey size={22} />
        </div>
        <h1 className="text-xl font-bold text-gray-900">{forced ? "Đổi mật khẩu tạm" : "Đổi mật khẩu"}</h1>
        <p className="mt-1.5 text-sm text-gray-500">
          {forced
            ? "Bạn đang dùng mật khẩu tạm do quản trị hệ thống cấp. Để bảo mật, hãy đặt mật khẩu mới trước khi sử dụng hệ thống."
            : `Tài khoản: ${session.staff.email}`}
        </p>

        {googleOnly ? (
          <div className="mt-6 rounded-input bg-navy-50 px-4 py-3 text-sm text-navy-800">
            Tài khoản này chỉ đăng nhập bằng Google nên không có mật khẩu để đổi. Bảo mật tài khoản do Google quản lý.
          </div>
        ) : done ? (
          <div className="mt-6 rounded-input bg-[#EAF7EE] px-4 py-3 text-sm font-medium text-[#166534]" role="status">
            Đã đổi mật khẩu. Đang chuyển vào hệ thống…
          </div>
        ) : (
          <form className="mt-6 grid gap-4" onSubmit={submit} noValidate>
            {error && (
              <div role="alert" className="rounded-input bg-[#FDECEC] px-3 py-2.5 text-[13px] font-medium text-[#B91C1C]">
                {error}
              </div>
            )}
            <div>
              <Label htmlFor="cur" required>
                {forced ? "Mật khẩu tạm được cấp" : "Mật khẩu hiện tại"}
              </Label>
              <input id="cur" type={show ? "text" : "password"} autoComplete="current-password" className={fieldCls} value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="new" required>
                Mật khẩu mới
              </Label>
              <input id="new" type={show ? "text" : "password"} autoComplete="new-password" className={fieldCls} value={next} onChange={(e) => setNext(e.target.value)} />
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium" aria-label="Yêu cầu mật khẩu">
                {rules(next).map((r) => (
                  <li key={r.label} className={r.ok ? "text-[#166534]" : "text-gray-400"}>
                    {r.ok ? "✓" : "○"} {r.label}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <Label htmlFor="cf" required>
                Nhập lại mật khẩu mới
              </Label>
              <input id="cf" type={show ? "text" : "password"} autoComplete="new-password" className={fieldCls} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-[13px] text-gray-600">
              <input type="checkbox" className="h-4 w-4 accent-[#E8734A]" checked={show} onChange={(e) => setShow(e.target.checked)} />
              Hiện mật khẩu
            </label>
            <Btn type="submit" variant="primary" className="w-full" loading={loading}>
              Lưu mật khẩu mới
            </Btn>
          </form>
        )}

        <div className="mt-6 flex items-center justify-between text-sm">
          {forced ? (
            <button
              type="button"
              onClick={() => {
                staffLogout();
                router.replace("/admin/login");
              }}
              className="font-semibold text-gray-500 hover:text-gray-800"
            >
              Đăng xuất
            </button>
          ) : (
            <Link href="/admin" className="font-semibold text-gray-500 hover:text-gray-800">
              ← Quay lại
            </Link>
          )}
          <span className="text-xs text-gray-400">Không dùng lại mật khẩu ở nơi khác.</span>
        </div>
      </div>
    </div>
  );
}
