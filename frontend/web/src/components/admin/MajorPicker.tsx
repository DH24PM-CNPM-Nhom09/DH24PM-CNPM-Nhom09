"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EmptyState, ErrorBox, fieldCls, Skeleton, Tag } from "./ui";
import { listScoringBatches, type ResultStage, type ScoringBatch, type ScoringMajor } from "@/lib/admin/api";
import { DEGREE_LABEL, fmtDateTime } from "@/lib/admin/format";
import { useAsync } from "@/lib/admin/useAsync";

export const STAGE_LABEL: Record<ResultStage, string> = {
  NOT_RANKED: "Chưa xếp hạng",
  DRAFT: "Đã xếp hạng (nháp)",
  PROPOSED: "Chờ lãnh đạo duyệt",
  PUBLISHED: "Đã công bố kết quả",
};
export const STAGE_TONE: Record<ResultStage, "gray" | "blue" | "amber" | "green"> = { NOT_RANKED: "gray", DRAFT: "blue", PROPOSED: "amber", PUBLISHED: "green" };

const BATCH_STATUS: Record<string, string> = { OPEN: "Đang nhận hồ sơ", CLOSED: "Đã đóng đăng ký", IN_REVIEW: "Đang xét kết quả", COMPLETED: "Hoàn tất" };

/**
 * Chọn đợt tuyển sinh → ngành. Ngành đang chọn lưu trên địa chỉ (?bm=) để tải lại trang
 * hoặc gửi đường dẫn cho đồng nghiệp vẫn mở đúng chỗ.
 */
export function MajorPicker({ children, summary }: { children: (bm: ScoringMajor, batch: ScoringBatch) => ReactNode; summary: (m: ScoringMajor) => ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const batches = useAsync(() => listScoringBatches(), []);
  const bmParam = Number(sp.get("bm")) || null;
  const [batchId, setBatchId] = useState<number | null>(null);

  useEffect(() => {
    if (!batches.data?.length || batchId !== null) return;
    const fromBm = bmParam ? batches.data.find((b) => b.majors.some((m) => m.batchMajorId === bmParam)) : null;
    setBatchId((fromBm ?? batches.data.find((b) => b.status === "IN_REVIEW" || b.status === "CLOSED") ?? batches.data[0]).batchId);
  }, [batches.data, batchId, bmParam]);

  const batch = useMemo(() => batches.data?.find((b) => b.batchId === batchId) ?? null, [batches.data, batchId]);
  const major = batch?.majors.find((m) => m.batchMajorId === bmParam) ?? null;

  const pick = (bm: number | null) => router.replace(bm ? `${pathname}?bm=${bm}` : pathname, { scroll: false });

  if (batches.error) return <ErrorBox message={batches.error} onRetry={() => batches.reload()} />;
  if (!batches.data) return <Skeleton className="h-40" />;
  if (!batches.data.length) return <EmptyState title="Chưa có đợt tuyển sinh nào đã mở">Xét tuyển bắt đầu sau khi đợt mở nhận hồ sơ.</EmptyState>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-card border border-gray-200 bg-white p-4 md:flex-row md:items-center">
        <label htmlFor="mp-batch" className="text-[13px] font-semibold text-gray-700">
          Đợt tuyển sinh
        </label>
        <select
          id="mp-batch"
          className={`${fieldCls} md:max-w-md`}
          value={batchId ?? ""}
          onChange={(e) => {
            setBatchId(Number(e.target.value));
            pick(null);
          }}
        >
          {batches.data.map((b) => (
            <option key={b.batchId} value={b.batchId}>
              {b.batchCode} — {b.batchName} ({BATCH_STATUS[b.status] ?? b.status})
            </option>
          ))}
        </select>
        {batch && <span className="text-[13px] text-gray-500">{DEGREE_LABEL[batch.degreeLevel]} · {batch.majors.length} ngành</span>}
      </div>

      {batch && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="list" aria-label="Ngành trong đợt">
          {batch.majors.map((m) => {
            const active = m.batchMajorId === bmParam;
            return (
              <button
                key={m.batchMajorId}
                type="button"
                role="listitem"
                aria-current={active ? "true" : undefined}
                onClick={() => pick(active ? null : m.batchMajorId)}
                className={`rounded-card border bg-white p-4 text-left transition-colors ${active ? "border-navy-800 ring-2 ring-navy-800/15" : "border-gray-200 hover:border-gray-300"}`}
              >
                <p className="font-semibold text-gray-900">{m.majorName}</p>
                <p className="text-xs text-gray-500">
                  <span className="font-mono">{m.majorCode}</span> · chỉ tiêu {m.quota} · {m.eligible} hồ sơ đạt thẩm định
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">{summary(m)}</div>
              </button>
            );
          })}
        </div>
      )}

      {batch && !major && <p className="text-center text-sm text-gray-500">Chọn một ngành ở trên để làm việc.</p>}
      {batch && major && children(major, batch)}
    </div>
  );
}

/** Nhãn tiến độ dùng chung trên thẻ ngành */
export function MajorProgress({ m }: { m: ScoringMajor }) {
  return (
    <>
      {m.pendingReview > 0 && <Tag tone="amber">{m.pendingReview} hồ sơ chưa thẩm định xong</Tag>}
      {m.scoresPublishedAt ? (
        <Tag tone={m.appealDeadline && new Date(m.appealDeadline).getTime() > Date.now() ? "blue" : "navy"}>
          {m.appealDeadline && new Date(m.appealDeadline).getTime() > Date.now() ? `Đã công bố điểm · phúc khảo đến ${fmtDateTime(m.appealDeadline)}` : "Đã công bố điểm"}
        </Tag>
      ) : (
        <Tag tone="gray">Chưa công bố điểm</Tag>
      )}
      <Tag tone={STAGE_TONE[m.resultStage]}>{STAGE_LABEL[m.resultStage]}</Tag>
    </>
  );
}
