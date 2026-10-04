"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getDecisionDetail, type DecisionDetail } from "@/lib/admin/api";
import { errorMessage } from "@/lib/admin/format";

/** Quyết định công nhận trúng tuyển + danh sách kèm theo — in / lưu PDF */
const dmy = (ymd: string | null) => (ymd ? ymd.split("-").reverse().join("/") : "");
const GENDER: Record<string, string> = { NAM: "Nam", NU: "Nữ", KHAC: "Khác" };
const cell = "border border-black px-1.5 py-1";

function PrintInner() {
  const sp = useSearchParams();
  const decisionId = Number(sp.get("id"));
  const [d, setD] = useState<DecisionDetail | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    getDecisionDetail(decisionId).then(setD).catch((e) => setError(errorMessage(e)));
  }, [decisionId]);

  if (error) return <p className="p-10 text-center text-sm text-red-700">{error} (Đăng nhập Cổng quản lý trước khi in.)</p>;
  if (!d) return <p className="p-10 text-center text-sm text-gray-500">Đang tải quyết định…</p>;
  const [y, m, day] = (d.decisionDate ?? "").split("-");
  const degree = d.batch.degreeLevel === "TIEN_SI" ? "tiến sĩ" : "thạc sĩ";
  const rows = d.rows.filter((r) => !r.cancelled || d.status === "ISSUED");
  const draft = d.status !== "ISSUED";

  return (
    <div className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3 px-4 print:hidden">
        <p className="text-sm text-gray-600">{draft ? "Bản dự thảo — chưa có hiệu lực." : "Quyết định đã ký ban hành."}</p>
        <button type="button" onClick={() => window.print()} className="rounded-input bg-accent px-4 py-2 text-sm font-bold text-white">
          In / lưu PDF
        </button>
      </div>
      <article className="relative mx-auto bg-white px-[20mm] py-[15mm] text-[13pt] leading-[1.45] text-black shadow-sm print:shadow-none" style={{ width: "210mm", fontFamily: "'Times New Roman', Times, serif" }}>
        {draft && (
          <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[110mm] -translate-x-1/2 -rotate-[25deg] select-none text-[72pt] font-bold tracking-widest text-gray-300/60">
            DỰ THẢO
          </span>
        )}
        <div className="grid grid-cols-[1.15fr_1.3fr] gap-2 text-center text-[11.5pt] leading-snug">
          <div>
            <p className="whitespace-nowrap uppercase">Đại học Quốc gia TP. Hồ Chí Minh</p>
            <p className="font-bold uppercase">
              <span className="border-b border-black">Trường Đại học An Giang</span>
            </p>
            <p className="mt-2">Số: {d.decisionNo}</p>
          </div>
          <div>
            <p className="whitespace-nowrap font-bold uppercase">Cộng hòa xã hội chủ nghĩa Việt Nam</p>
            <p className="font-bold">
              <span className="border-b border-black">Độc lập - Tự do - Hạnh phúc</span>
            </p>
            <p className="mt-2 italic">
              An Giang, ngày {day} tháng {m} năm {y}
            </p>
          </div>
        </div>

        <h1 className="mt-6 text-center text-[14pt] font-bold uppercase">Quyết định</h1>
        <p className="text-center font-bold">
          Về việc công nhận thí sinh trúng tuyển trình độ {degree}
          <br />
          {d.batch.batchName}
        </p>
        <p className="mt-4 text-center font-bold uppercase">Hiệu trưởng Trường Đại học An Giang</p>
        <div className="mt-3 space-y-1 text-justify italic">
          {d.batch.legalBasis && <p className="indent-[10mm]">Căn cứ {d.batch.legalBasis};</p>}
          <p className="indent-[10mm]">Căn cứ kết quả xét tuyển đã được Hội đồng tuyển sinh thông qua và Lãnh đạo phê duyệt;</p>
          <p className="indent-[10mm]">Theo đề nghị của Trưởng phòng Đào tạo Sau đại học.</p>
        </div>
        <p className="mt-4 text-center font-bold uppercase">Quyết định:</p>
        <div className="mt-2 space-y-2 text-justify">
          <p className="indent-[10mm]">
            <b>Điều 1.</b> Công nhận {rows.length} thí sinh có tên trong danh sách kèm theo trúng tuyển trình độ {degree}, {d.batch.batchName}.
          </p>
          <p className="indent-[10mm]">
            <b>Điều 2.</b> Thí sinh trúng tuyển xác nhận nhập học trên Cổng tuyển sinh sau đại học trong thời hạn quy định và nộp bản chính hồ sơ tại Phòng Đào tạo Sau đại học để đối chiếu. Quá thời hạn không xác nhận được xem như từ chối nhập học.
          </p>
          <p className="indent-[10mm]">
            <b>Điều 3.</b> Quyết định có hiệu lực kể từ ngày ký. Trưởng phòng Đào tạo Sau đại học, Thủ trưởng các đơn vị có liên quan và các thí sinh có tên tại Điều 1 chịu trách nhiệm thi hành Quyết định này.
          </p>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4">
          <div className="text-[11pt]">
            <p className="font-bold italic">Nơi nhận:</p>
            <p>- Như Điều 3;</p>
            <p>- Lưu: VT, ĐTSĐH.</p>
          </div>
          <div className="text-center">
            <p className="font-bold uppercase">KT. Hiệu trưởng</p>
            <p className="font-bold uppercase">Phó Hiệu trưởng</p>
            {d.status === "ISSUED" ? (
              <>
                <p className="mt-6 text-[11pt] italic text-gray-700">(Đã ký số — {d.signatureRef})</p>
                <p className="mt-6 font-bold">{d.signedBy}</p>
              </>
            ) : (
              <p className="mt-16 italic text-gray-500">(chưa ký)</p>
            )}
          </div>
        </div>

        <div className="mt-10 break-before-page">
          <p className="text-center font-bold uppercase">Danh sách thí sinh trúng tuyển trình độ {degree}</p>
          <p className="text-center italic">
            (Kèm theo Quyết định số {d.decisionNo} ngày {dmy(d.decisionDate)})
          </p>
          <table className="mt-3 w-full border-collapse text-[11pt]">
            <thead>
              <tr>
                {["STT", "Mã hồ sơ", "Họ và tên", "Ngày sinh", "Giới tính", "Ngành", "Tổng điểm"].map((h) => (
                  <th key={h} className={`${cell} text-center`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.applicationCode}>
                  <td className={`${cell} text-center`}>{i + 1}</td>
                  <td className={`${cell} text-center text-[10pt]`}>{r.applicationCode}</td>
                  <td className={cell}>{r.fullName}</td>
                  <td className={`${cell} text-center`}>{dmy(r.dob)}</td>
                  <td className={`${cell} text-center`}>{r.gender ? GENDER[r.gender] : ""}</td>
                  <td className={cell}>
                    {r.majorName} ({r.majorCode})
                  </td>
                  <td className={`${cell} text-center`}>{r.total === null ? "" : String(r.total).replace(".", ",")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 italic">Danh sách có {rows.length} thí sinh.</p>
        </div>
      </article>
    </div>
  );
}

export default function DecisionPrintPage() {
  return (
    <Suspense fallback={null}>
      <PrintInner />
    </Suspense>
  );
}
