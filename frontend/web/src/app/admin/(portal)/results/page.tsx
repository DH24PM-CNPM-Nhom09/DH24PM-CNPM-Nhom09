"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { RequirePermission, useAdmin } from "@/components/admin/AdminShell";
import { MajorPicker, MajorProgress, STAGE_LABEL, STAGE_TONE } from "@/components/admin/MajorPicker";
import { Btn, EmptyState, ErrorBox, fieldCls, Label, Modal, Notice, PageHeader, Panel, Skeleton, Tag, useToast } from "@/components/admin/ui";
import { approveResults, getResults, proposeResults, rankResults, returnResults, type AdmissionResult, type ResultsOverview, type ScoringMajor } from "@/lib/admin/api";
import { errorMessage, fmtDateTime } from "@/lib/admin/format";
import { useAsync } from "@/lib/admin/useAsync";

const RESULT_TONE: Record<AdmissionResult, "green" | "amber" | "gray"> = { TRUNG_TUYEN: "green", DU_BI: "amber", KHONG_TRUNG_TUYEN: "gray" };
const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "—" : String(Math.round(n * 100) / 100).replace(".", ","));

function Stat({ label, value, tone = "text-gray-900" }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-card border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-0.5 text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

/** Ba bước duyệt kết quả, đánh dấu bước hiện tại */
function Steps({ d }: { d: ResultsOverview }) {
  const steps = [
    { label: "Hội đồng xếp hạng theo điểm chuẩn", done: d.stage !== "NOT_RANKED", who: d.benchmarkDecidedBy },
    { label: "Hội đồng thông qua (cấp 1)", done: d.stage === "PROPOSED" || d.stage === "PUBLISHED", who: d.proposedBy },
    { label: "Lãnh đạo phê duyệt & công bố (cấp 2)", done: d.stage === "PUBLISHED", who: d.approvedBy },
  ];
  return (
    <ol className="grid gap-2 md:grid-cols-3">
      {steps.map((s, i) => (
        <li key={i} className={`rounded-card border px-4 py-3 ${s.done ? "border-[#BBE3C8] bg-[#F3FBF5]" : "border-gray-200 bg-white"}`}>
          <p className="text-xs font-semibold text-gray-500">Bước {i + 1}</p>
          <p className={`text-sm font-semibold ${s.done ? "text-[#166534]" : "text-gray-800"}`}>
            {s.done ? "✓ " : ""}
            {s.label}
          </p>
          {s.done && s.who && <p className="text-xs text-gray-500">{s.who}</p>}
        </li>
      ))}
    </ol>
  );
}

function MajorResults({ bm }: { bm: ScoringMajor }) {
  const { can, staff } = useAdmin();
  const toast = useToast();
  const r = useAsync(() => getResults(bm.batchMajorId), [bm.batchMajorId]);
  const d = r.data;
  const [benchmark, setBenchmark] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState<"propose" | "approve" | "return" | null>(null);
  const [note, setNote] = useState("");

  if (r.error) return <ErrorBox message={r.error} onRetry={() => r.reload()} />;
  if (!d) return <Skeleton className="h-72" />;
  const canPropose = can("result:propose");
  const canApprove = can("result:approve");
  const bmValue = benchmark ?? (d.benchmark !== null ? String(d.benchmark).replace(".", ",") : "");
  const editable = d.stage === "NOT_RANKED" || d.stage === "DRAFT";

  async function act(kind: string, fn: () => Promise<unknown>, okMsg: string) {
    setBusy(kind);
    setErr("");
    try {
      await fn();
      toast(okMsg);
      setConfirm(null);
      setBenchmark(null);
    } catch (e) {
      setErr(errorMessage(e));
      setConfirm(null);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{d.major.majorName}</h2>
          <p className="text-[13px] text-gray-500">
            {d.batch.batchName} · chỉ tiêu {d.major.quota} · {d.subjects.map((s) => `${s.subjectName} ×${s.weight}`).join(" + ")}
          </p>
        </div>
        <Tag tone={STAGE_TONE[d.stage]}>{STAGE_LABEL[d.stage]}</Tag>
      </div>

      <Steps d={d} />

      {d.returnNote && d.stage === "DRAFT" && (
        <Notice>
          <b>Lãnh đạo trả lại:</b> {d.returnNote}
        </Notice>
      )}
      {d.blockers.length > 0 && d.stage !== "PUBLISHED" && (
        <Notice>
          <b>Chưa xếp hạng được:</b>
          <ul className="ml-4 mt-1 list-disc">
            {d.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <span className="mt-1 block">
            Xem tiến độ ở{" "}
            <Link href={`/admin/scoring?bm=${d.major.batchMajorId}`} className="font-semibold underline">
              Tổ chức xét tuyển
            </Link>
            .
          </span>
        </Notice>
      )}
      {err && <ErrorBox message={err} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Điểm chuẩn" value={d.benchmark === null ? "—" : fmt(d.benchmark)} />
        <Stat label="Chỉ tiêu" value={d.major.quota} />
        <Stat label="Trúng tuyển" value={d.stats.admitted} tone="text-[#166534]" />
        <Stat label="Dự bị" value={d.stats.waitlisted} tone="text-[#92400E]" />
        <Stat label="Không trúng tuyển" value={d.stats.rejected} />
      </div>

      {canPropose && editable && (
        <Panel title="Điểm chuẩn và xếp hạng">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="w-40">
              <Label htmlFor="rs-bm" required>
                Điểm chuẩn (thang 10)
              </Label>
              <input id="rs-bm" className={`${fieldCls} tabular-nums`} inputMode="decimal" value={bmValue} placeholder="Ví dụ 5,0" onChange={(e) => setBenchmark(e.target.value.replace(/[^\d.,]/g, ""))} />
            </div>
            <Btn
              variant="navy"
              loading={busy === "rank"}
              disabled={!bmValue || d.blockers.length > 0}
              onClick={() => act("rank", () => rankResults(d.major.batchMajorId, Number(bmValue.replace(",", "."))), "Đã xếp hạng. Kiểm tra danh sách rồi bấm “Hội đồng thông qua”.")}
            >
              {d.stage === "NOT_RANKED" ? "Xếp hạng" : "Xếp hạng lại"}
            </Btn>
            <p className="text-xs text-gray-500 md:max-w-md">
              Đạt điểm chuẩn và trong chỉ tiêu → trúng tuyển; đạt điểm chuẩn ngoài chỉ tiêu → dự bị theo thứ tự; vắng mặt hoặc dưới điểm chuẩn → không trúng tuyển. Đồng điểm: ưu tiên điểm hình thức có hệ số lớn nhất, rồi nộp hồ sơ sớm hơn.
            </p>
          </div>
        </Panel>
      )}

      <Panel
        title="Danh sách xếp hạng"
        bodyClass=""
        action={
          <div className="flex flex-wrap gap-2">
            {canPropose && d.stage === "DRAFT" && (
              <Btn size="sm" variant="navy" onClick={() => setConfirm("propose")}>
                Hội đồng thông qua
              </Btn>
            )}
            {canApprove && d.stage === "PROPOSED" && (
              <>
                <Btn size="sm" variant="danger" onClick={() => (setNote(""), setConfirm("return"))}>
                  Trả lại
                </Btn>
                <Btn size="sm" variant="success" disabled={d.proposedBy === staff.fullName} title={d.proposedBy === staff.fullName ? "Người thông qua cấp 1 không phê duyệt cấp 2" : undefined} onClick={() => setConfirm("approve")}>
                  Phê duyệt &amp; công bố
                </Btn>
              </>
            )}
          </div>
        }
      >
        {d.rows.length === 0 ? (
          <EmptyState title="Chưa có thí sinh">Ngành này chưa có hồ sơ đạt thẩm định.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500">
                <tr>
                  <th className="px-4 py-2.5 text-right">Hạng</th>
                  <th className="px-4 py-2.5">Thí sinh</th>
                  {d.subjects.map((s) => (
                    <th key={s.subjectId} className="px-3 py-2.5 text-right">
                      {s.subjectName}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-right">Tổng</th>
                  <th className="px-4 py-2.5">Kết quả</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {d.rows.map((x) => (
                  <tr key={x.applicationId} className={x.result === "TRUNG_TUYEN" ? "bg-[#F7FCF8]" : ""}>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{x.rank ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/applications/${x.applicationId}`} className="font-semibold text-gray-900 hover:text-accent hover:underline">
                        {x.fullName}
                      </Link>
                      <span className="block font-mono text-xs text-gray-500">{x.applicationCode}</span>
                    </td>
                    {d.subjects.map((s) => (
                      <td key={s.subjectId} className="px-3 py-2.5 text-right tabular-nums">
                        {x.scores[s.subjectId] === null && x.absent ? <Tag tone="red">Vắng</Tag> : fmt(x.scores[s.subjectId])}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-right text-base font-bold tabular-nums">{fmt(x.total)}</td>
                    <td className="px-4 py-2.5">
                      {x.result ? (
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Tag tone={RESULT_TONE[x.result]}>
                            {x.resultLabel}
                            {x.result === "DU_BI" && x.waitlist ? ` #${x.waitlist.rank}` : ""}
                          </Tag>
                          {x.waitlist?.status === "PROMOTED" && <Tag tone="green">Đã gọi trúng tuyển</Tag>}
                          {x.cancelled && <Tag tone="gray">Không nhập học</Tag>}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Chưa xếp hạng</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {d.publishedAt && (
          <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">
            Công bố {fmtDateTime(d.publishedAt)} — hội đồng: {d.proposedBy}, lãnh đạo: {d.approvedBy}. Bước tiếp theo:{" "}
            <Link href="/admin/decisions" className="font-semibold text-accent hover:underline">
              lập quyết định trúng tuyển
            </Link>
            .
          </p>
        )}
      </Panel>

      <Modal
        open={confirm === "propose"}
        onClose={() => setConfirm(null)}
        title="Hội đồng thông qua kết quả?"
        description={`Điểm chuẩn ${fmt(d.benchmark)}: ${d.stats.admitted} trúng tuyển, ${d.stats.waitlisted} dự bị, ${d.stats.rejected} không trúng tuyển. Kết quả được trình lãnh đạo phê duyệt; thí sinh chưa thấy cho tới khi công bố.`}
        footer={
          <>
            <Btn onClick={() => setConfirm(null)}>Hủy</Btn>
            <Btn variant="navy" loading={busy === "propose"} onClick={() => act("propose", () => proposeResults(d.major.batchMajorId), "Đã thông qua và trình lãnh đạo phê duyệt.")}>
              Thông qua
            </Btn>
          </>
        }
      >
        <p className="text-sm text-gray-600">Sau khi thông qua, muốn sửa phải chờ lãnh đạo trả lại.</p>
      </Modal>
      <Modal
        open={confirm === "approve"}
        onClose={() => setConfirm(null)}
        title="Phê duyệt và công bố kết quả?"
        description={`${d.rows.length} thí sinh ngành ${d.major.majorName} nhận kết quả qua thông báo và email ngay khi bấm. Không thể xếp hạng lại sau khi công bố.`}
        footer={
          <>
            <Btn onClick={() => setConfirm(null)}>Hủy</Btn>
            <Btn variant="success" loading={busy === "approve"} onClick={() => act("approve", () => approveResults(d.major.batchMajorId), "Đã phê duyệt và công bố kết quả.")}>
              Phê duyệt &amp; công bố
            </Btn>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Trúng tuyển {d.stats.admitted}, dự bị {d.stats.waitlisted}, không trúng tuyển {d.stats.rejected}.
        </p>
      </Modal>
      <Modal
        open={confirm === "return"}
        onClose={() => setConfirm(null)}
        title="Trả lại kết quả cho hội đồng"
        footer={
          <>
            <Btn onClick={() => setConfirm(null)}>Hủy</Btn>
            <Btn variant="danger" loading={busy === "return"} disabled={note.trim().length < 10} onClick={() => act("return", () => returnResults(d.major.batchMajorId, note), "Đã trả lại kết quả cho hội đồng.")}>
              Trả lại
            </Btn>
          </>
        }
      >
        <Label htmlFor="rs-note" required>
          Lý do trả lại
        </Label>
        <textarea id="rs-note" rows={3} className={fieldCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: Đề nghị rà soát lại thứ tự hai thí sinh đồng điểm." />
      </Modal>
    </div>
  );
}

function Inner() {
  return (
    <>
      <PageHeader title="Xét trúng tuyển" description="Hội đồng định điểm chuẩn và xếp hạng theo chỉ tiêu, thông qua kết quả; lãnh đạo phê duyệt và công bố. Chỉ xếp hạng khi đợt ở trạng thái “Xét kết quả”, đã hết hạn và xử lý xong phúc khảo." />
      <MajorPicker summary={(m) => <MajorProgress m={m} />}>{(bm) => <MajorResults key={bm.batchMajorId} bm={bm} />}</MajorPicker>
    </>
  );
}

export default function ResultsPage() {
  return (
    <RequirePermission perm="result:view">
      <Suspense fallback={null}>
        <Inner />
      </Suspense>
    </RequirePermission>
  );
}
