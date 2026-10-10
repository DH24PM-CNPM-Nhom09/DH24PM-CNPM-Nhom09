"use client";

import { useRef, useState } from "react";
import { ID_ISSUE_PLACES, OTHER_PLACE, type DeclForm } from "@/components/application/DeclarationForm";
import { foldVi, type IdCardFields } from "@/lib/idcard-parse";
import type { Candidate } from "@/lib/types";

type Applicable = "idNumber" | "idIssueDate" | "idIssuePlace" | "birthplace" | "permanentAddress";

const FIELD_LABEL: Record<Applicable, string> = {
  idNumber: "Số CC/CCCD",
  idIssueDate: "Ngày cấp",
  idIssuePlace: "Nơi cấp",
  birthplace: "Nơi sinh",
  permanentAddress: "Nơi thường trú",
};
const ORDER: Applicable[] = ["idNumber", "idIssueDate", "idIssuePlace", "birthplace", "permanentAddress"];

const vnDate = (iso?: string) => (iso ? iso.split("-").reverse().join("/") : "");

function currentValue(d: DeclForm, k: Applicable) {
  if (k === "idIssuePlace") return d.idIssuePlaceChoice === OTHER_PLACE ? d.idIssuePlaceOther : d.idIssuePlaceChoice;
  return d[k];
}

/** Gộp kết quả nhiều ảnh: ảnh sau chỉ bổ sung trường còn thiếu (QR luôn được ưu tiên vì đọc chính xác) */
function merge(a: IdCardFields, b: IdCardFields, bIsQr: boolean): IdCardFields {
  const out: IdCardFields = { ...a };
  for (const [k, v] of Object.entries(b) as [keyof IdCardFields, string][]) {
    if (!v) continue;
    if (bIsQr || !out[k]) (out as Record<string, string>)[k] = v;
  }
  return out;
}

/**
 * Yêu cầu 1 — "Trích xuất tự động số ID / CCCD bằng AI":
 * thí sinh chọn ảnh chụp CCCD (mặt trước có mã QR, mặt sau có nơi cấp), hệ thống đọc ngay
 * trên máy (đọc mã QR, không có thì nhận dạng chữ tiếng Việt), hiện kết quả để thí sinh
 * kiểm tra rồi mới điền vào biểu mẫu. Ảnh không được gửi lên máy chủ.
 */
