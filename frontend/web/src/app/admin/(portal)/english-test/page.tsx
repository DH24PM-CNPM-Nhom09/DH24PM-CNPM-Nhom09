"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RequirePermission } from "@/components/admin/AdminShell";
import { IconPlus } from "@/components/admin/Icons";
import { Btn, EmptyState, ErrorBox, fieldCls, Label, LoadingRows, Modal, Notice, PageHeader, Panel, Skeleton, useToast } from "@/components/admin/ui";
import {
  autoAssignEnglish,
  createEnglishSession,
  getEnglishOverview,
  listEnglishBatches,
  moveEnglishCandidate,
  saveEnglishResults,
  updateEnglishSession,
  type EnglishCandidate,
  type EnglishResult,
  type EnglishSession,
  type EnglishSessionInput,
} from "@/lib/admin/api";
import { errorMessage, fmtDate, fmtDateTime, toLocalInput } from "@/lib/admin/format";
import { useAsync } from "@/lib/admin/useAsync";

const RESULT_LABEL: Record<EnglishResult, string> = { PENDING: "Chưa có kết quả", PASSED: "Đạt", FAILED: "Không đạt", ABSENT: "Vắng thi" };
const RESULT_CLS: Record<EnglishResult, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  PASSED: "bg-[#EAF7EE] text-[#166534]",
  FAILED: "bg-[#FDECEC] text-[#B91C1C]",
  ABSENT: "bg-[#FEF3E2] text-[#92400E]",
};
const SESSION_STATUS: Record<EnglishSession["status"], string> = { SCHEDULED: "Sắp thi", COMPLETED: "Đã có kết quả", CANCELLED: "Đã hủy" };

