"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RequirePermission, useAdmin } from "@/components/admin/AdminShell";
import { Btn, EmptyState, ErrorBox, fieldCls, Label, Modal, Notice, PageHeader, Panel, Skeleton, Tag, useToast } from "@/components/admin/ui";
import {
  completeEnrollment,
  createDecision,
  getDecisions,
  listScoringBatches,
  processOverdue,
  returnDecision,
  setOriginals,
  signDecision,
  submitDecision,
  updateDecision,
  type DecisionItem,
  type DecisionStatus,
  type EnrollRow,
} from "@/lib/admin/api";
import { errorMessage, fmtDate, fmtDateTime } from "@/lib/admin/format";
import { useAsync } from "@/lib/admin/useAsync";

const DECISION_TONE: Record<DecisionStatus, "gray" | "amber" | "red" | "green" | "blue"> = { DRAFT: "gray", PENDING_SIGN: "amber", FAILED_SIGN: "red", SIGNED: "blue", ISSUED: "green" };
const CONFIRM_LABEL = { CHUA_XAC_NHAN: "Chờ xác nhận", DA_XAC_NHAN: "Đã xác nhận", TU_CHOI_QUA_HAN: "Từ chối / quá hạn" } as const;
const CONFIRM_TONE = { CHUA_XAC_NHAN: "amber", DA_XAC_NHAN: "green", TU_CHOI_QUA_HAN: "gray" } as const;
const ORIGINALS_LABEL = { PENDING: "Chưa nộp bản chính", VERIFIED: "Đã đối chiếu", MISSING: "Còn thiếu" } as const;

