"use client";

import Link from "next/link";
import { useState } from "react";
import { RequirePermission, useAdmin } from "@/components/admin/AdminShell";
import { AppealBadge, Btn, EmptyState, ErrorBox, fieldCls, Label, LoadingRows, Modal, PageHeader, Tag, useToast } from "@/components/admin/ui";
import { closeAppealRequest, confirmAppealFee, listAppeals, resolveAppeal, type AppealRow } from "@/lib/admin/api";
import { errorMessage, fmtDateTime, fmtMoney, relativeDays } from "@/lib/admin/format";
import { useAsync } from "@/lib/admin/useAsync";

const score = (n: number | null) => (n === null ? "—" : n.toFixed(2).replace(".", ","));

function AppealsInner() {
  const { can } = useAdmin();
  const toast = useToast();
  const canResolve = can("appeal:resolve");
  const { data, error, loading, reload } = useAsync(listAppeals, []);
  const [tab, setTab] = useState<"PENDING" | "DONE" | "ALL">("PENDING");
  const [target, setTarget] = useState<AppealRow | null>(null);
  const [changed, setChanged] = useState(false);
  const [newScore, setNewScore] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [feeTarget, setFeeTarget] = useState<AppealRow | null>(null);
  const [receiptNo, setReceiptNo] = useState("");

  async function confirmFee() {
    if (!feeTarget?.request) return;
    setBusy(true);
    setFormError("");
    try {
      await confirmAppealFee(feeTarget.request.requestId, receiptNo);
      toast("Đã xác nhận lệ phí phúc khảo. Đơn chuyển sang chờ hội đồng kết luận.");
      setFeeTarget(null);
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function closeUnpaid(p: AppealRow) {
    if (!p.request) return;
    try {
      await closeAppealRequest(p.request.requestId);
      toast("Đã đóng đơn không nộp lệ phí; điểm giữ nguyên và thí sinh được thông báo.");
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  const list = (data ?? []).filter((p) => (tab === "ALL" ? true : tab === "PENDING" ? p.status === "PENDING" : p.status !== "PENDING"));
  const pendingCount = data?.filter((p) => p.status === "PENDING").length ?? 0;

  function openResolve(p: AppealRow) {
    setTarget(p);
    setChanged(false);
    setNewScore(String(p.oldScore));
    setNote("");
    setFormError("");
  }

  async function submit() {
    if (!target) return;
    setBusy(true);
    setFormError("");
    try {
      await resolveAppeal(target.appealId, { changed, newScore: Number(newScore.replace(",", ".")), note });
      toast("Đã lưu kết quả phúc khảo và gửi thông báo cho thí sinh.");
      setTarget(null);
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Phúc khảo điểm"
        description="Đơn thí sinh gửi sau khi công bố điểm. Điểm sau phúc khảo được dùng để tính lại tổng điểm và xếp hạng của ngành."
      />

      <div className="mb-4 flex gap-1.5" role="tablist" aria-label="Lọc đơn phúc khảo">
        {([
          ["PENDING", `Chờ xử lý (${pendingCount})`],
          ["DONE", "Đã xử lý"],
          ["ALL", "Tất cả"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`h-9 rounded-full border px-3.5 text-[13px] font-semibold ${tab === k ? "border-navy-800 bg-navy-800 text-white" : "border-gray-200 bg-white text-gray-600 hover:text-gray-900"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <ErrorBox message={error} onRetry={() => reload()} />}

      <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
        {loading && !data ? (
          <LoadingRows rows={4} />
        ) : list.length === 0 ? (
          <EmptyState title={tab === "PENDING" ? "Không còn đơn phúc khảo chờ xử lý" : "Chưa có đơn nào"} />
        ) : (
          <ul className="divide-y divide-gray-100">
            {list.map((p) => (
              <li key={p.appealId} className="grid gap-4 px-5 py-5 md:grid-cols-[minmax(0,1fr)_150px_auto] md:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/applications/${p.applicationId}`} className="font-semibold text-gray-900 hover:text-accent hover:underline">
                      {p.candidateName}
                    </Link>
                    <AppealBadge status={p.status} />
                  </div>
                  <p className="mt-0.5 text-[13px] text-gray-500">
                    <span className="font-mono">{p.applicationCode}</span>, {p.majorName}
                  </p>
                  <p className="mt-2 text-[13px] font-semibold text-gray-700">{p.subjectName}</p>
                  <blockquote className="mt-1 max-w-[70ch] border-l-2 border-gray-200 pl-3 text-sm italic text-gray-600">{p.reason}</blockquote>
                  <p className="mt-2 text-xs text-gray-400">Gửi {fmtDateTime(p.createdAt)} ({relativeDays(p.createdAt)})</p>
                  {p.request && (
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-gray-600">
                      Lệ phí {fmtMoney(p.request.feeAmount)}:
                      {p.request.status === "DA_NOP_PHI" ? (
                        <Tag tone="green">Đã nộp{p.request.receiptNo ? ` · BL ${p.request.receiptNo}` : ""}</Tag>
                      ) : p.request.status === "DONG" ? (
                        <Tag tone="gray">Không nộp — đã đóng đơn</Tag>
                      ) : (
                        <>
                          <Tag tone="amber">Chưa nộp</Tag>
                          <span className="text-xs text-gray-500">
                            nội dung CK <span className="font-mono">{p.request.transferNote}</span>
                          </span>
                        </>
                      )}
                    </p>
                  )}
                  {p.status !== "PENDING" && (
                    <p className="mt-2 text-[13px] text-gray-700">
                      <span className="font-semibold">Kết luận:</span> {p.resolutionNote} <span className="text-gray-400">({p.resolvedByName}, {fmtDateTime(p.resolvedAt)})</span>
                    </p>
                  )}
                </div>
                <div className="flex gap-6 md:block md:space-y-2">
                  <div>
                    <p className="text-xs text-gray-500">Điểm ban đầu</p>
                    <p className="text-xl font-bold tabular-nums text-gray-900">{score(p.oldScore)}</p>
                  </div>
                  {p.status !== "PENDING" && (
                    <div>
                      <p className="text-xs text-gray-500">Sau phúc khảo</p>
                      <p className={`text-xl font-bold tabular-nums ${p.status === "RESOLVED_CHANGED" ? "text-[#166534]" : "text-gray-900"}`}>{score(p.newScore)}</p>
                    </div>
                  )}
                </div>
                <div className="md:text-right">
                  {p.status === "PENDING" && canResolve && p.request?.status === "CHO_NOP_PHI" ? (
                    <div className="flex flex-col items-stretch gap-2 md:items-end">
                      <Btn variant="navy" size="sm" onClick={() => (setFormError(""), setReceiptNo(""), setFeeTarget(p))}>
                        Xác nhận đã nhận lệ phí
                      </Btn>
                      {p.request.appealDeadline && new Date(p.request.appealDeadline).getTime() < Date.now() && (
                        <Btn size="sm" variant="danger" onClick={() => closeUnpaid(p)}>
                          Đóng đơn (không nộp phí)
                        </Btn>
                      )}
                    </div>
                  ) : (
                    p.status === "PENDING" &&
                    canResolve && (
                      <Btn variant="navy" size="sm" onClick={() => openResolve(p)}>
                        Xử lý đơn
                      </Btn>
                    )
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={!!target}
        onClose={() => setTarget(null)}
        title="Kết luận phúc khảo"
        description={target ? `${target.candidateName}, môn ${target.subjectName}. Điểm ban đầu: ${score(target.oldScore)}.` : undefined}
        footer={
          <>
            <Btn onClick={() => setTarget(null)}>Hủy</Btn>
            <Btn variant="navy" loading={busy} disabled={note.trim().length < 10} onClick={submit}>
              Lưu kết luận
            </Btn>
          </>
        }
      >
        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold text-gray-700">Kết quả chấm lại</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              [false, "Giữ nguyên điểm"],
              [true, "Điều chỉnh điểm"],
            ].map(([v, label]) => (
              <label key={String(v)} className={`flex cursor-pointer items-center gap-2.5 rounded-input border px-3.5 py-3 text-sm font-medium ${changed === v ? "border-navy-800 bg-navy-50 text-navy-900" : "border-gray-200 text-gray-700"}`}>
                <input type="radio" name="changed" className="accent-[#1B3A66]" checked={changed === v} onChange={() => setChanged(v as boolean)} />
                {label as string}
              </label>
            ))}
          </div>
        </fieldset>
        {changed && (
          <div className="mt-4 max-w-[180px]">
            <Label htmlFor="new-score" required>Điểm sau phúc khảo</Label>
            <input id="new-score" type="number" min={0} max={10} step={0.05} className={fieldCls} value={newScore} onChange={(e) => setNewScore(e.target.value)} />
          </div>
        )}
        <div className="mt-4">
          <Label htmlFor="appeal-note" required>Kết luận của hội đồng</Label>
          <textarea id="appeal-note" rows={3} className={fieldCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: Hội đồng chấm lại phần trả lời câu 2, cộng 0,5 điểm do chấm sót ý." />
          <p className="mt-1 text-xs text-gray-400">Tối thiểu 10 ký tự. Nội dung này được gửi cho thí sinh.</p>
        </div>
        {formError && <div className="mt-3"><ErrorBox message={formError} /></div>}
      </Modal>
      <Modal
        open={!!feeTarget}
        onClose={() => setFeeTarget(null)}
        title="Xác nhận lệ phí phúc khảo"
        description={feeTarget?.request ? `${feeTarget.candidateName} — ${fmtMoney(feeTarget.request.feeAmount)}, nội dung chuyển khoản ${feeTarget.request.transferNote}. Đối chiếu sao kê trước khi xác nhận.` : undefined}
        footer={
          <>
            <Btn onClick={() => setFeeTarget(null)}>Hủy</Btn>
            <Btn variant="navy" loading={busy} onClick={confirmFee}>
              Xác nhận
            </Btn>
          </>
        }
      >
        <Label htmlFor="fee-receipt">Số biên lai (nếu có)</Label>
        <input id="fee-receipt" className={fieldCls} value={receiptNo} maxLength={50} onChange={(e) => setReceiptNo(e.target.value)} />
        {formError && <div className="mt-3"><ErrorBox message={formError} /></div>}
      </Modal>
    </>
  );
}

export default function AppealsPage() {
  return (
    <RequirePermission perm="appeal:view">
      <AppealsInner />
    </RequirePermission>
  );
}