function Stat({ label, value, tone = "text-gray-900" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-card border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-0.5 text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function Inner() {
  const toast = useToast();
  const batches = useAsync(() => listEnglishBatches(), []);
  const [batchId, setBatchId] = useState<number | null>(null);
  useEffect(() => {
    if (batchId === null && batches.data?.length) setBatchId((batches.data.find((b) => b.candidates > 0) ?? batches.data[0]).batchId);
  }, [batches.data, batchId]);
  const ov = useAsync(() => (batchId ? getEnglishOverview(batchId) : Promise.resolve(null)), [batchId]);
  const data = ov.data;

  // ---- phòng thi
  const [editing, setEditing] = useState<EnglishSession | "new" | null>(null);
  const [form, setForm] = useState<EnglishSessionInput>({ sessionCode: "", testAt: "", room: "", location: "", capacity: 30, note: "" });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  // ---- xếp phòng
  const [paidOnly, setPaidOnly] = useState(true);
  const [assigning, setAssigning] = useState(false);
  // ---- nhập kết quả
  const [gradeSession, setGradeSession] = useState<EnglishSession | null>(null);
  const [rows, setRows] = useState<Record<number, { result: EnglishResult; score: string; note: string }>>({});

  const unassigned = useMemo(() => data?.candidates.filter((c) => !c.registration) ?? [], [data]);
  const inSession = (sid: number) => data?.candidates.filter((c) => c.registration?.sessionId === sid).sort((a, b) => a.registration!.seatNo - b.registration!.seatNo) ?? [];
  const openSessions = data?.sessions.filter((s) => s.status === "SCHEDULED") ?? [];

  function openSession(s: EnglishSession | "new") {
    setFormError("");
    setEditing(s);
    if (s === "new") {
      const d = new Date(Date.now() + 14 * 86_400_000);
      d.setHours(7, 30, 0, 0);
      const n = (data?.sessions.length ?? 0) + 1;
      setForm({ sessionCode: `TA-${String(n).padStart(2, "0")}`, testAt: toLocalInput(d), room: "", location: "Trường Đại học An Giang, 18 Ung Văn Khiêm, Long Xuyên", capacity: 30, note: "" });
    } else {
      setForm({ sessionCode: s.sessionCode, testAt: toLocalInput(new Date(s.testAt)), room: s.room, location: s.location ?? "", capacity: s.capacity, note: s.note ?? "" });
    }
  }

  async function saveSession() {
    if (!batchId) return;
    setBusy(true);
    setFormError("");
    try {
      const payload = { ...form, testAt: new Date(form.testAt).toISOString(), capacity: Number(form.capacity) };
      if (editing === "new") await createEnglishSession(batchId, payload);
      else if (editing) await updateEnglishSession(editing.sessionId, payload);
      toast(editing === "new" ? `Đã tạo phòng thi ${form.sessionCode}.` : "Đã lưu phòng thi. Thí sinh trong phòng được báo nếu đổi giờ hoặc phòng.");
      setEditing(null);
      ov.reload(true);
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function cancelSession(s: EnglishSession) {
    try {
      await updateEnglishSession(s.sessionId, { status: "CANCELLED" });
      toast(`Đã hủy phòng thi ${s.sessionCode}.`);
      ov.reload(true);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  async function assign() {
    if (!batchId) return;
    setAssigning(true);
    try {
      const r = await autoAssignEnglish(batchId, paidOnly);
      toast(
        r.assigned
          ? `Đã xếp ${r.assigned} thí sinh và gửi lịch thi.${r.notEnoughSeats ? ` Còn ${r.notEnoughSeats} thí sinh chưa đủ chỗ, hãy thêm phòng thi.` : ""}`
          : r.notEnoughSeats
            ? "Các phòng thi đã đủ chỗ. Hãy thêm phòng thi."
            : "Không có thí sinh nào cần xếp.",
        r.notEnoughSeats ? "error" : undefined,
      );
      ov.reload(true);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setAssigning(false);
    }
  }

  function openGrade(s: EnglishSession) {
    const r: typeof rows = {};
    inSession(s.sessionId).forEach((c) => (r[c.applicationId] = { result: c.registration!.result, score: c.registration!.score?.toString() ?? "", note: c.registration!.note ?? "" }));
    setRows(r);
    setFormError("");
    setGradeSession(s);
  }

  async function saveGrades() {
    if (!gradeSession) return;
    setBusy(true);
    setFormError("");
    try {
      const items = Object.entries(rows).map(([appId, v]) => ({ applicationId: Number(appId), result: v.result, score: v.score.trim() ? Number(v.score.replace(",", ".")) : null, note: v.note }));
      const r = await saveEnglishResults(gradeSession.sessionId, items);
      toast(r.changed ? `Đã lưu kết quả ${r.changed} thí sinh. Thí sinh được thông báo kết quả.` : "Không có thay đổi.");
      setGradeSession(null);
      ov.reload(true);
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function move(c: EnglishCandidate, sessionId: number) {
    try {
      await moveEnglishCandidate(c.applicationId, sessionId);
      toast(`Đã chuyển ${c.fullName} sang phòng mới và báo lại lịch thi.`);
      ov.reload(true);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  return (
    <>
      <PageHeader
        title="Thi đánh giá năng lực tiếng Anh"
        description="Chỉ dành cho thí sinh chưa có chứng chỉ ngoại ngữ đạt chuẩn và không thuộc diện miễn (đã chọn “đăng ký dự thi” khi nộp hồ sơ). Tạo phòng thi, xếp phòng tự động để cấp số báo danh và báo lịch, rồi nhập kết quả."
        actions={
          <select className={`${fieldCls} md:w-80`} value={batchId ?? ""} onChange={(e) => setBatchId(Number(e.target.value))} aria-label="Đợt tuyển sinh">
            {batches.data?.map((b) => (
              <option key={b.batchId} value={b.batchId}>
                {b.batchCode} — {b.candidates} thí sinh phải thi
              </option>
            ))}
          </select>
        }
      />

      {batches.error && <ErrorBox message={batches.error} onRetry={() => batches.reload()} />}
      {ov.error && <ErrorBox message={ov.error} onRetry={() => ov.reload()} />}
      {batches.data && batches.data.length === 0 && <EmptyState title="Chưa có đợt tuyển sinh nào" />}

      {!data ? (
        batchId && <Skeleton className="h-64" />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <Stat label="Phải thi" value={data.stats.total} />
            <Stat label="Đã xếp phòng" value={data.stats.assigned} />
            <Stat label="Chưa xếp" value={data.stats.total - data.stats.assigned} tone={data.stats.total - data.stats.assigned ? "text-[#92400E]" : "text-gray-900"} />
            <Stat label="Đạt" value={data.stats.passed} tone="text-[#166534]" />
            <Stat label="Không đạt" value={data.stats.failed} tone="text-[#B91C1C]" />
            <Stat label="Vắng" value={data.stats.absent} tone="text-[#92400E]" />
          </div>

          <Panel
            title="Phòng thi"
            action={
              <Btn size="sm" variant="primary" onClick={() => openSession("new")}>
                <IconPlus size={14} /> Thêm phòng thi
              </Btn>
            }
            bodyClass=""
          >
            {data.sessions.length === 0 ? (
              <EmptyState title="Chưa có phòng thi">Tạo phòng thi (ngày giờ, phòng, sức chứa) rồi bấm “Xếp phòng tự động”.</EmptyState>
            ) : (
              <ul className="divide-y divide-gray-100">
                {data.sessions.map((s) => (
                  <li key={s.sessionId} className={`flex flex-col gap-2 px-5 py-3.5 lg:flex-row lg:items-center lg:justify-between ${s.status === "CANCELLED" ? "opacity-50" : ""}`}>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">
                        <span className="font-mono">{s.sessionCode}</span> · {s.room}
                        <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">{SESSION_STATUS[s.status]}</span>
                      </p>
                      <p className="text-[13px] text-gray-600">
                        {fmtDateTime(s.testAt)}
                        {s.location ? ` · ${s.location}` : ""}
                      </p>
                      <p className="text-xs text-gray-500">
                        Đã xếp {s.assigned}/{s.capacity} chỗ{s.assigned ? ` · đã nhập kết quả ${s.graded}/${s.assigned}` : ""}
                      </p>
                    </div>
                    {s.status !== "CANCELLED" && (
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {s.assigned > 0 && (
                          <Link href={`/admin/english-test-print?batch=${data.batch.batchId}&session=${s.sessionId}`} target="_blank">
                            <Btn size="sm">In danh sách</Btn>
                          </Link>
                        )}
                        {s.assigned > 0 && (
                          <Btn size="sm" variant="navy" disabled={new Date(s.testAt).getTime() > Date.now()} title={new Date(s.testAt).getTime() > Date.now() ? "Nhập kết quả sau giờ thi" : undefined} onClick={() => openGrade(s)}>
                            Nhập kết quả
                          </Btn>
                        )}
                        <Btn size="sm" onClick={() => openSession(s)}>
                          Sửa
                        </Btn>
                        {s.assigned === 0 && (
                          <Btn size="sm" variant="danger" onClick={() => cancelSession(s)}>
                            Hủy
                          </Btn>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title={`Thí sinh chưa xếp phòng (${unassigned.length})`}
            action={
              unassigned.length > 0 ? (
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-[13px] text-gray-600">
                    <input type="checkbox" className="h-4 w-4 accent-[#E8734A]" checked={paidOnly} onChange={(e) => setPaidOnly(e.target.checked)} />
                    Chỉ xếp người đã nộp lệ phí
                  </label>
                  <Btn size="sm" variant="primary" loading={assigning} disabled={openSessions.length === 0} onClick={assign}>
                    Xếp phòng tự động
                  </Btn>
                </div>
              ) : undefined
            }
            bodyClass=""
          >
            {unassigned.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-500">{data.stats.total ? "Tất cả thí sinh đã được xếp phòng." : "Đợt này chưa có thí sinh nào đăng ký thi tiếng Anh."}</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {unassigned.map((c) => (
                  <li key={c.applicationId} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm">
                    <span>
                      <span className="font-semibold text-gray-900">{c.fullName}</span>
                      <span className="text-gray-500"> · {c.majorName} · </span>
                      <Link href={`/admin/applications/${c.applicationId}`} className="font-mono text-[12.5px] text-navy-800 hover:underline">
                        {c.applicationCode}
                      </Link>
                    </span>
                    {!c.paid && <span className="rounded-full bg-[#FEF3E2] px-2.5 py-0.5 text-xs font-semibold text-[#92400E]">Chưa nộp lệ phí</span>}
                  </li>
                ))}
              </ul>
            )}
            {unassigned.length > 0 && openSessions.length === 0 && (
              <div className="border-t border-gray-100 px-5 py-3">
                <Notice>Chưa có phòng thi sắp diễn ra. Thêm phòng thi trước khi xếp.</Notice>
              </div>
            )}
          </Panel>

          {data.sessions.some((s) => s.assigned > 0) && (
            <Panel title="Danh sách đã xếp phòng" bodyClass="">
              {ov.loading && !data ? (
                <LoadingRows />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500">
                      <tr>
                        <th className="px-4 py-2.5">SBD</th>
                        <th className="px-4 py-2.5">Thí sinh</th>
                        <th className="px-4 py-2.5">Ngành</th>
                        <th className="px-4 py-2.5">Phòng / ghế</th>
                        <th className="px-4 py-2.5">Kết quả</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.candidates
                        .filter((c) => c.registration)
                        .sort((a, b) => a.registration!.candidateNumber.localeCompare(b.registration!.candidateNumber))
                        .map((c) => (
                          <tr key={c.applicationId}>
                            <td className="px-4 py-2.5 font-mono text-[12.5px]">{c.registration!.candidateNumber}</td>
                            <td className="px-4 py-2.5">
                              <span className="font-semibold text-gray-900">{c.fullName}</span>
                              <span className="block text-xs text-gray-500">{fmtDate(c.dob)}</span>
                            </td>
                            <td className="px-4 py-2.5 text-gray-600">{c.majorName}</td>
                            <td className="px-4 py-2.5">
                              {c.registration!.result === "PENDING" && openSessions.length > 1 ? (
                                <select
                                  className="rounded-input border border-gray-300 px-2 py-1 text-[13px]"
                                  value={c.registration!.sessionId}
                                  onChange={(e) => move(c, Number(e.target.value))}
                                  aria-label={`Phòng thi của ${c.fullName}`}
                                >
                                  {openSessions.map((s) => (
                                    <option key={s.sessionId} value={s.sessionId} disabled={s.sessionId !== c.registration!.sessionId && s.assigned >= s.capacity}>
                                      {s.sessionCode} ({s.assigned}/{s.capacity})
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="font-mono text-[12.5px]">{c.registration!.sessionCode}</span>
                              )}
                              <span className="ml-2 text-xs text-gray-500">ghế {c.registration!.seatNo}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${RESULT_CLS[c.registration!.result]}`}>{RESULT_LABEL[c.registration!.result]}</span>
                              {c.registration!.score !== null && <span className="ml-2 text-xs text-gray-600">{c.registration!.score} điểm</span>}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}
        </div>
      )}

      {/* Tạo / sửa phòng thi */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Thêm phòng thi" : "Sửa phòng thi"}
        description={editing && editing !== "new" && editing.assigned ? "Đổi giờ, phòng hoặc địa điểm sẽ gửi thông báo lại cho thí sinh trong phòng." : undefined}
        footer={
          <>
            <Btn onClick={() => setEditing(null)}>Hủy</Btn>
            <Btn variant="primary" loading={busy} onClick={saveSession}>
              Lưu
            </Btn>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="es-code" required>
              Mã phòng thi
            </Label>
            <input id="es-code" className={`${fieldCls} font-mono uppercase`} value={form.sessionCode} maxLength={30} onChange={(e) => setForm({ ...form, sessionCode: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="es-time" required>
              Ngày giờ thi
            </Label>
            <input id="es-time" type="datetime-local" className={fieldCls} value={form.testAt} onChange={(e) => setForm({ ...form, testAt: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="es-room" required>
              Phòng
            </Label>
            <input id="es-room" className={fieldCls} value={form.room} maxLength={100} placeholder="Phòng B2-101" onChange={(e) => setForm({ ...form, room: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="es-cap" required>
              Sức chứa
            </Label>
            <input id="es-cap" type="number" min={1} max={500} className={fieldCls} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="es-loc">Địa điểm</Label>
            <input id="es-loc" className={fieldCls} value={form.location} maxLength={255} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="es-note">Lưu ý cho thí sinh</Label>
            <input id="es-note" className={fieldCls} value={form.note} maxLength={500} placeholder="Ví dụ: mang theo bút chì, tai nghe" onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
        </div>
        {formError && (
          <div className="mt-3">
            <ErrorBox message={formError} />
          </div>
        )}
      </Modal>

      {/* Nhập kết quả */}
      <Modal
        open={gradeSession !== null}
        onClose={() => setGradeSession(null)}
        title={gradeSession ? `Kết quả phòng thi ${gradeSession.sessionCode}` : ""}
        description="Chọn kết quả từng thí sinh; điểm không bắt buộc. Thí sinh nhận thông báo khi kết quả thay đổi."
        width="max-w-4xl"
        footer={
          <>
            <Btn onClick={() => setGradeSession(null)}>Hủy</Btn>
            <Btn variant="primary" loading={busy} onClick={saveGrades}>
              Lưu kết quả
            </Btn>
          </>
        }
      >
        {gradeSession && (
          <div className="space-y-2">
            <div className="flex justify-end">
              <button
                type="button"
                className="text-[13px] font-semibold text-accent hover:underline"
                onClick={() => setRows((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.result === "PENDING" ? { ...v, result: "PASSED" as EnglishResult } : v])))}
              >
                Đánh dấu “Đạt” cho người chưa có kết quả
              </button>
            </div>
            {inSession(gradeSession.sessionId).map((c) => {
              const v = rows[c.applicationId];
              if (!v) return null;
              const set = (patch: Partial<typeof v>) => setRows((r) => ({ ...r, [c.applicationId]: { ...v, ...patch } }));
              return (
                <div key={c.applicationId} className="grid items-center gap-2 rounded-input border border-gray-200 px-3 py-2 md:grid-cols-[110px_minmax(0,1fr)_150px_90px_minmax(0,1fr)]">
                  <span className="font-mono text-[12.5px]">{c.registration!.candidateNumber}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-gray-900">{c.fullName}</span>
                    <span className="block text-xs text-gray-500">
                      Ghế {c.registration!.seatNo} · {fmtDate(c.dob)}
                    </span>
                  </span>
                  <select className="rounded-input border border-gray-300 px-2 py-1.5 text-[13px]" value={v.result} onChange={(e) => set({ result: e.target.value as EnglishResult, score: e.target.value === "ABSENT" ? "" : v.score })} aria-label={`Kết quả của ${c.fullName}`}>
                    {(Object.keys(RESULT_LABEL) as EnglishResult[]).map((r) => (
                      <option key={r} value={r}>
                        {RESULT_LABEL[r]}
                      </option>
                    ))}
                  </select>
                  <input className="rounded-input border border-gray-300 px-2 py-1.5 text-[13px]" inputMode="decimal" placeholder="Điểm" disabled={v.result === "ABSENT"} value={v.score} onChange={(e) => set({ score: e.target.value.replace(/[^\d.,]/g, "") })} aria-label={`Điểm của ${c.fullName}`} />
                  <input className="rounded-input border border-gray-300 px-2 py-1.5 text-[13px]" placeholder="Ghi chú" maxLength={500} value={v.note} onChange={(e) => set({ note: e.target.value })} aria-label={`Ghi chú cho ${c.fullName}`} />
                </div>
              );
            })}
            {formError && <ErrorBox message={formError} />}
          </div>
        )}
      </Modal>
    </>
  );
}

export default function EnglishTestPage() {
  return (
    <RequirePermission perm="exam:manage">
      <Inner />
    </RequirePermission>
  );
}
