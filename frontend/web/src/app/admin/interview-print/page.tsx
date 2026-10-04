"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getScoringOverview, type ScoringOverview } from "@/lib/admin/api";
import { errorMessage } from "@/lib/admin/format";

/** Lịch phỏng vấn / trình bày đề cương kèm cột điểm để tiểu ban chấm tay rồi thư ký nhập lại */
const vnTime = (iso: string) => new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
const dmy = (ymd: string | null) => (ymd ? ymd.split("-").reverse().join("/") : "");
const cell = "border border-black px-1.5 py-1.5";

function PrintInner() {
  const sp = useSearchParams();
  const bm = Number(sp.get("bm"));
  const [d, setD] = useState<ScoringOverview | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    getScoringOverview(bm).then(setD).catch((e) => setError(errorMessage(e)));
  }, [bm]);

  if (error) return <p className="p-10 text-center text-sm text-red-700">{error} (Đăng nhập Cổng quản lý trước khi in.)</p>;
  if (!d) return <p className="p-10 text-center text-sm text-gray-500">Đang tải lịch…</p>;
  const list = d.candidates.filter((c) => c.interview).sort((a, b) => a.interview!.scheduledAt.localeCompare(b.interview!.scheduledAt));
  const isPhd = d.batch.degreeLevel === "TIEN_SI";
  const subj = d.subjects.find((s) => s.examFormat === "PHONG_VAN");
  const chair = d.committee?.members.find((m) => m.role === "CHU_TICH");
  const secretary = d.committee?.members.find((m) => m.role === "THU_KY");

  return (
    <div className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[297mm] justify-end px-4 print:hidden">
        <button type="button" onClick={() => window.print()} className="rounded-input bg-accent px-4 py-2 text-sm font-bold text-white">
          In lịch &amp; phiếu chấm
        </button>
      </div>
      <article className="mx-auto bg-white px-[12mm] py-[10mm] text-[12pt] text-black shadow-sm print:shadow-none" style={{ width: "297mm", fontFamily: "'Times New Roman', Times, serif" }}>
        <style>{"@page { size: A4 landscape; margin: 10mm; }"}</style>
        <div className="grid grid-cols-2 text-center text-[11pt] leading-snug">
          <div>
            <p className="uppercase">Trường Đại học An Giang</p>
            <p className="font-bold uppercase">{d.committee?.committeeName ?? "Tiểu ban xét tuyển"}</p>
          </div>
          <div>
            <p className="font-bold uppercase">Cộng hòa xã hội chủ nghĩa Việt Nam</p>
            <p className="font-bold">Độc lập - Tự do - Hạnh phúc</p>
          </div>
        </div>
        <h1 className="mt-4 text-center text-[14pt] font-bold uppercase">
          Lịch {d.interviewLabel.toLowerCase()} và bảng ghi điểm
        </h1>
        <p className="text-center italic">
          {d.batch.batchName} — Ngành {d.major.majorName} ({d.major.majorCode})
        </p>
        {subj && (
          <p className="mt-2 text-[11pt]">
            Hình thức: {subj.subjectName} (thang điểm {subj.maxScore}, hệ số {subj.weight}).{d.committee?.decisionNo ? ` Tiểu ban thành lập theo Quyết định số ${d.committee.decisionNo}.` : ""}
          </p>
        )}
        <table className="mt-3 w-full border-collapse text-[11pt]">
          <thead>
            <tr>
              {["STT", "Thời gian", "Họ và tên", "Ngày sinh", "Mã hồ sơ", ...(isPhd ? ["Tên đề cương"] : []), ...(d.committee?.members.map((m) => m.fullName.split(" ").slice(-1)[0]) ?? []), "Điểm TB", "Ghi chú"].map((h, i) => (
                <th key={i} className={`${cell} text-center`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((c, i) => (
              <tr key={c.applicationId}>
                <td className={`${cell} text-center`}>{i + 1}</td>
                <td className={`${cell} whitespace-nowrap text-center`}>{vnTime(c.interview!.scheduledAt)}</td>
                <td className={cell}>{c.fullName}</td>
                <td className={`${cell} text-center`}>{dmy(c.dob)}</td>
                <td className={`${cell} text-center text-[10pt]`}>{c.applicationCode}</td>
                {isPhd && <td className={`${cell} text-[10pt]`}>{c.researchTopic ?? ""}</td>}
                {d.committee?.members.map((m) => <td key={m.memberId} className={`${cell} w-[16mm]`} />)}
                <td className={`${cell} w-[16mm]`} />
                <td className={`${cell} w-[24mm]`} />
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11pt]">Địa điểm: {list[0]?.interview?.location ?? ""}. Tổng số: {list.length} thí sinh.</p>
        <div className="mt-6 grid grid-cols-2 text-center">
          <div>
            <p className="font-bold">Thư ký tiểu ban</p>
            <p className="italic">(Ký, ghi rõ họ tên)</p>
            <p className="mt-14 font-bold">{secretary?.fullName ?? ""}</p>
          </div>
          <div>
            <p className="font-bold">Chủ tịch tiểu ban</p>
            <p className="italic">(Ký, ghi rõ họ tên)</p>
            <p className="mt-14 font-bold">{chair?.fullName ?? ""}</p>
          </div>
        </div>
      </article>
    </div>
  );
}

export default function InterviewPrintPage() {
  return (
    <Suspense fallback={null}>
      <PrintInner />
    </Suspense>
  );
}
