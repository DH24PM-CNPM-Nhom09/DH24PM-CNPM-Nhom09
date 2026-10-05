"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RequirePermission, useAdmin } from "@/components/admin/AdminShell";
import { IconPlus } from "@/components/admin/Icons";
import { BatchBadge, Btn, EmptyState, ErrorBox, fieldCls, Label, LoadingRows, Modal, PageHeader, useToast } from "@/components/admin/ui";
import { createBatch, listBatches, type CreateBatchDto } from "@/lib/admin/api";
import { DEGREE_LABEL, errorMessage, fmtDate } from "@/lib/admin/format";
import { useAsync } from "@/lib/admin/useAsync";

const EMPTY: CreateBatchDto = {
  batchCode: "",
  batchName: "",
  degreeLevel: "THAC_SI",
  registrationStartAt: "",
  registrationEndAt: "",
  examStartAt: null,
  examEndAt: null,
  legalBasis: "Thông tư 53/2026/TT-BGDĐT",
};

function BatchesInner() {
  const { can } = useAdmin();
  const router = useRouter();
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(listBatches, []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CreateBatchDto>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const set = <K extends keyof CreateBatchDto>(k: K, v: CreateBatchDto[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setFormError("");
    if (!form.batchCode.trim() || !form.batchName.trim() || !form.registrationStartAt || !form.registrationEndAt) {
      setFormError("Điền đủ mã đợt, tên đợt và thời gian đăng ký.");
      return;
    }
    setBusy(true);
    try {
      const b = await createBatch({
        ...form,
        registrationStartAt: new Date(form.registrationStartAt).toISOString(),
        registrationEndAt: new Date(form.registrationEndAt).toISOString(),
        examStartAt: form.examStartAt ? new Date(form.examStartAt).toISOString() : null,
        examEndAt: form.examEndAt ? new Date(form.examEndAt).toISOString() : null,
      });
      toast(`Đã tạo đợt ${b.batchCode}. Tiếp theo: thêm ngành và chỉ tiêu.`);
      setOpen(false);
      setForm(EMPTY);
      router.push(`/admin/batches/${b.batchId}`);
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Đợt tuyển sinh"
        description="Mỗi đợt đi qua các bước: Nháp, Mở đăng ký, Đóng đăng ký, Xét kết quả, Hoàn tất. Chỉ đợt Nháp mới sửa được ngành, chỉ tiêu và môn thi."
        actions={
          can("batch:manage") && (
            <Btn variant="primary" onClick={() => setOpen(true)}>
              <IconPlus size={16} /> Tạo đợt tuyển sinh
            </Btn>
          )
        }
      />

      {error && <ErrorBox message={error} onRetry={() => reload()} />}

      <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
        {loading && !data ? (
          <LoadingRows rows={4} />
        ) : !data?.length ? (
          <EmptyState title="Chưa có đợt tuyển sinh nào">Tạo đợt đầu tiên để bắt đầu nhận hồ sơ.</EmptyState>
        ) : (
          <ul className="divide-y divide-gray-100">
            {data.map((b) => (
              <li key={b.batchId}>
                <Link href={`/admin/batches/${b.batchId}`} className="grid gap-3 px-5 py-4 transition-colors hover:bg-gray-50 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{b.batchName}</p>
                    <p className="mt-0.5 text-[13px] text-gray-500">
                      <span className="font-mono">{b.batchCode}</span>, bậc {DEGREE_LABEL[b.degreeLevel].toLowerCase()}
                    </p>
                  </div>
                  <div className="text-[13px]">
                    <p className="text-gray-500">Đăng ký</p>
                    <p className="tabular-nums text-gray-800">
                      {fmtDate(b.registrationStartAt)} – {fmtDate(b.registrationEndAt)}
                    </p>
                  </div>
                  <div className="text-[13px]">
                    <p className="text-gray-500">{b.majorCount} ngành, {b.quotaTotal} chỉ tiêu</p>
                    <p className="text-gray-800">
                      <span className="font-semibold tabular-nums">{b.applicationCount}</span> hồ sơ đã nộp
                    </p>
                  </div>
                  <div className="md:text-right">
                    <BatchBadge status={b.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Tạo đợt tuyển sinh"
        description="Đợt mới ở trạng thái Nháp. Thí sinh chỉ thấy đợt sau khi mở đăng ký."
        width="max-w-xl"
        footer={
          <>
            <Btn onClick={() => setOpen(false)}>Hủy</Btn>
            <Btn variant="primary" loading={busy} onClick={submit}>
              Tạo đợt
            </Btn>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="b-code" required>Mã đợt</Label>
            <input id="b-code" className={`${fieldCls} font-mono uppercase`} placeholder="THS-2027-D2" value={form.batchCode} onChange={(e) => set("batchCode", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="b-degree" required>Bậc đào tạo</Label>
            <select id="b-degree" className={fieldCls} value={form.degreeLevel} onChange={(e) => set("degreeLevel", e.target.value as CreateBatchDto["degreeLevel"])}>
              <option value="THAC_SI">Thạc sĩ</option>
              <option value="TIEN_SI">Tiến sĩ</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="b-name" required>Tên đợt</Label>
            <input id="b-name" className={fieldCls} placeholder="Tuyển sinh thạc sĩ đợt 2 năm 2027" value={form.batchName} onChange={(e) => set("batchName", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="b-rs" required>Mở đăng ký</Label>
            <input id="b-rs" type="datetime-local" className={fieldCls} value={form.registrationStartAt} onChange={(e) => set("registrationStartAt", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="b-re" required>Đóng đăng ký</Label>
            <input id="b-re" type="datetime-local" className={fieldCls} value={form.registrationEndAt} onChange={(e) => set("registrationEndAt", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="b-es">Bắt đầu thi / phỏng vấn</Label>
            <input id="b-es" type="date" className={fieldCls} value={form.examStartAt ?? ""} onChange={(e) => set("examStartAt", e.target.value || null)} />
          </div>
          <div>
            <Label htmlFor="b-ee">Kết thúc thi / phỏng vấn</Label>
            <input id="b-ee" type="date" className={fieldCls} value={form.examEndAt ?? ""} onChange={(e) => set("examEndAt", e.target.value || null)} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="b-legal">Căn cứ pháp lý</Label>
            <input id="b-legal" className={fieldCls} value={form.legalBasis} onChange={(e) => set("legalBasis", e.target.value)} />
          </div>
        </div>
        {formError && <div className="mt-4"><ErrorBox message={formError} /></div>}
      </Modal>
    </>
  );
}

export default function BatchesPage() {
  return (
    <RequirePermission perm="batch:view">
      <BatchesInner />
    </RequirePermission>
  );
}
