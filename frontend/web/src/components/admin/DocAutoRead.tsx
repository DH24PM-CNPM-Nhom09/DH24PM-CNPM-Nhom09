"use client";

import { useRef, useState, type ReactNode } from "react";
import { Btn } from "@/components/admin/ui";
import { fetchDocumentFile, USE_MOCK } from "@/lib/admin/api";
import { errorMessage, fmtDate } from "@/lib/admin/format";
import type { AdminCandidate, AdminDocument } from "@/lib/admin/types";
import type { DocumentReadResult } from "@/lib/idcard-reader";

function Row({ label, ok, children }: { label: string; ok?: boolean | null; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 px-3 py-2 text-[13px] sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-gray-900">
        {ok === true && <span className="mr-1.5 font-bold text-[#166534]">✓</span>}
        {ok === false && <span className="mr-1.5 font-bold text-[#B91C1C]">✗</span>}
        {children}
      </dd>
    </div>
  );
}

/**
 * Yêu cầu 1 (phía cán bộ): đọc tự động tệp minh chứng (CCCD, văn bằng, chứng chỉ) để đối chiếu
 * số định danh, số hiệu văn bằng, số vào sổ và họ tên với thông tin thí sinh khai.
 * Xử lý ngay trong trình duyệt của cán bộ; kết quả chỉ để tham khảo, cán bộ vẫn tự kết luận.
 */
export default function DocAutoRead({ doc, candidate }: { doc: AdminDocument; candidate: AdminCandidate }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [err, setErr] = useState("");
  const [res, setRes] = useState<DocumentReadResult | null>(null);

  async function run(blob?: Blob) {
    setBusy(true);
    setErr("");
    setRes(null);
    try {
      setProgress("Đang tải tệp…");
      const file = blob ?? (await fetchDocumentFile(doc.documentId));
      const { readDocumentForCheck } = await import("@/lib/idcard-reader");
      setRes(await readDocumentForCheck(file, candidate.fullName, setProgress));
    } catch (e) {
      setErr(errorMessage(e, "Không đọc được tệp."));
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  const declared = candidate.idNumber ?? "";
  const idMatch = res && declared ? res.idNumbers.includes(declared) : null;
  const q = res?.qrFields;

  return (
    <section className="mt-4 rounded-input border border-gray-200 bg-gray-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900">Đọc tự động (AI)</p>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
            Đọc mã QR trên CCCD hoặc nhận dạng chữ trên văn bằng, chứng chỉ (PDF đọc trang 1) rồi đối chiếu với thông tin thí sinh khai. Chỉ để tham khảo.
          </p>
        </div>
        {USE_MOCK ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) run(f);
                e.target.value = "";
              }}
            />
            <Btn size="sm" variant="outline" loading={busy} onClick={() => fileRef.current?.click()}>
              Chọn tệp trên máy để thử
            </Btn>
          </>
        ) : (
          <Btn size="sm" variant="outline" loading={busy} onClick={() => run()}>
            {res ? "Đọc lại" : "Đọc tự động"}
          </Btn>
        )}
      </div>
      {USE_MOCK && !res && !busy && <p className="mt-2 text-xs text-gray-500">Dữ liệu mẫu không có tệp thật, chọn một ảnh CCCD hoặc văn bằng trên máy để xem thử.</p>}
      {busy && progress && (
        <p className="mt-3 text-xs font-medium text-navy-800" role="status">
          {progress}
        </p>
      )}
      {err && (
        <p className="mt-3 text-xs font-medium text-[#B91C1C]" role="alert">
          {err}
        </p>
      )}
      {res && (
        <>
          <dl className="mt-3 divide-y divide-gray-100 rounded-input border border-gray-200 bg-white">
            <Row label="Cách đọc">{res.source === "QR" ? "Mã QR trên CCCD (chính xác)" : "Nhận dạng chữ (có thể sai vài ký tự)"}</Row>
            <Row label="Số CCCD trong tệp" ok={res.idNumbers.length ? idMatch : null}>
              {res.idNumbers.length ? res.idNumbers.join(", ") : "Không thấy số 12 chữ số"}
              {res.idNumbers.length > 0 && declared && (
                <span className="ml-1 text-gray-500">{idMatch ? "— khớp số thí sinh khai" : `— KHÔNG khớp số thí sinh khai (${declared})`}</span>
              )}
            </Row>
            <Row label="Họ tên thí sinh" ok={res.nameFound}>
              {res.nameFound ? `Có "${candidate.fullName}" trong tệp` : `Không thấy "${candidate.fullName}" trong tệp`}
            </Row>
            {q?.dob && (
              <Row label="Ngày sinh trên thẻ" ok={candidate.dob ? q.dob === candidate.dob.slice(0, 10) : null}>
                {fmtDate(q.dob)}
              </Row>
            )}
            {q?.idIssueDate && (
              <Row label="Ngày cấp trên thẻ" ok={candidate.idIssueDate ? q.idIssueDate === candidate.idIssueDate.slice(0, 10) : null}>
                {fmtDate(q.idIssueDate)}
              </Row>
            )}
            {res.diplomaNo && <Row label="Số hiệu văn bằng">{res.diplomaNo}</Row>}
            {res.registryNo && <Row label="Số vào sổ cấp bằng">{res.registryNo}</Row>}
          </dl>
          {res.source === "OCR" && (
            <p className="mt-2 text-[11px] text-gray-500">
              Số hiệu và số vào sổ dùng để tra cứu văn bằng trên cổng của trường cấp bằng. Kết quả nhận dạng chữ có thể sai, luôn đối chiếu với ảnh ở trên.
            </p>
          )}
        </>
      )}
    </section>
  );
}
