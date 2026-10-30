"use client";

import { useState } from "react";
import { exportConditionsPdf, exportConditionsXlsx, type ConditionsDoc } from "@/lib/admission-conditions-export";

/**
 * Hai nút "Tải PDF" / "Tải Excel" điều kiện tuyển sinh của một đợt.
 * tone="admin": nút viền xám theo cổng quản lý; tone="public": nút nhỏ theo cổng thí sinh.
 */
export default function ExportConditionsButtons({ doc, tone = "admin", label = "Điều kiện tuyển sinh" }: { doc: ConditionsDoc; tone?: "admin" | "public"; label?: string }) {
  const [busy, setBusy] = useState<"pdf" | "xlsx" | null>(null);
  const [err, setErr] = useState("");

  async function run(kind: "pdf" | "xlsx") {
    setBusy(kind);
    setErr("");
    try {
      if (kind === "pdf") await exportConditionsPdf(doc);
      else await exportConditionsXlsx(doc);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Không tạo được tệp, vui lòng thử lại.");
    } finally {
      setBusy(null);
    }
  }

  const cls =
    tone === "admin"
      ? "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-input border border-gray-300 bg-white px-3 text-[13px] font-semibold text-gray-700 hover:border-gray-400 hover:bg-gray-50 disabled:opacity-60"
      : "inline-flex items-center gap-1.5 whitespace-nowrap rounded-input border border-navy-800/20 bg-white px-3 py-1.5 text-xs font-bold text-navy-800 hover:bg-navy-50 disabled:opacity-60";
  const spin = <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2" role="group" aria-label={`Tải ${label.toLowerCase()}`}>
        {tone === "admin" && <span className="text-[13px] text-gray-500">{label}:</span>}
        <button type="button" className={cls} disabled={!!busy} onClick={() => run("pdf")} title={`Tải ${label.toLowerCase()} dạng PDF`}>
          {busy === "pdf" ? spin : <span aria-hidden="true">⬇</span>} {tone === "public" ? "Điều kiện (PDF)" : "PDF"}
        </button>
        <button type="button" className={cls} disabled={!!busy} onClick={() => run("xlsx")} title={`Tải ${label.toLowerCase()} dạng Excel`}>
          {busy === "xlsx" ? spin : <span aria-hidden="true">⬇</span>} Excel
        </button>
      </div>
      {err && (
        <p className="text-xs font-medium text-[#B91C1C]" role="alert">
          {err}
        </p>
      )}
    </div>
  );
}
