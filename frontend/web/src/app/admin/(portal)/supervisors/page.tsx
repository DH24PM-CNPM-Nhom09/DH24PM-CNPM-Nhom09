"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RequirePermission } from "@/components/admin/AdminShell";
import { IconPlus, IconSearch } from "@/components/admin/Icons";
import { Btn, EmptyState, ErrorBox, fieldCls, Label, LoadingRows, Modal, Notice, PageHeader, useToast } from "@/components/admin/ui";
import {
  createLecturer,
  listLecturers,
  listSupervisorRequests,
  respondSupervisorRequest,
  updateLecturer,
  type LecturerInput,
  type LecturerRow,
  type SupervisorRequestRow,
  type SupervisorStatus,
} from "@/lib/admin/api";
import { errorMessage, fmtDate } from "@/lib/admin/format";
import { useAsync } from "@/lib/admin/useAsync";

const STATUS: Record<SupervisorStatus, { label: string; cls: string }> = {
  PENDING: { label: "Chờ phản hồi", cls: "bg-[#FEF3E2] text-[#92400E]" },
  ACCEPTED: { label: "Đồng ý hướng dẫn", cls: "bg-[#EAF7EE] text-[#166534]" },
  REJECTED: { label: "Từ chối", cls: "bg-[#FDECEC] text-[#B91C1C]" },
};
const TABS: { key: SupervisorStatus | ""; label: string }[] = [
  { key: "PENDING", label: "Chờ phản hồi" },
  { key: "ACCEPTED", label: "Đã đồng ý" },
  { key: "REJECTED", label: "Từ chối" },
  { key: "", label: "Tất cả" },
];
const REJECT_PRESETS = ["Đã đủ số nghiên cứu sinh hướng dẫn trong năm.", "Đề tài không thuộc hướng nghiên cứu của giảng viên.", "Giảng viên đi công tác dài hạn, không nhận hướng dẫn đợt này."];

