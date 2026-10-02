"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Alert, errMsg } from "@/components/auth/AuthBits";
import { getMyProfile, updateMyProfile } from "@/lib/api";
import type { Candidate } from "@/lib/types";

const REQUIRED: { key: keyof Candidate; label: string }[] = [
  { key: "fullName", label: "Họ và tên" },
  { key: "dob", label: "Ngày sinh" },
  { key: "gender", label: "Giới tính" },
  { key: "idNumber", label: "Số CCCD" },
  { key: "phoneNumber", label: "Số điện thoại" },
  { key: "address", label: "Địa chỉ liên hệ" },
];

function fmtDate(iso?: string) {
  return iso ? new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
}

function ProfileInner() {
  const params = useSearchParams();
  const welcome = params.get("welcome");
  const googleName = params.get("name");
  const [profile, setProfile] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyProfile()
      // Lần đầu đăng nhập Google: điền sẵn họ tên lấy từ tài khoản Google
      .then((p) => setProfile(!p.fullName && googleName ? { ...p, fullName: googleName } : p))
      .catch((e) => setLoadError(errMsg(e, "Không tải được hồ sơ cá nhân.")))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await updateMyProfile({
        fullName: profile.fullName,
        dob: profile.dob,
        gender: profile.gender,
        idNumber: profile.idNumber,
        phoneNumber: profile.phoneNumber,
        address: profile.address,
      });
      setSaved(true);
    } catch (e) {
      setError(errMsg(e, "Lưu thất bại, vui lòng thử lại."));
    } finally {
      setSaving(false);
    }
  }

  function set<K extends keyof Candidate>(key: K, value: Candidate[K]) {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
    setSaved(false);
  }

  const missing = profile ? REQUIRED.filter((f) => !String(profile[f.key] ?? "").trim()) : [];
  const done = REQUIRED.length - missing.length;

  return (
    <AppLayout>
      <div className="mx-auto max-w-[760px]">
        <h1 className="text-2xl font-extrabold text-gray-900">Hồ sơ cá nhân</h1>
        <p className="mt-1 text-sm text-gray-500">Thông tin dùng để lập hồ sơ xét tuyển và liên hệ với bạn. Vui lòng khai đúng như trên giấy tờ tùy thân.</p>

        {welcome === "1" && (
          <div className="mt-6">
            <Alert tone="success">
              Tài khoản đã được kích hoạt. Thông tin bạn khai khi đăng ký đã được điền sẵn bên dưới; hãy bổ sung số CCCD, giới tính và địa chỉ để có thể tạo hồ sơ xét tuyển.
            </Alert>
          </div>
        )}
        {welcome === "google" && (
          <div className="mt-6">
            <Alert tone="success">
              Chào mừng bạn! Đây là lần đầu bạn đăng nhập bằng Google. Hãy khai ngày sinh, số điện thoại, CCCD và địa chỉ rồi bấm “Lưu thay đổi” để hoàn tất hồ sơ cá nhân.
            </Alert>
          </div>
        )}

        {loadError ? (
          <Card className="mt-6 p-6 text-sm font-medium text-danger">{loadError}</Card>
        ) : loading || !profile ? (
          <div className="mt-6 h-96 animate-pulse rounded-card bg-gray-100" />
        ) : (
          <>
            {/* Mức độ hoàn thiện */}
            <Card className="mt-6 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-gray-900">
                  Mức độ hoàn thiện: {done}/{REQUIRED.length} mục
                </p>
                {missing.length === 0 ? (
                  <span className="text-[13px] font-semibold text-success">✓ Đủ thông tin để nộp hồ sơ</span>
                ) : (
                  <span className="text-[13px] text-gray-500">Còn thiếu: {missing.map((m) => m.label).join(", ")}</span>
                )}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuemin={0} aria-valuemax={REQUIRED.length} aria-valuenow={done}>
                <div className={`h-full rounded-full ${missing.length ? "bg-accent" : "bg-success"}`} style={{ width: `${(done / REQUIRED.length) * 100}%` }} />
              </div>
            </Card>

            {/* Tài khoản */}
            <Card className="mt-4 p-6">
              <h2 className="text-base font-bold text-gray-900">Tài khoản đăng nhập</h2>
              <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Email</dt>
                  <dd className="mt-1 flex flex-wrap items-center gap-2 font-semibold text-gray-900">
                    {profile.email ?? "—"}
                    {profile.email && <span className="rounded-full bg-success-50 px-2 py-0.5 text-xs font-semibold text-success">Đã xác thực</span>}
                  </dd>
                  <dd className="mt-1 text-xs text-gray-400">Dùng để đăng nhập và nhận mã xác thực, thông báo hồ sơ. Không thay đổi được.</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Ngày tạo tài khoản</dt>
                  <dd className="mt-1 font-semibold text-gray-900">{fmtDate(profile.accountCreatedAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Mật khẩu</dt>
                  <dd className="mt-1">
                    <Link href="/forgot-password" className="font-semibold text-accent hover:underline">
                      {profile.hasPassword === false ? "Tạo mật khẩu" : "Đổi mật khẩu"} →
                    </Link>
                  </dd>
                </div>
              </dl>
            </Card>

            {/* Thông tin cá nhân */}
            <Card className="mt-4 p-6">
              <h2 className="text-base font-bold text-gray-900">Thông tin cá nhân</h2>
              <div className="mt-4">
                {saved && <Alert tone="success">Đã lưu thông tin cá nhân.</Alert>}
                {error && <Alert tone="error">{error}</Alert>}
              </div>
              <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handleSave}>
                <div className="sm:col-span-2">
                  <Input label="Họ và tên" required value={profile.fullName} onChange={(e) => set("fullName", e.target.value)} />
                </div>
                <Input label="Ngày sinh" type="date" required value={profile.dob} onChange={(e) => set("dob", e.target.value)} />
                <Select label="Giới tính" required value={profile.gender ?? ""} onChange={(e) => set("gender", (e.target.value || null) as Candidate["gender"])}>
                  <option value="">-- Chọn --</option>
                  <option value="NAM">Nam</option>
                  <option value="NU">Nữ</option>
                  <option value="KHAC">Khác</option>
                </Select>
                <Input
                  label="Số CCCD"
                  required
                  inputMode="numeric"
                  maxLength={12}
                  placeholder="12 chữ số"
                  value={profile.idNumber ?? ""}
                  onChange={(e) => set("idNumber", e.target.value.replace(/\D/g, ""))}
                />
                <Input
                  label="Số điện thoại"
                  required
                  type="tel"
                  inputMode="numeric"
                  value={profile.phoneNumber ?? ""}
                  onChange={(e) => set("phoneNumber", e.target.value)}
                />
                <Input label="Quốc tịch" value={profile.nationality ?? "Việt Nam"} disabled className="bg-gray-50 text-gray-500" />
                <div className="sm:col-span-2">
                  <Input
                    label="Địa chỉ liên hệ"
                    required
                    placeholder="Số nhà, đường, phường/xã, tỉnh/thành phố"
                    value={profile.address ?? ""}
                    onChange={(e) => set("address", e.target.value)}
                  />
                </div>
                <div className="mt-2 sm:col-span-2">
                  <Button type="submit" loading={saving}>
                    Lưu thay đổi
                  </Button>
                </div>
              </form>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileInner />
    </Suspense>
  );
}
