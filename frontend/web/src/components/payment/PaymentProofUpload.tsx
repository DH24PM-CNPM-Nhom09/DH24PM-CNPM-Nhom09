"use client";

import { useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { Alert, errMsg } from "@/components/auth/AuthBits";
import { fetchPaymentProofFile, uploadPaymentProof } from "@/lib/api";
import { fmtDateTime } from "@/lib/announcements";
import { checkFile, fmtSize } from "@/lib/application";
import type { PaymentProof } from "@/lib/types";

/**
 * Sau khi chuyển khoản: thí sinh tải ảnh chụp giao dịch thành công (hoặc PDF biên lai điện tử)
 * để Phòng Đào tạo đối chiếu. Trạng thái "Đã nộp" vẫn do cán bộ xác nhận sau khi kiểm tra sao kê.
 */
export default function PaymentProofUpload({ proofs, onUploaded }: { proofs: PaymentProof[]; onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  function pick(f: File | null) {
    setMsg(null);
    if (!f) return setFile(null);
    const err = checkFile(f);
    if (err) {
      setFile(null);
      setMsg({ tone: "error", text: err });
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile(f);
  }

  async function send() {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      await uploadPaymentProof(file, note);
      setFile(null);
      setNote("");
      if (inputRef.current) inputRef.current.value = "";
      setMsg({ tone: "success", text: "Đã gửi minh chứng chuyển khoản. Phòng Đào tạo sẽ đối chiếu và xác nhận trong 1–2 ngày làm việc." });
      onUploaded();
    } catch (e) {
      setMsg({ tone: "error", text: errMsg(e, "Gửi tệp thất bại, vui lòng thử lại.") });
    } finally {
      setBusy(false);
    }
  }

  async function view(p: PaymentProof) {
    try {
      const url = URL.createObjectURL(await fetchPaymentProofFile(p.proofId));
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setMsg({ tone: "error", text: errMsg(e, "Không mở được tệp.") });
    }
  }

  return (
    <div className="mt-4 rounded-input border border-dashed border-accent/40 bg-white p-4">
      <p className="text-sm font-bold text-gray-900">Đã chuyển khoản? Gửi ảnh giao dịch thành công</p>
      <p className="mt-1 text-xs leading-relaxed text-gray-500">
        Chụp màn hình giao dịch thành công trong app ngân hàng (thấy rõ số tiền, nội dung chuyển khoản, thời gian) hoặc tải biên lai điện tử PDF. PDF, JPG, PNG tối đa 5MB.
      </p>

      {proofs.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {proofs.map((p) => (
            <li key={p.proofId} className="flex flex-wrap items-center justify-between gap-2 rounded-input bg-gray-50 px-3 py-2 text-[13px]">
              <span className="min-w-0">
                <span className="font-semibold text-gray-800">{p.fileName}</span>
                <span className="text-gray-500"> · {fmtSize(p.fileSizeKb)} · gửi {fmtDateTime(p.uploadedAt)}</span>
                {p.note && <span className="block text-gray-500">Ghi chú: {p.note}</span>}
              </span>
              <button type="button" onClick={() => view(p)} className="text-[13px] font-semibold text-accent hover:underline">
                Xem
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
          className="min-w-0 flex-1 text-sm file:mr-3 file:rounded-input file:border-0 file:bg-accent-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-accent"
        />
      </div>
      <input
        type="text"
        value={note}
        maxLength={500}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Ghi chú (không bắt buộc): ngân hàng, giờ chuyển, tên người chuyển nếu khác thí sinh…"
        className="mt-2 w-full rounded-input border border-gray-200 px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <div className="mt-3">
        <Button loading={busy} disabled={!file} onClick={send}>
          {proofs.length ? "Gửi thêm tệp" : "Gửi minh chứng chuyển khoản"}
        </Button>
      </div>
      {msg && (
        <div className="mt-3">
          <Alert tone={msg.tone}>{msg.text}</Alert>
        </div>
      )}
    </div>
  );
}
