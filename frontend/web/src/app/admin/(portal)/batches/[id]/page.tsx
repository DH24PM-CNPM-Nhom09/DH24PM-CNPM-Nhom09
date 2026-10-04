"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { RequirePermission, useAdmin } from "@/components/admin/AdminShell";
import { IconAlert, IconCheck, IconChevronLeft, IconPlus, IconX } from "@/components/admin/Icons";
import { BATCH_LABEL, BatchBadge, BatchMajorBadge, Btn, ErrorBox, fieldCls, Label, Modal, Notice, Panel, Skeleton, useToast } from "@/components/admin/ui";
import {
  addBatchMajor,
  approveBatchMajor,
  batchTransitionIssues,
  changeBatchStatus,
  getBatch,
  nextBatchStatuses,
  updateBatchMajor,
  weightSum,
  type BatchDetail,
} from "@/lib/admin/api";
import { DEGREE_LABEL, errorMessage, EXAM_FORMAT_LABEL, fmtDate, fmtDateTime } from "@/lib/admin/format";
import type { BatchStatus, ExamFormat } from "@/lib/admin/types";
import { useAsync } from "@/lib/admin/useAsync";

const FLOW: BatchStatus[] = ["DRAFT", "OPEN", "CLOSED", "IN_REVIEW", "COMPLETED"];
const NEXT_LABEL: Record<BatchStatus, string> = {
  DRAFT: "Chuyển về nháp",
  OPEN: "Mở đăng ký",
  CLOSED: "Đóng đăng ký",
  IN_REVIEW: "Chuyển sang xét kết quả",
  COMPLETED: "Hoàn tất đợt",
  CANCELLED: "Hủy đợt",
};
const NEXT_EFFECT: Partial<Record<BatchStatus, string>> = {
  OPEN: "Thí sinh thấy đợt này và nộp hồ sơ được. Sau khi mở, ngành, chỉ tiêu và môn thi bị khóa.",
  CLOSED: "Thí sinh không nộp hồ sơ mới được nữa. Hồ sơ đã nộp tiếp tục được thẩm định.",
  IN_REVIEW: "Bắt đầu chấm điểm, xếp hạng và xét trúng tuyển.",
  COMPLETED: "Đợt kết thúc, chỉ còn xem lại dữ liệu.",
  CANCELLED: "Đợt bị hủy và không thể mở lại.",
};

type SubjectRow = { subjectId?: number; subjectName: string; examFormat: ExamFormat; weightPct: string; maxScore: number };
type Major = BatchDetail["majors"][number];

