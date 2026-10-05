"use client";

import { useMemo, useState } from "react";
import { RequirePermission, useAdmin } from "@/components/admin/AdminShell";
import { IconPlus, IconSearch } from "@/components/admin/Icons";
import { Btn, EmptyState, ErrorBox, fieldCls, Label, LoadingRows, Modal, Notice, PageHeader, useToast } from "@/components/admin/ui";
import { createMajor, listMajors, updateMajor, type MajorInput, type MajorRow } from "@/lib/admin/api";
import { DEGREE_LABEL, errorMessage } from "@/lib/admin/format";
import { useAsync } from "@/lib/admin/useAsync";

const EMPTY: MajorInput = { majorCode: "", majorName: "", degreeLevel: "THAC_SI", facultyName: "" };

function Inner() {
  const { can } = useAdmin();
  const toast = useToast();
  const canManage = can("batch:manage");
  const { data, error, loading, reload } = useAsync(() => listMajors(), []);
  const [q, setQ] = useState("");
  const [degree, setDegree] = useState<"" | "THAC_SI" | "TIEN_SI">("");
  const [editing, setEditing] = useState<MajorRow | "new" | null>(null);
  const [form, setForm] = useState<MajorInput>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data ?? []).filter((m) => (!degree || m.degreeLevel === degree) && (!t || `${m.majorCode} ${m.majorName} ${m.facultyName}`.toLowerCase().includes(t)));
  }, [data, q, degree]);

  function open(m: MajorRow | "new") {
    setFormError("");
    setEditing(m);
    setForm(m === "new" ? EMPTY : { majorCode: m.majorCode, majorName: m.majorName, degreeLevel: m.degreeLevel, facultyName: m.facultyName });
  }

  async function save() {
    setBusy(true);
    setFormError("");
    try {
      if (editing === "new") {
        await createMajor(form);
        toast(`Đã thêm ngành ${form.majorName}.`);
      } else if (editing) {
        await updateMajor(editing.majorId, form);
        toast("Đã lưu thay đổi.");
      }
      setEditing(null);
      reload(true);
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(m: MajorRow) {
    try {
      await updateMajor(m.majorId, { status: m.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
      toast(m.status === "ACTIVE" ? `Đã ngừng tuyển ngành ${m.majorName}.` : `Ngành ${m.majorName} tuyển sinh trở lại.`);
      reload(true);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  const used = editing && editing !== "new" && editing.batchCount > 0;

  return (
    <>
      <PageHeader
        title="Danh mục ngành đào tạo"
        description="Các ngành thạc sĩ, tiến sĩ của Trường. Thêm ngành ở đây trước, rồi vào Đợt tuyển sinh để mở ngành và đặt chỉ tiêu cho từng đợt."
        actions={
          canManage ? (
            <Btn variant="primary" onClick={() => open("new")}>
              <IconPlus size={16} /> Thêm ngành
            </Btn>
          ) : undefined
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
        <label className="relative block">
          <span className="sr-only">Tìm ngành</span>
          <IconSearch size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className={`${fieldCls} pl-9`} placeholder="Mã ngành, tên ngành hoặc khoa" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label>
          <span className="sr-only">Bậc đào tạo</span>
          <select className={fieldCls} value={degree} onChange={(e) => setDegree(e.target.value as typeof degree)}>
            <option value="">Tất cả bậc</option>
            <option value="THAC_SI">Thạc sĩ</option>
            <option value="TIEN_SI">Tiến sĩ</option>
          </select>
        </label>
      </div>

      {error && <ErrorBox message={error} onRetry={() => reload()} />}

      <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
        {loading && !data ? (
          <LoadingRows />
        ) : rows.length === 0 ? (
          <EmptyState title="Chưa có ngành phù hợp">{canManage ? "Bấm “Thêm ngành” để nhập ngành theo thông báo tuyển sinh." : null}</EmptyState>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rows.map((m) => (
              <li key={m.majorId} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className={`font-semibold ${m.status === "ACTIVE" ? "text-gray-900" : "text-gray-400 line-through"}`}>{m.majorName}</span>
                    <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-semibold text-navy-800">{DEGREE_LABEL[m.degreeLevel]}</span>
                    {m.status === "INACTIVE" && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">Ngừng tuyển</span>}
                  </p>
                  <p className="text-xs text-gray-500">
                    Mã <span className="font-mono">{m.majorCode}</span>
                    {m.facultyName && ` · ${m.facultyName}`} · mở trong {m.batchCount} đợt · {m.applicationCount} hồ sơ
                  </p>
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-2">
                    <Btn size="sm" onClick={() => open(m)}>
                      Sửa
                    </Btn>
                    <Btn size="sm" variant={m.status === "ACTIVE" ? "ghost" : "success"} onClick={() => toggle(m)}>
                      {m.status === "ACTIVE" ? "Ngừng tuyển" : "Tuyển lại"}
                    </Btn>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Thêm ngành đào tạo" : "Sửa ngành đào tạo"}
        footer={
          <>
            <Btn onClick={() => setEditing(null)}>Hủy</Btn>
            <Btn variant="primary" loading={busy} onClick={save}>
              {editing === "new" ? "Thêm ngành" : "Lưu"}
            </Btn>
          </>
        }
      >
        <div className="grid gap-4">
          {used && <Notice tone="blue">Ngành đã được mở trong đợt tuyển sinh nên không đổi được mã ngành và bậc đào tạo.</Notice>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="mj-code" required>
                Mã ngành
              </Label>
              <input id="mj-code" className={`${fieldCls} font-mono`} value={form.majorCode} disabled={!!used} maxLength={20} placeholder="VD: 8340101" onChange={(e) => setForm({ ...form, majorCode: e.target.value.toUpperCase().replace(/\s/g, "") })} />
            </div>
            <div>
              <Label htmlFor="mj-degree" required>
                Bậc đào tạo
              </Label>
              <select id="mj-degree" className={fieldCls} value={form.degreeLevel} disabled={!!used} onChange={(e) => setForm({ ...form, degreeLevel: e.target.value as MajorInput["degreeLevel"] })}>
                <option value="THAC_SI">Thạc sĩ</option>
                <option value="TIEN_SI">Tiến sĩ</option>
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="mj-name" required>
              Tên ngành
            </Label>
            <input id="mj-name" className={fieldCls} value={form.majorName} maxLength={255} placeholder="VD: Quản trị kinh doanh" onChange={(e) => setForm({ ...form, majorName: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="mj-faculty">Khoa phụ trách</Label>
            <input id="mj-faculty" className={fieldCls} value={form.facultyName} maxLength={255} placeholder="VD: Khoa Kinh tế - Quản trị kinh doanh" onChange={(e) => setForm({ ...form, facultyName: e.target.value })} />
          </div>
          <p className="text-xs text-gray-500">Mã ngành ghi theo Danh mục thống kê ngành đào tạo của Bộ GD&ĐT (thạc sĩ bắt đầu bằng 8, tiến sĩ bắt đầu bằng 9).</p>
          {formError && <ErrorBox message={formError} />}
        </div>
      </Modal>
    </>
  );
}

export default function MajorsPage() {
  return (
    <RequirePermission perm="batch:view">
      <Inner />
    </RequirePermission>
  );
}