function Pill({ s }: { s: SupervisorStatus }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS[s].cls}`}>{STATUS[s].label}</span>;
}

// ------------------------------------------------------------------ Tab 1: đề nghị hướng dẫn
function Requests() {
  const toast = useToast();
  const [status, setStatus] = useState<SupervisorStatus | "">("PENDING");
  const [q, setQ] = useState("");
  const { data, error, loading, reload } = useAsync(() => listSupervisorRequests({ status, q: q.trim() }), [status, q]);
  const [target, setTarget] = useState<{ row: SupervisorRequestRow; decision: "ACCEPTED" | "REJECTED" } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  async function submit() {
    if (!target) return;
    setBusy(true);
    setFormError("");
    try {
      await respondSupervisorRequest(target.row.requestId, target.decision, note);
      toast(`Đã ghi nhận ${target.decision === "ACCEPTED" ? "giảng viên đồng ý" : "giảng viên từ chối"}. Đã gửi thông báo cho nghiên cứu sinh.`);
      setTarget(null);
      reload(true);
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <div className="flex w-max gap-1.5" role="tablist" aria-label="Lọc theo trạng thái">
            {TABS.map((t) => {
              const active = status === t.key;
              const count = data ? data.counts[t.key || "ALL"] : null;
              return (
                <button
                  key={t.key || "all"}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStatus(t.key)}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold ${active ? "border-navy-800 bg-navy-800 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"}`}
                >
                  {t.label}
                  {count !== null && <span className={`tabular-nums ${active ? "text-white/70" : "text-gray-400"}`}>{count}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <label className="relative block md:w-80">
          <span className="sr-only">Tìm</span>
          <IconSearch size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className={`${fieldCls} pl-9`} placeholder="NCS, giảng viên, đề tài, mã hồ sơ" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      {error && <ErrorBox message={error} onRetry={() => reload()} />}
      <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
        {loading && !data ? (
          <LoadingRows />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title={status === "PENDING" ? "Không có đề nghị nào đang chờ" : "Không có đề nghị phù hợp"}>Đề nghị được tạo khi nghiên cứu sinh nộp hồ sơ tiến sĩ có chọn giảng viên.</EmptyState>
        ) : (
          <ul className={`divide-y divide-gray-100 ${loading ? "opacity-60" : ""}`}>
            {data.items.map((r) => (
              <li key={r.requestId} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-gray-900">{r.candidateName}</span>
                    <Link href={`/admin/applications/${r.applicationId}`} className="font-mono text-[12.5px] text-navy-800 hover:underline">
                      {r.applicationCode}
                    </Link>
                    <Pill s={r.status} />
                  </div>
                  <p className="mt-1 text-sm text-gray-800">
                    <span className="text-gray-500">Đề tài:</span> {r.researchTopic}
                  </p>
                  <p className="mt-0.5 text-[13px] text-gray-500">
                    {r.majorName}
                    {r.researchField ? ` · ${r.researchField}` : ""} · đề nghị {fmtDate(r.requestedAt)}
                  </p>
                  <p className="mt-1.5 text-sm">
                    <span className="text-gray-500">Giảng viên:</span> <span className="font-semibold text-gray-900">{r.lecturer.fullName}</span>
                    <span className="text-gray-500"> · {r.lecturer.facultyName}</span>
                  </p>
                  {r.responseNote && <p className="mt-1.5 rounded-input bg-gray-50 px-3 py-2 text-[13px] text-gray-700">{r.responseNote}</p>}
                  {r.respondedAt && <p className="mt-1 text-xs text-gray-400">Ghi nhận ngày {fmtDate(r.respondedAt)}</p>}
                </div>
                {r.status === "PENDING" && (
                  <div className="flex shrink-0 gap-2">
                    <Btn
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        setNote("");
                        setFormError("");
                        setTarget({ row: r, decision: "REJECTED" });
                      }}
                    >
                      Từ chối
                    </Btn>
                    <Btn
                      size="sm"
                      variant="success"
                      onClick={() => {
                        setNote("");
                        setFormError("");
                        setTarget({ row: r, decision: "ACCEPTED" });
                      }}
                    >
                      Đồng ý hướng dẫn
                    </Btn>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        title={target?.decision === "ACCEPTED" ? "Ghi nhận giảng viên đồng ý hướng dẫn?" : "Ghi nhận giảng viên từ chối?"}
        description={target ? `${target.row.lecturer.fullName} — NCS ${target.row.candidateName} (${target.row.applicationCode})` : undefined}
        footer={
          <>
            <Btn onClick={() => setTarget(null)}>Hủy</Btn>
            <Btn variant={target?.decision === "ACCEPTED" ? "success" : "danger"} loading={busy} onClick={submit}>
              Xác nhận
            </Btn>
          </>
        }
      >
        <div className="grid gap-3">
          {target?.decision === "ACCEPTED" ? (
            <Notice tone="green">Chỉ ghi nhận khi đã có giấy đồng ý hướng dẫn có chữ ký của giảng viên. Nghiên cứu sinh sẽ nhận thông báo và email.</Notice>
          ) : (
            <Notice>Nghiên cứu sinh nhận thông báo kèm lý do và có thể tự chọn giảng viên khác trên cổng thí sinh.</Notice>
          )}
          <div>
            <Label htmlFor="sup-note" required={target?.decision === "REJECTED"}>
              {target?.decision === "ACCEPTED" ? "Ghi chú (không bắt buộc)" : "Lý do từ chối"}
            </Label>
            <textarea id="sup-note" rows={3} maxLength={1000} className={fieldCls} value={note} onChange={(e) => setNote(e.target.value)} />
            {target?.decision === "REJECTED" && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {REJECT_PRESETS.map((p) => (
                  <button key={p} type="button" onClick={() => setNote(p)} className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:border-gray-300 hover:text-gray-900">
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
          {formError && <ErrorBox message={formError} />}
        </div>
      </Modal>
    </>
  );
}

// ------------------------------------------------------------------ Tab 2: danh mục giảng viên
const EMPTY: LecturerInput = { lecturerCode: "", fullName: "", email: "", facultyName: "" };

function Lecturers() {
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(() => listLecturers(), []);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<LecturerRow | "new" | null>(null);
  const [form, setForm] = useState<LecturerInput>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data ?? []).filter((l) => !t || `${l.lecturerCode} ${l.fullName} ${l.facultyName} ${l.email ?? ""}`.toLowerCase().includes(t));
  }, [data, q]);

  function open(l: LecturerRow | "new") {
    setFormError("");
    setEditing(l);
    setForm(l === "new" ? EMPTY : { lecturerCode: l.lecturerCode, fullName: l.fullName, email: l.email ?? "", facultyName: l.facultyName });
  }

  async function save() {
    setBusy(true);
    setFormError("");
    try {
      if (editing === "new") await createLecturer(form);
      else if (editing) await updateLecturer(editing.lecturerId, form);
      toast(editing === "new" ? `Đã thêm ${form.fullName}.` : "Đã lưu thay đổi.");
      setEditing(null);
      reload(true);
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(l: LecturerRow) {
    try {
      await updateLecturer(l.lecturerId, { status: l.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
      toast(l.status === "ACTIVE" ? `${l.fullName} ngừng nhận hướng dẫn.` : `${l.fullName} nhận hướng dẫn trở lại.`);
      reload(true);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  const set = (k: keyof LecturerInput, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <label className="relative block md:w-80">
          <span className="sr-only">Tìm giảng viên</span>
          <IconSearch size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className={`${fieldCls} pl-9`} placeholder="Mã, họ tên, khoa" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <Btn variant="primary" onClick={() => open("new")}>
          <IconPlus size={16} /> Thêm giảng viên
        </Btn>
      </div>
      {error && <ErrorBox message={error} onRetry={() => reload()} />}
      <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
        {loading && !data ? (
          <LoadingRows />
        ) : rows.length === 0 ? (
          <EmptyState title="Chưa có giảng viên nào">Thêm giảng viên có đủ điều kiện hướng dẫn nghiên cứu sinh để thí sinh lựa chọn.</EmptyState>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rows.map((l) => (
              <li key={l.lecturerId} className="flex flex-col gap-2 px-5 py-3.5 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className={`font-semibold ${l.status === "ACTIVE" ? "text-gray-900" : "text-gray-400"}`}>
                    {l.fullName} <span className="font-mono text-xs font-normal text-gray-400">{l.lecturerCode}</span>
                  </p>
                  <p className="text-[13px] text-gray-500">
                    {l.facultyName || "—"}
                    {l.email ? ` · ${l.email}` : ""}
                  </p>
                  <p className="text-xs text-gray-500">
                    Đang hướng dẫn {l.accepted} NCS{l.pending ? ` · ${l.pending} đề nghị chờ phản hồi` : ""}
                    {l.status === "INACTIVE" && <span className="ml-1.5 font-semibold text-[#92400E]">· Ngừng nhận hướng dẫn</span>}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Btn size="sm" onClick={() => open(l)}>
                    Sửa
                  </Btn>
                  <Btn size="sm" variant={l.status === "ACTIVE" ? "warning" : "success"} onClick={() => toggle(l)}>
                    {l.status === "ACTIVE" ? "Ngừng nhận" : "Nhận lại"}
                  </Btn>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Thêm giảng viên hướng dẫn" : "Sửa thông tin giảng viên"}
        footer={
          <>
            <Btn onClick={() => setEditing(null)}>Hủy</Btn>
            <Btn variant="primary" loading={busy} onClick={save}>
              Lưu
            </Btn>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="lec-code" required>
              Mã giảng viên
            </Label>
            <input id="lec-code" className={`${fieldCls} font-mono uppercase`} value={form.lecturerCode} maxLength={30} onChange={(e) => set("lecturerCode", e.target.value)} placeholder="GV-CNTT-03" />
          </div>
          <div>
            <Label htmlFor="lec-email">Email công tác</Label>
            <input id="lec-email" type="email" className={fieldCls} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="ten@agu.edu.vn" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="lec-name" required>
              Họ tên (kèm học hàm, học vị)
            </Label>
            <input id="lec-name" className={fieldCls} value={form.fullName} maxLength={255} onChange={(e) => set("fullName", e.target.value)} placeholder="PGS.TS Nguyễn Văn A" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="lec-fac">Khoa / đơn vị</Label>
            <input id="lec-fac" className={fieldCls} value={form.facultyName} maxLength={255} onChange={(e) => set("facultyName", e.target.value)} placeholder="Khoa Công nghệ thông tin" />
          </div>
        </div>
        {formError && (
          <div className="mt-3">
            <ErrorBox message={formError} />
          </div>
        )}
      </Modal>
    </>
  );
}

function Inner() {
  const [tab, setTab] = useState<"requests" | "lecturers">("requests");
  return (
    <>
      <PageHeader
        title="Giảng viên hướng dẫn"
        description="Đề nghị hướng dẫn của nghiên cứu sinh (bậc tiến sĩ) và danh mục giảng viên. Ghi nhận giảng viên đồng ý hoặc từ chối sau khi có xác nhận của giảng viên; nghiên cứu sinh được thông báo ngay."
      />
      <div className="mb-5 flex gap-1 border-b border-gray-200" role="tablist">
        {(
          [
            ["requests", "Đề nghị hướng dẫn"],
            ["lecturers", "Danh mục giảng viên"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold ${tab === k ? "border-accent text-gray-900" : "border-transparent text-gray-500 hover:text-gray-800"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "requests" ? <Requests /> : <Lecturers />}
    </>
  );
}

export default function SupervisorsPage() {
  return (
    <RequirePermission perm="supervisor:manage">
      <Inner />
    </RequirePermission>
  );
}
