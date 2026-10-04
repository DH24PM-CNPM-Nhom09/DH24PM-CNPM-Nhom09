"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RequirePermission, useAdmin } from "@/components/admin/AdminShell";
import { Btn, EmptyState, ErrorBox, fieldCls, Label, LoadingRows, Modal, PageHeader, Pagination, Tag, useToast } from "@/components/admin/ui";
import { acceptComplaint, listComplaints, respondComplaint, type ComplaintItem, type ComplaintStatus } from "@/lib/admin/api";
import { errorMessage, fmtDateTime, relativeDays } from "@/lib/admin/format";
import { useAsync } from "@/lib/admin/useAsync";

const STATUS_LABEL: Record<ComplaintStatus, string> = { PENDING: "Mới gửi", IN_PROGRESS: "Đang xử lý", RESOLVED: "Đã giải quyết", REJECTED: "Không chấp nhận" };
const STATUS_TONE: Record<ComplaintStatus, "amber" | "blue" | "green" | "gray"> = { PENDING: "amber", IN_PROGRESS: "blue", RESOLVED: "green", REJECTED: "gray" };
const TYPES: [string, string][] = [
  ["", "Tất cả loại"],
  ["KHIEU_NAI_KET_QUA", "Khiếu nại kết quả xét tuyển"],
  ["KHIEU_NAI_HO_SO", "Khiếu nại xử lý hồ sơ"],
  ["PHUC_KHAO_DIEM", "Phúc khảo kết quả thi tiếng Anh"],
  ["KHAC", "Khác"],
];