export default function IdCardAutoFill({
  value,
  profile,
  onApply,
  disabled,
}: {
  value: DeclForm;
  profile: Candidate;
  onApply: (v: DeclForm) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [fields, setFields] = useState<IdCardFields | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [applied, setApplied] = useState(false);

  async function handleFiles(list: FileList | null) {
    const files = Array.from(list ?? []).slice(0, 3);
    if (!files.length) return;
    setBusy(true);
    setError("");
    setApplied(false);
    try {
      const { readIdCard } = await import("@/lib/idcard-reader");
      let acc: IdCardFields = fields ?? {};
      const src = [...sources];
      for (const [i, f] of files.entries()) {
        if (f.size > 10 * 1024 * 1024) throw new Error(`Tệp "${f.name}" lớn hơn 10MB.`);
        const prefix = files.length > 1 ? `Ảnh ${i + 1}/${files.length}: ` : "";
        const r = await readIdCard(f, (m) => setProgress(prefix + m));
        acc = merge(acc, r.fields, r.source === "QR");
        src.push(`${f.name} — ${r.source === "QR" ? "đọc mã QR" : "nhận dạng chữ"}`);
      }
      setFields(acc);
      setSources(src);
      if (!ORDER.some((k) => acc[k])) setError("Chưa đọc được thông tin nào. Thử ảnh rõ hơn: chụp thẳng, đủ sáng, không lóa, thẻ chiếm gần hết khung hình.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đọc được ảnh.");
    } finally {
      setBusy(false);
      setProgress("");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function apply() {
    if (!fields) return;
    const next: DeclForm = { ...value };
    if (fields.idNumber) next.idNumber = fields.idNumber;
    if (fields.idIssueDate) next.idIssueDate = fields.idIssueDate;
    if (fields.idIssuePlace) {
      const known = ID_ISSUE_PLACES.includes(fields.idIssuePlace);
      next.idIssuePlaceChoice = known ? fields.idIssuePlace : OTHER_PLACE;
      next.idIssuePlaceOther = known ? "" : fields.idIssuePlace;
    }
    if (fields.birthplace) next.birthplace = fields.birthplace;
    if (fields.permanentAddress) {
      next.permanentAddress = fields.permanentAddress;
      if (next.sameAddress) next.address = fields.permanentAddress;
    }
    onApply(next);
    setApplied(true);
  }

  function reset() {
    setFields(null);
    setSources([]);
    setError("");
    setApplied(false);
  }

  // Cảnh báo khi thông tin trên thẻ khác hồ sơ cá nhân (có thể chọn nhầm ảnh người khác)
  const warnings: string[] = [];
  if (fields?.fullName && profile.fullName && foldVi(fields.fullName) !== foldVi(profile.fullName))
    warnings.push(`Họ tên trên thẻ "${fields.fullName}" khác họ tên trong hồ sơ "${profile.fullName}".`);
  if (fields?.dob && profile.dob && fields.dob !== profile.dob) warnings.push(`Ngày sinh trên thẻ ${vnDate(fields.dob)} khác ngày sinh trong hồ sơ ${vnDate(profile.dob)}.`);
  if (fields?.gender && profile.gender && fields.gender !== profile.gender) warnings.push("Giới tính trên thẻ khác giới tính trong hồ sơ.");

  const found = fields ? ORDER.filter((k) => fields[k]) : [];
  const missing = fields ? ORDER.filter((k) => !fields[k]) : [];

  return (
    <div className="rounded-input border border-dashed border-accent/40 bg-white p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900">
            <span aria-hidden="true">✨</span> Điền tự động từ ảnh CCCD
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
            Chọn ảnh mặt trước (có mã QR) và mặt sau thẻ, có thể chọn cả hai cùng lúc. Ảnh chỉ được đọc trên máy của bạn, không tải lên hệ thống.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-input bg-accent px-4 py-2.5 text-[13px] font-bold text-white hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
          {busy ? "Đang đọc…" : fields ? "Đọc thêm ảnh" : "📷 Chọn ảnh CCCD"}
        </button>
      </div>

      {busy && progress && (
        <p className="mt-3 text-xs font-medium text-navy-800" role="status">
          {progress}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-input bg-danger-50 px-3 py-2 text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      )}

      {fields && found.length > 0 && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold text-gray-700">Kết quả đọc được — kiểm tra lại trước khi điền:</p>
          <dl className="mt-2 divide-y divide-gray-100 rounded-input border border-gray-100">
            {found.map((k) => {
              const v = k === "idIssueDate" ? vnDate(fields[k]) : fields[k];
              const cur = currentValue(value, k);
              const changes = !!cur && cur !== fields[k];
              return (
                <div key={k} className="grid gap-0.5 px-3 py-2 text-[13px] sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-3">
                  <dt className="text-gray-500">{FIELD_LABEL[k]}</dt>
                  <dd className="min-w-0 break-words font-semibold text-gray-900">
                    {v}
                    {changes && !applied && <span className="ml-2 text-[11px] font-normal text-warning">(sẽ thay giá trị đang nhập)</span>}
                  </dd>
                </div>
              );
            })}
          </dl>
          {missing.length > 0 && (
            <p className="mt-2 text-xs text-gray-500">
              Chưa đọc được: {missing.map((k) => FIELD_LABEL[k]).join(", ")}.{" "}
              {missing.includes("idIssuePlace") || missing.includes("birthplace") ? "Nơi cấp và nơi sinh in ở mặt sau thẻ — chọn thêm ảnh mặt sau hoặc tự nhập." : "Bạn tự nhập các mục này."}
            </p>
          )}
          {warnings.length > 0 && (
            <ul className="mt-2 space-y-1 rounded-input bg-warning-50 px-3 py-2 text-xs font-medium text-gray-800" role="alert">
              {warnings.map((w) => (
                <li key={w}>⚠️ {w} Kiểm tra lại ảnh, hoặc sửa ở Hồ sơ cá nhân nếu hồ sơ ghi sai.</li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={apply}
              className="rounded-input bg-navy-800 px-4 py-2 text-[13px] font-bold text-white hover:bg-navy-900 disabled:opacity-60"
            >
              {applied ? "✓ Đã điền — điền lại" : "Điền vào biểu mẫu"}
            </button>
            <button type="button" onClick={reset} className="rounded-input px-3 py-2 text-[13px] font-semibold text-gray-500 hover:bg-gray-100">
              Xóa kết quả
            </button>
            {applied && <span className="text-xs text-success">Đã điền. Hãy đối chiếu từng ô với thẻ thật trước khi tích cam kết.</span>}
          </div>
          {sources.length > 0 && <p className="mt-2 text-[11px] text-gray-400">Nguồn: {sources.join(" · ")}</p>}
        </div>
      )}
    </div>
  );
}