function BatchDetailInner() {
  const { id } = useParams<{ id: string }>();
  const batchId = Number(id);
  const { can } = useAdmin();
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(() => getBatch(batchId), [batchId]);

  const [transition, setTransition] = useState<BatchStatus | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addMajorId, setAddMajorId] = useState("");
  const [addQuota, setAddQuota] = useState("");
  const [edit, setEdit] = useState<Major | null>(null);
  const [quota, setQuota] = useState("");
  const [rows, setRows] = useState<SubjectRow[]>([]);
  const [approve, setApprove] = useState<Major | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  if (loading && !data) return <Skeleton className="h-96" />;
  if (error || !data) return <ErrorBox message={error ?? "Không tìm thấy đợt tuyển sinh."} onRetry={() => reload()} />;

  const b = data.batch;
  const isDraft = b.status === "DRAFT";
  const canManage = can("batch:manage");
  const canApprove = can("batch:approve");
  const available = data.allMajors.filter((m) => m.degreeLevel === b.degreeLevel && !data.majors.some((x) => x.majorId === m.majorId));
  const issuesFor = (to: BatchStatus) => batchTransitionIssues(data, to, data.unresolvedCount);
  const flowIndex = FLOW.indexOf(b.status);

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

  function openEdit(m: Major) {
    setFormError("");
    setEdit(m);
    setQuota(String(m.quota));
    setRows(m.subjects.map((s) => ({ subjectId: s.subjectId, subjectName: s.subjectName, examFormat: s.examFormat, weightPct: String(Math.round(s.weight * 100)), maxScore: s.maxScore })));
  }
  const rowsSum = rows.reduce((s, r) => s + (Number(r.weightPct) || 0), 0);

  return (
    <>
      <Link href="/admin/batches" className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-gray-500 hover:text-gray-900">
        <IconChevronLeft size={16} /> Đợt tuyển sinh
      </Link>
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-[24px] font-bold leading-tight text-gray-900 md:text-[28px]">{b.batchName}</h1>
          <p className="mt-1 text-sm text-gray-500">
            <span className="font-mono text-gray-700">{b.batchCode}</span>
            <span className="mx-2 text-gray-300">|</span>Bậc {DEGREE_LABEL[b.degreeLevel].toLowerCase()}
            {b.legalBasis && <>, căn cứ {b.legalBasis}</>}
          </p>
        </div>
        <BatchBadge status={b.status} />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Panel
            title="Ngành, chỉ tiêu và môn thi"
            action={
              canManage && isDraft ? (
                <Btn size="sm" variant="outline" disabled={available.length === 0} onClick={() => { setFormError(""); setAddMajorId(String(available[0]?.majorId ?? "")); setAddQuota(""); setAddOpen(true); }}>
                  <IconPlus size={15} /> Thêm ngành
                </Btn>
              ) : undefined
            }
            bodyClass="p-0"
          >
            {data.majors.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-gray-500">Đợt chưa có ngành nào. Thêm ngành và chỉ tiêu trước khi trình lãnh đạo phê duyệt.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {data.majors.map((m) => {
                  const sum = weightSum(m.subjects);
                  const sumOk = sum === 1;
                  return (
                    <li key={m.batchMajorId} className="px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-900">{m.major.majorName}</p>
                          <p className="text-[13px] text-gray-500">
                            Mã ngành <span className="font-mono">{m.major.majorCode}</span>, {m.major.facultyName}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <BatchMajorBadge status={m.status} />
                          {canManage && isDraft && (
                            <Btn size="sm" variant="ghost" onClick={() => openEdit(m)}>
                              Sửa
                            </Btn>
                          )}
                          {canApprove && m.status === "CONFIGURING" && (
                            <Btn size="sm" variant="navy" onClick={() => { setFormError(""); setApprove(m); }}>
                              Phê duyệt
                            </Btn>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
                        <div>
                          <p className="text-xs text-gray-500">Chỉ tiêu</p>
                          <p className="text-[22px] font-bold tabular-nums text-gray-900">{m.quota}</p>
                          {b.status !== "DRAFT" && (
                            <p className="text-xs text-gray-500">
                              {m.applicationCount} hồ sơ, {m.approvedCount} đạt
                            </p>
                          )}
                        </div>
                        <div>
                          <div className="mb-1.5 flex items-center justify-between text-xs">
                            <span className="text-gray-500">Môn thi / hình thức xét và trọng số</span>
                            <span className={`inline-flex items-center gap-1 font-semibold ${sumOk ? "text-[#166534]" : "text-[#B91C1C]"}`}>
                              {sumOk ? <IconCheck size={13} /> : <IconAlert size={13} />}
                              Tổng {Math.round(sum * 100)}%
                            </span>
                          </div>
                          <div className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full bg-gray-100">
                            {m.subjects.map((s, i) => (
                              <div key={s.subjectId} style={{ width: `${Math.min(100, s.weight * 100)}%` }} className={i % 2 === 0 ? "bg-navy-800" : "bg-[#7E97BD]"} />
                            ))}
                          </div>
                          <ul className="mt-2 space-y-1 text-[13px]">
                            {m.subjects.map((s, i) => (
                              <li key={s.subjectId} className="flex items-center justify-between gap-3">
                                <span className="flex items-center gap-2 text-gray-700">
                                  <span className={`h-2 w-2 rounded-sm ${i % 2 === 0 ? "bg-navy-800" : "bg-[#7E97BD]"}`} aria-hidden="true" />
                                  {s.subjectName} <span className="text-gray-400">({EXAM_FORMAT_LABEL[s.examFormat]}, thang {s.maxScore})</span>
                                </span>
                                <span className="font-semibold tabular-nums text-gray-900">{Math.round(s.weight * 100)}%</span>
                              </li>
                            ))}
                          </ul>
                          {m.approvedByStaffId && m.status !== "CONFIGURING" && (
                            <p className="mt-2 text-xs text-gray-500">Phê duyệt bởi {data.staffNames[m.approvedByStaffId]}</p>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-5 lg:sticky lg:top-6">
          <Panel title="Tiến trình đợt">
            <ol className="space-y-2.5">
              {FLOW.map((s, i) => {
                const done = b.status !== "CANCELLED" && i < flowIndex;
                const current = s === b.status;
                return (
                  <li key={s} className="flex items-center gap-3 text-sm">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                        done ? "bg-[#1F8A4C] text-white" : current ? "bg-navy-800 text-white" : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {done ? <IconCheck size={13} /> : i + 1}
                    </span>
                    <span className={current ? "font-semibold text-gray-900" : done ? "text-gray-700" : "text-gray-400"}>{BATCH_LABEL[s]}</span>
                  </li>
                );
              })}
            </ol>
            {b.status === "CANCELLED" && <p className="mt-3 text-sm font-semibold text-[#B91C1C]">Đợt đã bị hủy.</p>}

            {canManage &&
              nextBatchStatuses(b.status).map((to) => {
                const issues = issuesFor(to);
                return (
                  <div key={to} className="mt-4 border-t border-gray-100 pt-4">
                    <Btn className="w-full" variant={to === "CANCELLED" ? "danger" : "navy"} disabled={issues.length > 0} onClick={() => { setFormError(""); setTransition(to); }}>
                      {NEXT_LABEL[to]}
                    </Btn>
                    {issues.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-[#92400E]">
                        {issues.map((x) => (
                          <li key={x} className="flex gap-1.5">
                            <IconAlert size={13} className="mt-0.5 shrink-0" />
                            {x}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            {!canManage && canApprove && data.majors.some((m) => m.status === "CONFIGURING") && (
              <div className="mt-4">
                <Notice>Có ngành đang chờ bạn phê duyệt chỉ tiêu.</Notice>
              </div>
            )}
          </Panel>

          <Panel title="Lịch">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-gray-500">Đăng ký</dt>
                <dd className="tabular-nums text-gray-900">
                  {fmtDateTime(b.registrationStartAt)} đến {fmtDateTime(b.registrationEndAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Thi / phỏng vấn</dt>
                <dd className="tabular-nums text-gray-900">{b.examStartAt ? `${fmtDate(b.examStartAt)} đến ${fmtDate(b.examEndAt)}` : "Chưa xếp lịch"}</dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>

      {/* Chuyển trạng thái đợt */}
      <Modal
        open={!!transition}
        onClose={() => setTransition(null)}
        title={transition ? `${NEXT_LABEL[transition]}?` : ""}
        description={transition ? NEXT_EFFECT[transition] : undefined}
        footer={
          <>
            <Btn onClick={() => setTransition(null)}>Hủy</Btn>
            <Btn variant={transition === "CANCELLED" ? "danger" : "navy"} loading={busy} onClick={() => transition && run(() => changeBatchStatus(batchId, transition), `Đợt ${b.batchCode}: ${NEXT_LABEL[transition].toLowerCase()} thành công.`, () => setTransition(null))}>
              {transition ? NEXT_LABEL[transition] : ""}
            </Btn>
          </>
        }
      >
        {formError && <ErrorBox message={formError} />}
      </Modal>

      {/* Thêm ngành */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Thêm ngành vào đợt"
        description="Ngành mới ở trạng thái Chờ phê duyệt, có sẵn 2 hình thức xét mặc định để bạn chỉnh lại."
        footer={
          <>
            <Btn onClick={() => setAddOpen(false)}>Hủy</Btn>
            <Btn variant="primary" loading={busy} onClick={() => run(() => addBatchMajor(batchId, Number(addMajorId), Number(addQuota)), "Đã thêm ngành.", () => setAddOpen(false))}>
              Thêm ngành
            </Btn>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
          <div>
            <Label htmlFor="add-major" required>Ngành</Label>
            <select id="add-major" className={fieldCls} value={addMajorId} onChange={(e) => setAddMajorId(e.target.value)}>
              {available.map((m) => (
                <option key={m.majorId} value={m.majorId}>
                  {m.majorName} ({m.majorCode})
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="add-quota" required>Chỉ tiêu</Label>
            <input id="add-quota" type="number" min={1} inputMode="numeric" className={fieldCls} value={addQuota} onChange={(e) => setAddQuota(e.target.value)} />
          </div>
        </div>
        {formError && <div className="mt-4"><ErrorBox message={formError} /></div>}
      </Modal>

      {/* Sửa chỉ tiêu & môn thi */}
      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit ? `Cấu hình ngành ${edit.major.majorName}` : ""}
        description={edit?.status === "APPROVED" ? "Ngành đã được phê duyệt. Lưu thay đổi sẽ cần lãnh đạo phê duyệt lại." : "Tổng trọng số các môn phải đúng 100% mới được phê duyệt."}
        width="max-w-2xl"
        footer={
          <>
            <Btn onClick={() => setEdit(null)}>Hủy</Btn>
            <Btn
              variant="primary"
              loading={busy}
              onClick={() =>
                edit &&
                run(
                  () =>
                    updateBatchMajor(edit.batchMajorId, {
                      quota: Number(quota),
                      subjects: rows.map((r) => ({ subjectId: r.subjectId, subjectName: r.subjectName, examFormat: r.examFormat, weight: (Number(r.weightPct) || 0) / 100, maxScore: r.maxScore })),
                    }),
                  "Đã lưu cấu hình ngành.",
                  () => setEdit(null),
                )
              }
            >
              Lưu cấu hình
            </Btn>
          </>
        }
      >
        <div className="max-w-[160px]">
          <Label htmlFor="edit-quota" required>Chỉ tiêu</Label>
          <input id="edit-quota" type="number" min={1} className={fieldCls} value={quota} onChange={(e) => setQuota(e.target.value)} />
        </div>
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[13px] font-semibold text-gray-700">Môn thi / hình thức xét</p>
            <span className={`text-[13px] font-semibold tabular-nums ${rowsSum === 100 ? "text-[#166534]" : "text-[#B91C1C]"}`}>Tổng trọng số: {rowsSum}%</span>
          </div>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-input border border-gray-200 p-2.5 sm:grid-cols-[minmax(0,1fr)_130px_90px_auto]">
                <input aria-label="Tên môn" className={`${fieldCls} col-span-2 sm:col-span-1`} value={r.subjectName} onChange={(e) => setRows((xs) => xs.map((x, j) => (j === i ? { ...x, subjectName: e.target.value } : x)))} />
                <select aria-label="Hình thức" className={fieldCls} value={r.examFormat} onChange={(e) => setRows((xs) => xs.map((x, j) => (j === i ? { ...x, examFormat: e.target.value as ExamFormat } : x)))}>
                  {Object.entries(EXAM_FORMAT_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <label className="relative">
                  <span className="sr-only">Trọng số phần trăm</span>
                  <input type="number" min={1} max={100} className={`${fieldCls} pr-7`} value={r.weightPct} onChange={(e) => setRows((xs) => xs.map((x, j) => (j === i ? { ...x, weightPct: e.target.value } : x)))} />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
                </label>
                <button type="button" aria-label={`Xóa ${r.subjectName || "môn"}`} disabled={rows.length <= 1} onClick={() => setRows((xs) => xs.filter((_, j) => j !== i))} className="flex h-10 w-10 items-center justify-center self-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30">
                  <IconX size={16} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setRows((xs) => [...xs, { subjectName: "", examFormat: "THI_VIET", weightPct: "", maxScore: 10 }])} className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent hover:underline">
            <IconPlus size={14} /> Thêm môn
          </button>
        </div>
        {formError && <div className="mt-4"><ErrorBox message={formError} /></div>}
      </Modal>

      {/* Phê duyệt */}
      <Modal
        open={!!approve}
        onClose={() => setApprove(null)}
        title={approve ? `Phê duyệt ngành ${approve.major.majorName}?` : ""}
        description={approve ? `Chỉ tiêu ${approve.quota}, tổng trọng số môn thi ${Math.round(weightSum(approve.subjects) * 100)}%. Sau khi phê duyệt, cán bộ tuyển sinh mới mở được đợt.` : undefined}
        footer={
          <>
            <Btn onClick={() => setApprove(null)}>Hủy</Btn>
            <Btn variant="navy" loading={busy} onClick={() => approve && run(() => approveBatchMajor(approve.batchMajorId), "Đã phê duyệt chỉ tiêu.", () => setApprove(null))}>
              Phê duyệt
            </Btn>
          </>
        }
      >
        {formError && <ErrorBox message={formError} />}
      </Modal>
    </>
  );
}

export default function BatchDetailPage() {
  return (
    <RequirePermission perm="batch:view">
      <BatchDetailInner />
    </RequirePermission>
  );
}