function Stat({ label, value, tone = "text-gray-900" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-card border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-0.5 text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function Inner() {
  const { can } = useAdmin();
  const toast = useToast();
  const canManage = can("decision:manage");
  const canSign = can("decision:sign");
  const batches = useAsync(() => listScoringBatches(), []);
  const [batchId, setBatchId] = useState<number | null>(null);
  useEffect(() => {
    if (batchId === null && batches.data?.length) setBatchId((batches.data.find((b) => b.majors.some((m) => m.resultStage === "PUBLISHED")) ?? batches.data[0]).batchId);
  }, [batches.data, batchId]);
  const ov = useAsync(() => (batchId ? getDecisions(batchId) : Promise.resolve(null)), [batchId]);
  const d = ov.data;

  const [form, setForm] = useState<{ target: DecisionItem | "new"; decisionNo: string; decisionDate: string } | null>(null);
  const [ret, setRet] = useState<DecisionItem | null>(null);
  const [missing, setMissing] = useState<EnrollRow | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  async function act<T>(key: string, fn: () => Promise<T>, okMsg: string | ((r: T) => string)) {
    setBusy(key);
    setErr("");
    try {
      const r = await fn();
      toast(typeof okMsg === "function" ? okMsg(r) : okMsg);
      setForm(null);
      setRet(null);
      setMissing(null);
    } catch (e) {
      const m = errorMessage(e);
      if (form || ret || missing) setErr(m);
      else toast(m, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Quyết định trúng tuyển & nhập học"
        description="Lập quyết định công nhận trúng tuyển cho thí sinh đã được công bố, trình lãnh đạo ký ban hành; theo dõi thí sinh xác nhận nhập học, đối chiếu bản chính và hoàn tất nhập học. Thí sinh từ chối hoặc quá hạn được thay bằng người dự bị kế tiếp."
        actions={
          <select className={`${fieldCls} md:w-80`} value={batchId ?? ""} onChange={(e) => setBatchId(Number(e.target.value))} aria-label="Đợt tuyển sinh">
            {batches.data?.map((b) => (
              <option key={b.batchId} value={b.batchId}>
                {b.batchCode} — {b.batchName}
              </option>
            ))}
          </select>
        }
      />
      {batches.error && <ErrorBox message={batches.error} onRetry={() => batches.reload()} />}
      {ov.error && <ErrorBox message={ov.error} onRetry={() => ov.reload()} />}
      {batches.data && !batches.data.length && <EmptyState title="Chưa có đợt tuyển sinh nào" />}
      {!d ? (
        batchId && <Skeleton className="h-72" />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <Stat label="Trúng tuyển (có QĐ)" value={d.stats.admitted} />
            <Stat label="Chờ xác nhận" value={d.stats.waiting} tone={d.stats.waiting ? "text-[#92400E]" : "text-gray-900"} />
            <Stat label="Đã xác nhận" value={d.stats.confirmed} tone="text-[#166534]" />
            <Stat label="Từ chối / quá hạn" value={d.stats.declined} />
            <Stat label="Quá hạn chưa xử lý" value={d.stats.overdue} tone={d.stats.overdue ? "text-[#B91C1C]" : "text-gray-900"} />
            <Stat label="Đã nhập học" value={d.stats.enrolled} tone="text-[#166534]" />
          </div>

          <Panel
            title="Quyết định công nhận trúng tuyển"
            bodyClass=""
            action={
              canManage && d.pending.length > 0 ? (
                <Btn size="sm" variant="primary" onClick={() => (setErr(""), setForm({ target: "new", decisionNo: "", decisionDate: new Date().toISOString().slice(0, 10) }))}>
                  Lập quyết định ({d.pending.length} thí sinh)
                </Btn>
              ) : undefined
            }
          >
            {d.pending.length > 0 && (
              <div className="border-b border-gray-100 px-5 py-3">
                <Notice tone="blue">
                  {d.pending.length} thí sinh trúng tuyển chưa có quyết định: {d.pending.map((p) => p.fullName).join(", ")}.
                </Notice>
              </div>
            )}
            {d.decisions.length === 0 ? (
              <EmptyState title="Chưa có quyết định nào">Quyết định được lập sau khi lãnh đạo phê duyệt và công bố kết quả xét tuyển ở trang Xét trúng tuyển.</EmptyState>
            ) : (
              <ul className="divide-y divide-gray-100">
                {d.decisions.map((x) => (
                  <li key={x.decisionId} className="flex flex-col gap-2 px-5 py-3.5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">
                        Quyết định số {x.decisionNo} <span className="font-normal text-gray-500">ngày {fmtDate(x.decisionDate)}</span>
                        <span className="ml-2">
                          <Tag tone={DECISION_TONE[x.status]}>{x.statusLabel}</Tag>
                        </span>
                      </p>
                      <p className="text-[13px] text-gray-600">
                        {x.count} thí sinh{x.signedAt ? ` · ký ${fmtDateTime(x.signedAt)} bởi ${x.signedBy}` : ""}
                      </p>
                      {x.status === "FAILED_SIGN" && x.returnNote && <p className="text-[13px] text-[#B91C1C]">Bị trả lại: {x.returnNote}</p>}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Link href={`/admin/decision-print?id=${x.decisionId}`} target="_blank">
                        <Btn size="sm">{x.status === "ISSUED" ? "Xem / in" : "Xem dự thảo"}</Btn>
                      </Link>
                      {canManage && (x.status === "DRAFT" || x.status === "FAILED_SIGN") && (
                        <>
                          <Btn size="sm" onClick={() => (setErr(""), setForm({ target: x, decisionNo: x.decisionNo ?? "", decisionDate: x.decisionDate ?? "" }))}>
                            Sửa
                          </Btn>
                          <Btn size="sm" variant="navy" loading={busy === `submit${x.decisionId}`} onClick={() => act(`submit${x.decisionId}`, () => submitDecision(x.decisionId), "Đã trình ký quyết định.")}>
                            Trình ký
                          </Btn>
                        </>
                      )}
                      {canSign && x.status === "PENDING_SIGN" && (
                        <>
                          <Btn size="sm" variant="danger" onClick={() => (setErr(""), setNote(""), setRet(x))}>
                            Trả lại
                          </Btn>
                          <Btn
                            size="sm"
                            variant="success"
                            loading={busy === `sign${x.decisionId}`}
                            onClick={() => act(`sign${x.decisionId}`, () => signDecision(x.decisionId), (r) => `Đã ký ban hành. ${r.count} thí sinh được báo xác nhận nhập học trước ${fmtDateTime(r.deadline)}.`)}
                          >
                            Ký ban hành
                          </Btn>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Xác nhận nhập học"
            bodyClass=""
            action={
              canManage && d.stats.overdue > 0 ? (
                <Btn size="sm" variant="warning" loading={busy === "overdue"} onClick={() => act("overdue", () => processOverdue(d.batch.batchId), (r) => `Đã xử lý ${r.expired} thí sinh quá hạn, gọi ${r.promoted} thí sinh dự bị.`)}>
                  Xử lý quá hạn ({d.stats.overdue})
                </Btn>
              ) : undefined
            }
          >
            {d.admitted.length === 0 ? (
              <EmptyState title="Chưa có thí sinh nào trong quyết định" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500">
                    <tr>
                      <th className="px-4 py-2.5">Thí sinh</th>
                      <th className="px-4 py-2.5">Ngành / quyết định</th>
                      <th className="px-4 py-2.5">Xác nhận nhập học</th>
                      <th className="px-4 py-2.5">Bản chính</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {d.admitted.map((r) => (
                      <tr key={r.applicationId}>
                        <td className="px-4 py-2.5">
                          <Link href={`/admin/applications/${r.applicationId}`} className="font-semibold text-gray-900 hover:text-accent hover:underline">
                            {r.fullName}
                          </Link>
                          <span className="block font-mono text-xs text-gray-500">{r.applicationCode}</span>
                          {r.fromWaitlist && <Tag tone="blue">Gọi từ dự bị</Tag>}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">
                          {r.majorName}
                          <span className="block text-xs text-gray-500">QĐ {r.decisionNo}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          {r.confirmation ? (
                            <>
                              <Tag tone={r.confirmation.overdue ? "red" : CONFIRM_TONE[r.confirmation.status]}>{r.confirmation.overdue ? "Quá hạn" : CONFIRM_LABEL[r.confirmation.status]}</Tag>
                              <span className="mt-0.5 block text-xs text-gray-500">
                                {r.confirmation.confirmedAt ? `Xác nhận ${fmtDateTime(r.confirmation.confirmedAt)}` : `Hạn ${fmtDateTime(r.confirmation.deadline)}`}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400">Chờ ký quyết định</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {r.completion ? (
                            <span>
                              <Tag tone="green">Đã nhập học</Tag>
                              <span className="mt-0.5 block font-mono text-xs text-gray-700">{r.completion.transferRef}</span>
                            </span>
                          ) : r.originals ? (
                            <Tag tone={r.originals.status === "VERIFIED" ? "green" : r.originals.status === "MISSING" ? "red" : "gray"}>{ORIGINALS_LABEL[r.originals.status]}</Tag>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {canManage && r.confirmation?.status === "DA_XAC_NHAN" && !r.completion && (
                            <div className="flex justify-end gap-2">
                              {r.originals?.status !== "VERIFIED" ? (
                                <>
                                  <Btn size="sm" onClick={() => (setErr(""), setNote(""), setMissing(r))}>
                                    Còn thiếu
                                  </Btn>
                                  <Btn size="sm" variant="navy" loading={busy === `orig${r.applicationId}`} onClick={() => act(`orig${r.applicationId}`, () => setOriginals(r.applicationId, "VERIFIED"), `Đã ghi nhận đối chiếu bản chính của ${r.fullName}.`)}>
                                    Đã đối chiếu bản chính
                                  </Btn>
                                </>
                              ) : (
                                <Btn
                                  size="sm"
                                  variant="success"
                                  loading={busy === `done${r.applicationId}`}
                                  onClick={() => act(`done${r.applicationId}`, () => completeEnrollment(r.applicationId), (x) => `${r.fullName} đã hoàn tất nhập học. Mã học viên: ${x.transferRef}.`)}
                                >
                                  Hoàn tất nhập học
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
          </Panel>

          {d.waitlist.length > 0 && (
            <Panel title="Danh sách dự bị" bodyClass="">
              <ul className="divide-y divide-gray-100">
                {d.waitlist.map((w) => (
                  <li key={w.applicationCode} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span>
                      <b className="tabular-nums">#{w.rank}</b> {w.fullName} <span className="text-gray-500">· {w.majorName}</span>
                    </span>
                    <Tag tone={w.status === "PROMOTED" ? "green" : w.status === "WAITING" ? "amber" : "gray"}>{w.status === "PROMOTED" ? "Đã gọi trúng tuyển" : w.status === "WAITING" ? "Đang chờ" : "Hết hiệu lực"}</Tag>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.target === "new" ? "Lập dự thảo quyết định trúng tuyển" : "Sửa dự thảo quyết định"}
        description={form?.target === "new" ? `Gồm ${d?.pending.length ?? 0} thí sinh trúng tuyển chưa có quyết định.` : "Thí sinh trúng tuyển mới phát sinh (gọi dự bị) được bổ sung vào dự thảo khi lưu."}
        footer={
          <>
            <Btn onClick={() => setForm(null)}>Hủy</Btn>
            <Btn
              variant="primary"
              loading={busy === "form"}
              onClick={() =>
                form &&
                act(
                  "form",
                  (): Promise<unknown> => (form.target === "new" ? createDecision(d!.batch.batchId, { decisionNo: form.decisionNo, decisionDate: form.decisionDate }) : updateDecision(form.target.decisionId, { decisionNo: form.decisionNo, decisionDate: form.decisionDate })),
                  form.target === "new" ? "Đã lập dự thảo quyết định. Kiểm tra rồi bấm “Trình ký”." : "Đã lưu dự thảo.",
                )
              }
            >
              Lưu dự thảo
            </Btn>
          </>
        }
      >
        {form && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="dc-no" required>
                Số quyết định
              </Label>
              <input id="dc-no" className={fieldCls} value={form.decisionNo} maxLength={50} placeholder="1234/QĐ-ĐHAG" onChange={(e) => setForm({ ...form, decisionNo: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="dc-date" required>
                Ngày quyết định
              </Label>
              <input id="dc-date" type="date" className={fieldCls} value={form.decisionDate} onChange={(e) => setForm({ ...form, decisionDate: e.target.value })} />
            </div>
          </div>
        )}
        {err && (
          <div className="mt-3">
            <ErrorBox message={err} />
          </div>
        )}
      </Modal>

      <Modal
        open={!!ret}
        onClose={() => setRet(null)}
        title={`Trả lại quyết định ${ret?.decisionNo ?? ""}`}
        footer={
          <>
            <Btn onClick={() => setRet(null)}>Hủy</Btn>
            <Btn variant="danger" loading={busy === "ret"} disabled={note.trim().length < 10} onClick={() => ret && act("ret", () => returnDecision(ret.decisionId, note), "Đã trả lại dự thảo cho cán bộ.")}>
              Trả lại
            </Btn>
          </>
        }
      >
        <Label htmlFor="dc-note" required>
          Lý do
        </Label>
        <textarea id="dc-note" rows={3} className={fieldCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: Sai ngày quyết định, đề nghị sửa lại." />
        {err && (
          <div className="mt-3">
            <ErrorBox message={err} />
          </div>
        )}
      </Modal>

      <Modal
        open={!!missing}
        onClose={() => setMissing(null)}
        title={`Bản chính còn thiếu — ${missing?.fullName ?? ""}`}
        description="Thí sinh nhận thông báo kèm nội dung này để nộp bổ sung."
        footer={
          <>
            <Btn onClick={() => setMissing(null)}>Hủy</Btn>
            <Btn variant="navy" loading={busy === "miss"} disabled={note.trim().length < 5} onClick={() => missing && act("miss", () => setOriginals(missing.applicationId, "MISSING", note), "Đã báo thí sinh nộp bổ sung bản chính.")}>
              Gửi yêu cầu bổ sung
            </Btn>
          </>
        }
      >
        <Label htmlFor="og-note" required>
          Giấy tờ còn thiếu
        </Label>
        <textarea id="og-note" rows={3} className={fieldCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: Bản chính bảng điểm đại học." />
        {err && (
          <div className="mt-3">
            <ErrorBox message={err} />
          </div>
        )}
      </Modal>
    </>
  );
}

export default function DecisionsPage() {
  return (
    <RequirePermission perm={["decision:manage", "decision:sign"]}>
      <Inner />
    </RequirePermission>
  );
}
