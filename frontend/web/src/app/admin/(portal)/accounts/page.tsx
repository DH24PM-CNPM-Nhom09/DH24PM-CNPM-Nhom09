"use client";

import { useState } from "react";
import { RequirePermission, useAdmin } from "@/components/admin/AdminShell";
import { IconPlus } from "@/components/admin/Icons";
import { Btn, EmptyState, ErrorBox, fieldCls, Label, LoadingRows, Modal, PageHeader, StaffStatusBadge, useToast } from "@/components/admin/ui";
import { createStaff, listStaff, offboardStaff, refreshStaff, resetStaffPassword, restoreStaff, setStaffStatus, updateStaffInfo, updateStaffRoles, USE_MOCK } from "@/lib/admin/api";
import { readSession, writeSession } from "@/lib/admin/session";
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
  const [showDeleted, setShowDeleted] = useState(false);
  const { data, error, loading, reload } = useAsync(() => listStaff(showDeleted), [showDeleted]);
  const [offTarget, setOffTarget] = useState<StaffAccount | null>(null);
  const [offReason, setOffReason] = useState("");
  const [q, setQ] = useState("");
  const [roleTarget, setRoleTarget] = useState<StaffAccount | null>(null);
  const [roles, setRoles] = useState<RoleCode[]>([]);
  const [lockTarget, setLockTarget] = useState<StaffAccount | null>(null);
  const [resetTarget, setResetTarget] = useState<StaffAccount | null>(null);
  const [editTarget, setEditTarget] = useState<StaffAccount | null>(null);
  const [editName, setEditName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ staffCode: "", fullName: "", email: "", allowPassword: false, roles: ["CAN_BO_TUYEN_SINH"] as RoleCode[] });
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{ name: string; email: string; password: string } | null>(null);
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

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="w-full max-w-sm">
          <span className="sr-only">Tìm cán bộ</span>
          <input className={fieldCls} placeholder="Tìm theo tên, email hoặc mã cán bộ" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" className="h-4 w-4 accent-[#E8734A]" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
          Hiện cán bộ đã nghỉ việc
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
                  <tr key={s.staffAccountId} className={s.deletedAt ? "bg-gray-50 text-gray-400 [&_*]:!text-gray-400" : ""}>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-gray-900">
                        {s.fullName}
                        {s.staffAccountId === me.staffAccountId && <span className="ml-2 text-xs font-normal text-gray-400">(bạn)</span>}
                        {!s.deletedAt && <button
                          type="button"
                          onClick={() => { setFormError(""); setEditTarget(s); setEditName(s.fullName); }}
                          className="ml-2 rounded px-1.5 py-0.5 text-xs font-semibold text-accent hover:bg-accent-50"
                          aria-label={`Sửa họ tên ${s.fullName}`}
                        >
                          Sửa tên
                        </button>}
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
                    <td className="px-5 py-3.5 text-gray-600">
                      {s.hasPassword ? "Mật khẩu hoặc Google" : "Chỉ Google"}
                      {s.mustChangePassword && <span className="mt-0.5 block text-xs font-semibold text-[#92400E]">Chờ đổi mật khẩu tạm</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      {s.deletedAt ? (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-gray-200 px-2.5 py-1 text-xs font-semibold">
                          Đã nghỉ việc {new Date(s.deletedAt).toLocaleDateString("vi-VN")}
                        </span>
                      ) : (
                        <StaffStatusBadge status={s.status} />
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {s.deletedAt ? (
                        <div className="flex justify-end">
                          <Btn size="sm" className="!text-gray-700" loading={busy} onClick={async () => {
                              setBusy(true);
                              try {
                                await restoreStaff(s.staffAccountId);
                                toast(`Đã khôi phục tài khoản ${s.fullName}.`);
                              } catch (e) {
                                toast(errorMessage(e), "error");
                              } finally {
                                setBusy(false);
                              }
                            }}>
                            Khôi phục
                          </Btn>
                        </div>
                      ) : (
                      <div className="flex flex-wrap justify-end gap-2">
                        <Btn size="sm" onClick={() => { setFormError(""); setRoleTarget(s); setRoles(s.roles); }}>
                          Phân quyền
                        </Btn>
                        {s.staffAccountId !== me.staffAccountId && (
                          <Btn size="sm" onClick={() => { setFormError(""); setResetTarget(s); }} title="Cấp mật khẩu tạm mới khi cán bộ quên mật khẩu">
                            Cấp lại mật khẩu
                          </Btn>
                        )}
                        {s.staffAccountId !== me.staffAccountId && (
                          <Btn size="sm" variant={s.status === "ACTIVE" ? "danger" : "outline"} onClick={() => { setFormError(""); setLockTarget(s); }}>
                            {s.status === "ACTIVE" ? "Khóa" : "Mở khóa"}
                          </Btn>
                        )}
                        {s.staffAccountId !== me.staffAccountId && (
                          <Btn size="sm" variant="danger" onClick={() => { setFormError(""); setOffReason(""); setOffTarget(s); }} title="Cán bộ nghỉ làm: vô hiệu tài khoản, giữ nguyên lịch sử">
                            Cho nghỉ việc
                          </Btn>
                        )}
                      </div>
                      )}
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
                  async () => {
                    const created = await createStaff(form);
                    if (created.temporaryPassword) setIssued({ name: created.fullName, email: created.email, password: created.temporaryPassword });
                  },
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
              <span className="block text-xs text-gray-500">Mặc định chỉ đăng nhập bằng Google. Bật mục này, hệ thống tạo mật khẩu tạm để bạn chuyển cho cán bộ.</span>
            </span>
          </label>
        </div>
        <div className="mt-5">
          <RolePicker value={form.roles} onChange={(r) => setForm({ ...form, roles: r })} />
        </div>
        {formError && <div className="mt-3"><ErrorBox message={formError} /></div>}
      </Modal>
      <Modal
        open={!!offTarget}
        onClose={() => setOffTarget(null)}
        title="Cho cán bộ nghỉ việc?"
        description="Tài khoản bị vô hiệu ngay và ẩn khỏi danh sách. Dữ liệu KHÔNG bị xóa: lịch sử thẩm định, nhật ký, thông báo đã đăng vẫn giữ tên người này. Hồ sơ người này đang phụ trách mà chưa kết luận sẽ được trả về hàng chờ cho cán bộ khác tiếp nhận."
        footer={
          <>
            <Btn onClick={() => setOffTarget(null)}>Hủy</Btn>
            <Btn
              variant="danger"
              loading={busy}
              onClick={() =>
                offTarget &&
                run(
                  async () => {
                    const r = await offboardStaff(offTarget.staffAccountId, offReason);
                    if (r.releasedApplications) toast(`Đã trả ${r.releasedApplications} hồ sơ về hàng chờ.`, "info");
                  },
                  `Đã cho ${offTarget.fullName} nghỉ việc.`,
                  () => setOffTarget(null),
                )
              }
            >
              Xác nhận cho nghỉ việc
            </Btn>
          </>
        }
      >
        {offTarget && (
          <div className="grid gap-3">
            <p className="rounded-input bg-gray-50 px-3 py-2.5 text-sm">
              <span className="font-semibold text-gray-900">{offTarget.fullName}</span> <span className="text-gray-500">({offTarget.staffCode}, {offTarget.email})</span>
            </p>
            <div>
              <Label htmlFor="off-reason">Lý do (không bắt buộc)</Label>
              <input id="off-reason" className={fieldCls} maxLength={200} placeholder="VD: Chuyển công tác từ 01/11/2026" value={offReason} onChange={(e) => setOffReason(e.target.value)} />
            </div>
            <p className="text-xs text-gray-500">Có thể khôi phục lại khi người này quay lại làm: bật “Hiện cán bộ đã nghỉ việc” rồi bấm “Khôi phục”.</p>
          </div>
        )}
        {formError && <div className="mt-3"><ErrorBox message={formError} /></div>}
      </Modal>
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Sửa họ tên"
        description="Tên hiển thị trong hệ thống và nhật ký. Email đăng nhập và mã cán bộ không đổi."
        footer={
          <>
            <Btn onClick={() => setEditTarget(null)}>Hủy</Btn>
            <Btn
              variant="navy"
              loading={busy}
              onClick={() =>
                editTarget &&
                run(
                  async () => {
                    const updated = await updateStaffInfo(editTarget.staffAccountId, editName);
                    // Sửa tên chính mình -> cập nhật ngay tên ở thanh bên và lời chào
                    if (editTarget.staffAccountId === me.staffAccountId) {
                      const ss = readSession();
                      if (ss) writeSession({ ...ss, staff: { ...ss.staff, fullName: updated.fullName } });
                      if (!USE_MOCK) await refreshStaff().catch(() => undefined);
                    }
                    await reload(true);
                  },
                  "Đã cập nhật họ tên.",
                  () => setEditTarget(null),
                )
              }
            >
              Lưu
            </Btn>
          </>
        }
      >
        {editTarget && (
          <div>
            <Label htmlFor="edit-name" required>
              Họ tên
            </Label>
            <input id="edit-name" className={fieldCls} maxLength={255} value={editName} onChange={(e) => setEditName(e.target.value)} />
            <p className="mt-1.5 text-xs text-gray-500">
              {editTarget.staffCode} · {editTarget.email}
            </p>
          </div>
        )}
        {formError && <div className="mt-3"><ErrorBox message={formError} /></div>}
      </Modal>
      <Modal
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title="Cấp lại mật khẩu tạm?"
        description="Mật khẩu cũ của cán bộ sẽ không dùng được nữa. Hệ thống tạo mật khẩu tạm mới (hiển thị một lần) và bắt cán bộ đổi ở lần đăng nhập tới."
        footer={
          <>
            <Btn onClick={() => setResetTarget(null)}>Hủy</Btn>
            <Btn
              variant="navy"
              loading={busy}
              onClick={() =>
                resetTarget &&
                run(
                  async () => {
                    const r = await resetStaffPassword(resetTarget.staffAccountId);
                    setIssued({ name: resetTarget.fullName, email: resetTarget.email, password: r.temporaryPassword });
                    await reload(true);
                  },
                  "Đã cấp mật khẩu tạm mới.",
                  () => setResetTarget(null),
                )
              }
            >
              Cấp mật khẩu tạm
            </Btn>
          </>
        }
      >
        {resetTarget && (
          <p className="rounded-input bg-gray-50 px-3 py-2.5 text-sm">
            <span className="font-semibold text-gray-900">{resetTarget.fullName}</span> <span className="text-gray-500">({resetTarget.email})</span>
          </p>
        )}
        {formError && <div className="mt-3"><ErrorBox message={formError} /></div>}
      </Modal>
      <Modal
        open={!!issued}
        onClose={() => setIssued(null)}
        title="Mật khẩu tạm thời"
        description="Chỉ hiển thị một lần. Gửi cho cán bộ qua kênh an toàn (gặp trực tiếp, tin nhắn riêng). Hệ thống bắt cán bộ đổi mật khẩu ngay ở lần đăng nhập đầu."
        footer={
          <Btn variant="navy" onClick={() => setIssued(null)}>
            Đã ghi lại
          </Btn>
        }
      >
        {issued && (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-gray-500">Cán bộ</dt>
              <dd className="font-semibold text-gray-900">{issued.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Email đăng nhập</dt>
              <dd className="font-mono text-gray-900">{issued.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Mật khẩu tạm</dt>
              <dd className="select-all rounded-input bg-gray-100 px-3 py-2 font-mono text-base font-semibold tracking-wide text-gray-900">{issued.password}</dd>
            </div>
          </dl>
        )}
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
