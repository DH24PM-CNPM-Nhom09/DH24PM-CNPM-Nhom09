"use client";

import { useState } from "react";
import { RequirePermission, useAdmin } from "@/components/admin/AdminShell";
import { IconPlus } from "@/components/admin/Icons";
import { Btn, EmptyState, ErrorBox, fieldCls, Label, LoadingRows, Modal, PageHeader, StaffStatusBadge, useToast } from "@/components/admin/ui";
import { createStaff, listStaff, setStaffStatus, updateStaffRoles } from "@/lib/admin/api";
import { errorMessage } from "@/lib/admin/format";
import { ALL_ROLES, PERMISSION_MATRIX, ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/admin/permissions";
import type { RoleCode, StaffAccount } from "@/lib/admin/types";
import { useAsync } from "@/lib/admin/useAsync";

function RolePicker({ value, onChange }: { value: RoleCode[]; onChange: (v: RoleCode[]) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-[13px] font-semibold text-gray-700">
        Vai trò <span className="text-danger">*</span>
      </legend>
      <div className="space-y-2">
        {ALL_ROLES.map((r) => {
          const checked = value.includes(r);
          return (
            <label key={r} className={`flex cursor-pointer gap-3 rounded-input border px-3.5 py-3 ${checked ? "border-navy-800 bg-navy-50" : "border-gray-200 hover:border-gray-300"}`}>
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#1B3A66]" checked={checked} onChange={(e) => onChange(e.target.checked ? [...value, r] : value.filter((x) => x !== r))} />
              <span>
                <span className="block text-sm font-semibold text-gray-900">{ROLE_LABEL[r]}</span>
                <span className="block text-xs text-gray-500">{ROLE_DESCRIPTION[r]}</span>
                <span className="mt-1 block text-[11px] text-gray-400">{PERMISSION_MATRIX[r].length} quyền</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function AccountsInner() {
  const { staff: me } = useAdmin();
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(listStaff, []);
  const [q, setQ] = useState("");
  const [roleTarget, setRoleTarget] = useState<StaffAccount | null>(null);
  const [roles, setRoles] = useState<RoleCode[]>([]);
  const [lockTarget, setLockTarget] = useState<StaffAccount | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ staffCode: "", fullName: "", email: "", allowPassword: false, roles: ["CAN_BO_TUYEN_SINH"] as RoleCode[] });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const list = (data ?? []).filter((s) => !q.trim() || `${s.fullName} ${s.email} ${s.staffCode}`.toLowerCase().includes(q.trim().toLowerCase()));

  async function run(fn: () => Promise<unknown>, ok: string, close: () => void) {
    setBusy(true);
    setFormError("");
    try {
      await fn();
      close();
      toast(ok);
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Tài khoản cán bộ"
        description="Cấp tài khoản và phân vai trò. Quyền chi tiết của từng vai trò cố định theo quy chế; một cán bộ có thể giữ nhiều vai trò."
        actions={
          <Btn variant="primary" onClick={() => { setFormError(""); setCreateOpen(true); }}>
            <IconPlus size={16} /> Cấp tài khoản
          </Btn>
        }
      />

      <div className="mb-4 max-w-sm">
        <label>
          <span className="sr-only">Tìm cán bộ</span>
          <input className={fieldCls} placeholder="Tìm theo tên, email hoặc mã cán bộ" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      {error && <ErrorBox message={error} onRetry={() => reload()} />}

      <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
        {loading && !data ? (
          <LoadingRows rows={5} />
        ) : list.length === 0 ? (
          <EmptyState title="Không tìm thấy cán bộ" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500">
                <tr>
                  <th className="px-5 py-3">Cán bộ</th>
                  <th className="px-5 py-3">Vai trò</th>
                  <th className="px-5 py-3">Cách đăng nhập</th>
                  <th className="px-5 py-3">Trạng thái</th>
                  <th className="px-5 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.map((s) => (
                  <tr key={s.staffAccountId}>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-gray-900">
                        {s.fullName}
                        {s.staffAccountId === me.staffAccountId && <span className="ml-2 text-xs font-normal text-gray-400">(bạn)</span>}
                      </p>
                      <p className="text-[13px] text-gray-500">
                        <span className="font-mono">{s.staffCode}</span>, {s.email}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        {s.roles.map((r) => (
                          <span key={r} className="rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                            {ROLE_LABEL[r]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{s.hasPassword ? "Mật khẩu hoặc Google" : "Chỉ Google"}</td>
                    <td className="px-5 py-3.5">
                      <StaffStatusBadge status={s.status} />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-2">
                        <Btn size="sm" onClick={() => { setFormError(""); setRoleTarget(s); setRoles(s.roles); }}>
                          Phân quyền
                        </Btn>
                        {s.staffAccountId !== me.staffAccountId && (
                          <Btn size="sm" variant={s.status === "ACTIVE" ? "danger" : "outline"} onClick={() => { setFormError(""); setLockTarget(s); }}>
                            {s.status === "ACTIVE" ? "Khóa" : "Mở khóa"}
                          </Btn>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={!!roleTarget}
        onClose={() => setRoleTarget(null)}
        title={roleTarget ? `Phân quyền cho ${roleTarget.fullName}` : ""}
        description="Thay đổi có hiệu lực ở lần tải trang kế tiếp của cán bộ đó."
        footer={
          <>
            <Btn onClick={() => setRoleTarget(null)}>Hủy</Btn>
            <Btn variant="navy" loading={busy} disabled={roles.length === 0} onClick={() => roleTarget && run(() => updateStaffRoles(roleTarget.staffAccountId, roles), "Đã cập nhật vai trò.", () => setRoleTarget(null))}>
              Lưu vai trò
            </Btn>
          </>
        }
      >
        <RolePicker value={roles} onChange={setRoles} />
        {formError && <div className="mt-3"><ErrorBox message={formError} /></div>}
      </Modal>

      <Modal
        open={!!lockTarget}
        onClose={() => setLockTarget(null)}
        title={lockTarget ? `${lockTarget.status === "ACTIVE" ? "Khóa" : "Mở khóa"} tài khoản ${lockTarget.fullName}?` : ""}
        description={lockTarget?.status === "ACTIVE" ? "Cán bộ bị đăng xuất ngay và không đăng nhập lại được cho tới khi mở khóa. Dữ liệu đã xử lý vẫn giữ nguyên." : "Cán bộ đăng nhập lại được với vai trò hiện có."}
        footer={
          <>
            <Btn onClick={() => setLockTarget(null)}>Hủy</Btn>
            <Btn
              variant={lockTarget?.status === "ACTIVE" ? "danger" : "navy"}
              loading={busy}
              onClick={() => lockTarget && run(() => setStaffStatus(lockTarget.staffAccountId, lockTarget.status === "ACTIVE" ? "LOCKED" : "ACTIVE"), lockTarget.status === "ACTIVE" ? "Đã khóa tài khoản." : "Đã mở khóa tài khoản.", () => setLockTarget(null))}
            >
              {lockTarget?.status === "ACTIVE" ? "Khóa tài khoản" : "Mở khóa"}
            </Btn>
          </>
        }
      >
        {formError && <ErrorBox message={formError} />}
      </Modal>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Cấp tài khoản cán bộ"
        width="max-w-xl"
        footer={
          <>
            <Btn onClick={() => setCreateOpen(false)}>Hủy</Btn>
            <Btn
              variant="primary"
              loading={busy}
              onClick={() =>
                run(
                  () => createStaff(form),
                  `Đã cấp tài khoản cho ${form.fullName}.`,
                  () => {
                    setCreateOpen(false);
                    setForm({ staffCode: "", fullName: "", email: "", allowPassword: false, roles: ["CAN_BO_TUYEN_SINH"] });
                  },
                )
              }
            >
              Cấp tài khoản
            </Btn>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
          <div>
            <Label htmlFor="s-code" required>Mã cán bộ</Label>
            <input id="s-code" className={`${fieldCls} font-mono uppercase`} placeholder="CBTS-004" value={form.staffCode} onChange={(e) => setForm({ ...form, staffCode: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="s-name" required>Họ tên</Label>
            <input id="s-name" className={fieldCls} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="s-email" required>Email công tác</Label>
            <input id="s-email" type="email" className={fieldCls} placeholder="ten@agu.edu.vn" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <label className="flex items-start gap-2.5 text-sm text-gray-700 sm:col-span-2">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#1B3A66]" checked={form.allowPassword} onChange={(e) => setForm({ ...form, allowPassword: e.target.checked })} />
            <span>
              Cho phép đăng nhập bằng mật khẩu
              <span className="block text-xs text-gray-500">Mặc định chỉ đăng nhập bằng Google. Bật mục này, hệ thống gửi email đặt mật khẩu lần đầu.</span>
            </span>
          </label>
        </div>
        <div className="mt-5">
          <RolePicker value={form.roles} onChange={(r) => setForm({ ...form, roles: r })} />
        </div>
        {formError && <div className="mt-3"><ErrorBox message={formError} /></div>}
      </Modal>
    </>
  );
}

export default function AccountsPage() {
  return (
    <RequirePermission perm="account:manage">
      <AccountsInner />
    </RequirePermission>
  );
}
