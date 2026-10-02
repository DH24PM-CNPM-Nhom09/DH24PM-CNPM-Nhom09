"use client";

import { useEffect, useState } from "react";
import { RequirePermission } from "@/components/admin/AdminShell";
import { IconPlus, IconSearch } from "@/components/admin/Icons";
import { Btn, EmptyState, ErrorBox, fieldCls, Label, LoadingRows, Modal, PageHeader, useToast } from "@/components/admin/ui";
import { listBatches, type BatchSummary } from "@/lib/admin/api";
import { emitDataChange } from "@/lib/admin/events";
import { useAsync } from "@/lib/admin/useAsync";
import {
  adminCreateAnnouncement,
  adminListAnnouncements,
  adminSetAnnouncementStatus,
  adminUpdateAnnouncement,
  CATEGORY_LABEL,
  CATEGORY_TONE,
  fmtDateTime,
  STATUS_LABEL,
  type Announcement,
  type AnnouncementCategory,
  type AnnouncementInput,
  type AnnouncementStatus,
} from "@/lib/announcements";

const STATUS_TONE: Record<AnnouncementStatus, string> = {
  PUBLISHED: "bg-[#EAF7EE] text-[#166534]",
  DRAFT: "bg-gray-100 text-gray-600",
  ARCHIVED: "bg-[#FDECEC] text-[#B91C1C]",
};
const EMPTY: AnnouncementInput = { title: "", content: "", category: "TUYEN_SINH", batchId: null, isPinned: false };
const errText = (e: unknown) => (e as { message?: string })?.message ?? "Đã có lỗi xảy ra.";

