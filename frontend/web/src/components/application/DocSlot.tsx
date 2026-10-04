"use client";

import { useRef } from "react";
import Badge from "@/components/ui/Badge";
import { checkFile, DOC_HINT, DOC_LABEL, fmtSize, VERIFY_LABEL } from "@/lib/application";
import type { ApplicationDocument, DocumentType } from "@/lib/types";

/**
 * Một ô minh chứng theo loại giấy tờ: danh sách tệp đã tải + nút chọn tệp.
 * Dùng ở bước "Minh chứng" khi tạo hồ sơ và khi nộp bổ sung.
 */
export default function DocSlot({
  type,
  required,
  docs,
  busy,
  error,
  canDelete,
  showVerify,
  uploadLabel,
  onUpload,
  onDelete,
  onError,
}: {
  type: DocumentType;
  required?: boolean;
  docs: ApplicationDocument[];
  busy?: boolean;
  error?: string;
  canDelete?: boolean;
  /** Hiện kết quả kiểm tra của cán bộ (sau khi đã nộp) */
  showVerify?: boolean;
  uploadLabel?: string;
  onUpload: (file: File) => void;
  onDelete?: (doc: ApplicationDocument) => void;
  onError: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  // Sau khi nộp: tệp bị đánh dấu không hợp lệ chưa tính là "đã có"
  const done = docs.some((d) => !showVerify || d.verifyStatus !== "INVALID");
  const inputId = `doc-${type}`;

  return (
    <div className={`rounded-input border px-4 py-3.5 ${error ? "border-danger" : done ? "border-gray-200" : "border-dashed border-gray-300"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-gray-900">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${done ? "bg-success text-white" : "border-2 border-gray-300 text-transparent"}`}
              aria-hidden="true"
            >
              ✓
            </span>
            {DOC_LABEL[type]}
            {required ? <span className="text-xs font-semibold text-danger">Bắt buộc</span> : <span className="text-xs font-medium text-gray-400">Không bắt buộc</span>}
          </p>
          <p className="mt-1 pl-7 text-xs text-gray-500">{DOC_HINT[type]}</p>
        </div>
        <label
          htmlFor={inputId}
          className={`inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-input border-[1.5px] border-accent bg-white px-4 py-2 text-[13px] font-bold text-accent transition-colors hover:bg-accent-50 ${busy ? "pointer-events-none opacity-60" : ""}`}
        >
          {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />}
          {busy ? "Đang tải lên…" : uploadLabel ?? (done ? "Thêm tệp" : "Chọn tệp")}
        </label>
        <input
          ref={input}
          id={inputId}
          type="file"
          className="sr-only"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          disabled={busy}
          aria-label={`Tải ${DOC_LABEL[type]}`}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            const problem = checkFile(f);
            if (problem) return onError(problem);
            onUpload(f);
          }}
        />
      </div>

      {docs.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2 pl-7">
          {docs.map((d) => (
            <li key={d.documentId} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-input bg-gray-50 px-3 py-2 text-[13px]">
              <span className="min-w-0 flex-1 truncate font-medium text-gray-800" title={d.fileName}>
                {d.fileName}
              </span>
              <span className="text-xs text-gray-400">{fmtSize(d.fileSizeKb)}</span>
              {showVerify && <Badge tone={VERIFY_LABEL[d.verifyStatus].tone}>{VERIFY_LABEL[d.verifyStatus].text}</Badge>}
              {canDelete && onDelete && (
                <button type="button" onClick={() => onDelete(d)} className="text-xs font-semibold text-gray-500 hover:text-danger" aria-label={`Xóa ${d.fileName}`}>
                  Xóa
                </button>
              )}
              {showVerify && d.verifyStatus === "INVALID" && d.verifyNote && <p className="w-full text-xs font-medium text-danger">Lý do: {d.verifyNote}</p>}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-2 pl-7 text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}