function Inner() {
  const { can } = useAdmin();
  const toast = useToast();
  const canHandle = can("complaint:handle");
  const [tab, setTab] = useState<"OPEN" | "RESOLVED" | "REJECTED" | "">("OPEN");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [tab, type, q]);
  const { data, error, loading, reload } = useAsync(() => listComplaints({ status: tab, type, search: q, page }), [tab, type, q, page]);

  const [target, setTarget] = useState<ComplaintItem | null>(null);
  const [result, setResult] = useState<"RESOLVED" | "REJECTED">("RESOLVED");
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  async function accept(c: ComplaintItem) {
    setBusy(`acc${c.complaintId}`);
    try {
      await acceptComplaint(c.complaintId);
      toast(`Đã tiếp nhận khiếu nại của ${c.candidate.fullName} và báo cho thí sinh.`);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(null);
    }
  }
  async function submit() {
    if (!target) return;
    setBusy("respond");
    setErr("");
    try {
      await respondComplaint(target.complaintId, result, response);
      toast("Đã gửi câu trả lời cho thí sinh (thông báo + email).");
      setTarget(null);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const c = data?.counts;
  return (
    <>
      <PageHeader title="Khiếu nại của thí sinh" description="Khiếu nại về kết quả xét tuyển, xử lý hồ sơ, kết quả thi tiếng Anh và các vấn đề khác. Tiếp nhận để báo thí sinh đơn đang được xử lý, rồi trả lời bằng văn bản — thí sinh nhận qua cổng và email." />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Lọc theo trạng thái">
          {(
            [
              ["OPEN", `Cần xử lý (${(c?.PENDING ?? 0) + (c?.IN_PROGRESS ?? 0)})`],
              ["RESOLVED", `Đã giải quyết (${c?.RESOLVED ?? 0})`],
              ["REJECTED", `Không chấp nhận (${c?.REJECTED ?? 0})`],
              ["", "Tất cả"],
            ] as const
          ).map(([k, label]) => (
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
        <div className="flex flex-col gap-2 sm:flex-row">
          <select className={`${fieldCls} sm:w-60`} value={type} onChange={(e) => setType(e.target.value)} aria-label="Loại khiếu nại">
            {TYPES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <input className={`${fieldCls} sm:w-72`} placeholder="Tìm tên, email, mã hồ sơ, nội dung" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Tìm khiếu nại" />
        </div>
      </div>

      {error && <ErrorBox message={error} onRetry={() => reload()} />}
      <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
        {loading && !data ? (
          <LoadingRows rows={4} />
        ) : !data?.items.length ? (
          <EmptyState title={tab === "OPEN" ? "Không còn khiếu nại cần xử lý" : "Không có khiếu nại nào"} />
        ) : (
          <ul className="divide-y divide-gray-100">
            {data.items.map((x) => (
              <li key={x.complaintId} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-gray-900">{x.candidate.fullName}</span>
                    <Tag tone={STATUS_TONE[x.status]}>{STATUS_LABEL[x.status]}</Tag>
                    <span className="text-xs font-semibold text-gray-500">{x.typeLabel}</span>
                  </div>
                  <p className="mt-0.5 text-[13px] text-gray-500">
                    {x.candidate.email}
                    {x.candidate.phone ? ` · ${x.candidate.phone}` : ""}
                    {x.application && (
                      <>
                        {" · "}
                        <Link href={`/admin/applications/${x.application.applicationId}`} className="font-mono text-navy-800 hover:underline">
                          {x.application.applicationCode}
                        </Link>{" "}
                        ({x.application.majorName})
                      </>
                    )}
                  </p>
                  <blockquote className="mt-2 max-w-[80ch] whitespace-pre-line border-l-2 border-gray-200 pl-3 text-sm text-gray-700">{x.content}</blockquote>
                  <p className="mt-2 text-xs text-gray-400">
                    Gửi {fmtDateTime(x.createdAt)} ({relativeDays(x.createdAt)}){x.handledBy && x.status === "IN_PROGRESS" ? ` · ${x.handledBy} đang xử lý` : ""}
                  </p>
                  {x.response && (
                    <div className="mt-2 rounded-input bg-gray-50 px-3 py-2 text-[13px] text-gray-700">
                      <span className="font-semibold">Trả lời:</span> <span className="whitespace-pre-line">{x.response}</span>
                      <span className="block text-xs text-gray-400">
                        {x.handledBy}, {fmtDateTime(x.resolvedAt)}
                      </span>
                    </div>
                  )}
                </div>
                {canHandle && (x.status === "PENDING" || x.status === "IN_PROGRESS") && (
                  <div className="flex shrink-0 flex-wrap items-start gap-2 md:flex-col md:items-end">
                    {x.status === "PENDING" && (
                      <Btn size="sm" loading={busy === `acc${x.complaintId}`} onClick={() => accept(x)}>
                        Tiếp nhận
                      </Btn>
                    )}
                    <Btn size="sm" variant="navy" onClick={() => (setErr(""), setResult("RESOLVED"), setResponse(""), setTarget(x))}>
                      Trả lời
                    </Btn>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {data && data.total > data.pageSize && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} unit="khiếu nại" />}

      <Modal
        open={!!target}
        onClose={() => setTarget(null)}
        title={target ? `Trả lời khiếu nại — ${target.candidate.fullName}` : ""}
        description={target?.typeLabel}
        width="max-w-2xl"
        footer={
          <>
            <Btn onClick={() => setTarget(null)}>Hủy</Btn>
            <Btn variant="navy" loading={busy === "respond"} disabled={response.trim().length < 20} onClick={submit}>
              Gửi trả lời
            </Btn>
          </>
        }
      >
        {target && <blockquote className="mb-4 max-h-40 overflow-auto whitespace-pre-line border-l-2 border-gray-200 pl-3 text-sm text-gray-600">{target.content}</blockquote>}
        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold text-gray-700">Kết quả</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["RESOLVED", "Đã giải quyết / chấp nhận"],
                ["REJECTED", "Không chấp nhận"],
              ] as const
            ).map(([v, label]) => (
              <label key={v} className={`flex cursor-pointer items-center gap-2.5 rounded-input border px-3.5 py-3 text-sm font-medium ${result === v ? "border-navy-800 bg-navy-50 text-navy-900" : "border-gray-200 text-gray-700"}`}>
                <input type="radio" name="cp-result" className="accent-[#1B3A66]" checked={result === v} onChange={() => setResult(v)} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-4">
          <Label htmlFor="cp-response" required>
            Nội dung trả lời
          </Label>
          <textarea id="cp-response" rows={5} className={fieldCls} value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Nêu rõ kết quả kiểm tra, căn cứ và hướng xử lý tiếp theo (nếu có)." />
          <p className="mt-1 text-xs text-gray-400">Tối thiểu 20 ký tự. Thí sinh nhận nguyên văn nội dung này.</p>
        </div>
        {err && (
          <div className="mt-3">
            <ErrorBox message={err} />
          </div>
        )}
      </Modal>
    </>
  );
}

export default function ComplaintsPage() {
  return (
    <RequirePermission perm="complaint:view">
      <Inner />
    </RequirePermission>
  );
}