function Editor({ open, editing, batches, onClose }: { open: boolean; editing: Announcement | null; batches: BatchSummary[]; onClose: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState<AnnouncementInput>(EMPTY);
  const [busy, setBusy] = useState<"" | "draft" | "publish" | "save">("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm(
      editing
        ? { title: editing.title, content: editing.content ?? "", category: editing.category, batchId: editing.batch?.batchId ?? null, isPinned: editing.isPinned }
        : EMPTY,
    );
  }, [open, editing]);

  async function submit(mode: "draft" | "publish" | "save") {
    setBusy(mode);
    setError("");
    try {
      if (editing) {
        await adminUpdateAnnouncement(editing.announcementId, form);
        toast("Đã lưu thay đổi thông báo.");
      } else {
        await adminCreateAnnouncement({ ...form, publish: mode === "publish" });
        toast(mode === "publish" ? "Đã đăng thông báo. Thí sinh xem được ngay." : "Đã lưu bản nháp.");
      }
      emitDataChange();
      onClose();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy("");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      title={editing ? "Sửa thông báo" : "Soạn thông báo mới"}
      description={editing?.status === "PUBLISHED" ? "Thông báo đang hiển thị: thay đổi có hiệu lực ngay sau khi lưu." : undefined}
      footer={
        editing ? (
          <>
            <Btn onClick={onClose}>Hủy</Btn>
            <Btn variant="navy" loading={busy === "save"} onClick={() => submit("save")}>
              Lưu thay đổi
            </Btn>
          </>
        ) : (
          <>
            <Btn onClick={onClose}>Hủy</Btn>
            <Btn loading={busy === "draft"} disabled={!!busy} onClick={() => submit("draft")}>
              Lưu nháp
            </Btn>
            <Btn variant="primary" loading={busy === "publish"} disabled={!!busy} onClick={() => submit("publish")}>
              Đăng ngay
            </Btn>
          </>
        )
      }
    >
      {error && <div className="mb-4 rounded-input bg-danger-50 px-3 py-2.5 text-[13px] font-medium text-[#B91C1C]">{error}</div>}
      <div className="grid gap-4">
        <div>
          <Label htmlFor="ann-title" required>
            Tiêu đề
          </Label>
          <input id="ann-title" className={fieldCls} maxLength={255} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="VD: Thông báo tuyển sinh thạc sĩ đợt 1 năm 2027" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="ann-cat" required>
              Loại thông báo
            </Label>
            <select id="ann-cat" className={fieldCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as AnnouncementCategory })}>
              {(Object.keys(CATEGORY_LABEL) as AnnouncementCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="ann-batch">Gắn với đợt tuyển sinh</Label>
            <select id="ann-batch" className={fieldCls} value={form.batchId ?? ""} onChange={(e) => setForm({ ...form, batchId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Thông báo chung (không gắn đợt)</option>
              {batches.map((b) => (
                <option key={b.batchId} value={b.batchId}>
                  {b.batchName}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <Label htmlFor="ann-content" required>
            Nội dung
          </Label>
          <textarea
            id="ann-content"
            rows={12}
            className={`${fieldCls} resize-y leading-relaxed`}
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            placeholder={"Đoạn mở đầu...\n\n1. Đối tượng dự tuyển\n- Gạch đầu dòng bắt đầu bằng dấu trừ và khoảng trắng\n\n2. Thời gian nhận hồ sơ\n..."}
          />
          <p className="mt-1.5 text-xs text-gray-500">
            Để trống một dòng giữa các đoạn. Dòng bắt đầu bằng “1.”, “2.” thành tiêu đề mục; dòng bắt đầu bằng “- ” thành gạch đầu dòng.
          </p>
        </div>
        <label className="flex items-center gap-2.5 text-sm text-gray-700">
          <input type="checkbox" className="h-4 w-4 accent-[#E8734A]" checked={form.isPinned} onChange={(e) => setForm({ ...form, isPinned: e.target.checked })} />
          Ghim lên đầu danh sách thông báo của thí sinh
        </label>
      </div>
    </Modal>
  );
}

function AnnouncementsInner() {
  const toast = useToast();
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [confirm, setConfirm] = useState<{ a: Announcement; to: AnnouncementStatus } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQ(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, error, loading, reload } = useAsync(() => adminListAnnouncements({ status, category, q }), [status, category, q]);
  const batches = useAsync(() => listBatches().catch(() => [] as BatchSummary[]), []);

  async function changeStatus(a: Announcement, to: AnnouncementStatus) {
    setBusy(true);
    try {
      await adminSetAnnouncementStatus(a.announcementId, to);
      toast(to === "PUBLISHED" ? "Đã đăng thông báo." : to === "ARCHIVED" ? "Đã gỡ thông báo khỏi cổng thí sinh." : "Đã chuyển về bản nháp.");
      emitDataChange();
      setConfirm(null);
    } catch (e) {
      toast(errText(e), "error");
    } finally {
      setBusy(false);
    }
  }

  const counts = (data ?? []).reduce<Record<string, number>>((m, a) => ((m[a.status] = (m[a.status] ?? 0) + 1), m), {});

  return (
    <>
      <PageHeader
        title="Thông báo tuyển sinh"
        description="Soạn và đăng thông báo tuyển sinh, quy định, hướng dẫn lên cổng Thí sinh. Thông báo đang hiển thị ai cũng xem được, kể cả khi chưa đăng nhập."
        actions={
          <Btn
            variant="primary"
            onClick={() => {
              setEditing(null);
              setEditorOpen(true);
            }}
          >
            <IconPlus size={16} /> Soạn thông báo
          </Btn>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {[
            ["", "Tất cả"],
            ["PUBLISHED", "Đang hiển thị"],
            ["DRAFT", "Bản nháp"],
            ["ARCHIVED", "Đã gỡ"],
          ].map(([v, l]) => (
            <button
              key={v || "all"}
              onClick={() => setStatus(v)}
              aria-pressed={status === v}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold ${status === v ? "border-navy-800 bg-navy-800 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"}`}
            >
              {l}
              {!status && v && counts[v] ? <span className="ml-1 opacity-70">({counts[v]})</span> : null}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,260px)]">
          <select className={fieldCls} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Loại thông báo">
            <option value="">Mọi loại</option>
            {(Object.keys(CATEGORY_LABEL) as AnnouncementCategory[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <label className="relative block">
            <span className="sr-only">Tìm theo tiêu đề</span>
            <IconSearch size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className={`${fieldCls} pl-9`} placeholder="Tìm theo tiêu đề…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
        </div>
      </div>

      {error && <ErrorBox message={error} onRetry={() => reload()} />}

      <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
        {loading && !data ? (
          <LoadingRows />
        ) : !data || data.length === 0 ? (
          <EmptyState title="Chưa có thông báo nào">Bấm “Soạn thông báo” để đăng thông báo đầu tiên.</EmptyState>
        ) : (
          <ul className="divide-y divide-gray-100">
            {data.map((a) => (
              <li key={a.announcementId} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full px-2.5 py-0.5 font-semibold ${STATUS_TONE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                    <span className={`rounded-full px-2.5 py-0.5 font-semibold ${CATEGORY_TONE[a.category]}`}>{CATEGORY_LABEL[a.category]}</span>
                    {a.isPinned && <span className="font-semibold text-accent">📌 Ghim</span>}
                  </div>
                  <p className="mt-1.5 font-semibold text-gray-900">{a.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {a.batch ? `${a.batch.batchName} · ` : "Thông báo chung · "}
                    {a.publishedAt ? `Đăng ${fmtDateTime(a.publishedAt)}` : `Tạo ${fmtDateTime(a.createdAt)}`}
                    {a.createdByName && ` · ${a.createdByName}`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Btn
                    size="sm"
                    onClick={() => {
                      setEditing(a);
                      setEditorOpen(true);
                    }}
                  >
                    Sửa
                  </Btn>
                  {a.status === "PUBLISHED" ? (
                    <Btn size="sm" variant="danger" onClick={() => setConfirm({ a, to: "ARCHIVED" })}>
                      Gỡ
                    </Btn>
                  ) : (
                    <Btn size="sm" variant="success" onClick={() => setConfirm({ a, to: "PUBLISHED" })}>
                      {a.status === "ARCHIVED" ? "Đăng lại" : "Đăng"}
                    </Btn>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Editor open={editorOpen} editing={editing} batches={batches.data ?? []} onClose={() => setEditorOpen(false)} />

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.to === "ARCHIVED" ? "Gỡ thông báo này?" : "Đăng thông báo này?"}
        description={
          confirm?.to === "ARCHIVED"
            ? "Thí sinh sẽ không còn thấy thông báo trên cổng. Bạn có thể đăng lại sau, nội dung được giữ nguyên."
            : "Thông báo sẽ hiện ngay trên cổng Thí sinh và trang công khai."
        }
        footer={
          <>
            <Btn onClick={() => setConfirm(null)}>Hủy</Btn>
            <Btn variant={confirm?.to === "ARCHIVED" ? "danger" : "success"} loading={busy} onClick={() => confirm && changeStatus(confirm.a, confirm.to)}>
              {confirm?.to === "ARCHIVED" ? "Gỡ thông báo" : "Đăng thông báo"}
            </Btn>
          </>
        }
      >
        {confirm && <p className="rounded-input bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-800">{confirm.a.title}</p>}
      </Modal>
    </>
  );
}

export default function AdminAnnouncementsPage() {
  return (
    <RequirePermission perm="announcement:manage">
      <AnnouncementsInner />
    </RequirePermission>
  );
}
