"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { getMyProfile, updateMyProfile } from "@/lib/api";
import type { Candidate } from "@/lib/types";

export default function ProfilePage() {
  const [profile, setProfile] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getMyProfile()
      .then(setProfile)
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setSaved(false);
    try {
      await updateMyProfile(profile);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  function set<K extends keyof Candidate>(key: K, value: Candidate[K]) {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-[700px]">
        <h1 className="text-2xl font-extrabold text-gray-900">Hồ sơ cá nhân</h1>
        <p className="mt-1 text-sm text-gray-500">
          Thông tin cá nhân dùng để lập hồ sơ xét tuyển. Vui lòng đảm bảo thông tin chính xác.
        </p>

        {loading || !profile ? (
          <div className="mt-6 h-96 animate-pulse rounded-card bg-gray-100" />
        ) : (
          <Card className="mt-6 p-6">
            {saved && (
              <div className="mb-5 rounded-input bg-success-50 px-4 py-3 text-[13px] font-medium text-success">
                Đã lưu thông tin thành công.
              </div>
            )}
            <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handleSave}>
              <div className="sm:col-span-2">
                <Input label="Họ và tên" required value={profile.fullName} onChange={(e) => set("fullName", e.target.value)} />
              </div>
              <Input
                label="Ngày sinh"
                type="date"
                required
                value={profile.dob}
                onChange={(e) => set("dob", e.target.value)}
              />
              <Select
                label="Giới tính"
                value={profile.gender ?? ""}
                onChange={(e) => set("gender", (e.target.value || null) as Candidate["gender"])}
              >
                <option value="">-- Chọn --</option>
                <option value="NAM">Nam</option>
                <option value="NU">Nữ</option>
                <option value="KHAC">Khác</option>
              </Select>
              <Input
                label="Số CCCD/CMND"
                value={profile.idNumber ?? ""}
                onChange={(e) => set("idNumber", e.target.value)}
              />
              <Input
                label="Số điện thoại"
                value={profile.phoneNumber ?? ""}
                onChange={(e) => set("phoneNumber", e.target.value)}
              />
              <div className="sm:col-span-2">
                <Input
                  label="Email"
                  type="email"
                  value={profile.email ?? ""}
                  onChange={(e) => set("email", e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Input
                  label="Địa chỉ"
                  value={profile.address ?? ""}
                  onChange={(e) => set("address", e.target.value)}
                />
              </div>
              <div className="sm:col-span-2 mt-2">
                <Button type="submit" loading={saving}>
                  Lưu thay đổi
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
