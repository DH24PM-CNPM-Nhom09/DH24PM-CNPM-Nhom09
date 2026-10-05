"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getEnglishOverview, type EnglishOverview } from "@/lib/admin/api";
import { errorMessage } from "@/lib/admin/format";

/** Danh sách thí sinh phòng thi tiếng Anh — in để cán bộ coi thi đối chiếu và ký nhận */
const vnTime = (iso: string) => new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
const dob = (ymd: string | null) => (ymd ? ymd.split("-").reverse().join("/") : "");

function PrintInner() {
  const sp = useSearchParams();
  const batchId = Number(sp.get("batch"));
  const sessionId = Number(sp.get("session"));
  const [data, setData] = useState<EnglishOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getEnglishOverview(batchId).then(setData).catch((e) => setError(errorMessage(e)));
  }, [batchId]);

  if (error) return <p className="p-10 text-center text-sm text-red-700">{error} (Đăng nhập Cổng quản lý trước khi in.)</p>;
  if (!data) return <p className="p-10 text-center text-sm text-gray-500">Đang tải danh sách…</p>;
  const s = data.sessions.find((x) => x.sessionId === sessionId);
  if (!s) return <p className="p-10 text-center text-sm text-gray-500">Không tìm thấy phòng thi.</p>;
  const list = data.candidates.filter((c) => c.registration?.sessionId === sessionId).sort((a, b) => a.registration!.seatNo - b.registration!.seatNo);

  return (
    <div className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end gap-2 px-4 print:hidden">
        <button type="button" onClick={() => window.print()} className="rounded-input bg-accent px-4 py-2 text-sm font-bold text-white">
          In danh sách
        </button>
      </div>
      <article className="mx-auto bg-white px-[14mm] py-[12mm] text-[12pt] text-black shadow-sm print:shadow-none" style={{ width: "210mm", fontFamily: "'Times New Roman', Times, serif" }}>
        <div className="text-center text-[11pt] leading-snug">
          <p className="uppercase">Đại học Quốc gia TP. Hồ Chí Minh</p>
          <p className="font-bold uppercase">Trường Đại học An Giang</p>
        </div>
        <h1 className="mt-5 text-center text-[14pt] font-bold uppercase">Danh sách thí sinh dự thi đánh giá năng lực tiếng Anh</h1>
        <p className="text-center italic">{data.batch.batchName}</p>
        <p className="mt-3">
          Phòng thi: <b>{s.room}</b> ({s.sessionCode}) — Thời gian: <b>{vnTime(s.testAt)}</b>
          {s.location ? ` — ${s.location}` : ""}
        </p>
        <table className="mt-3 w-full border-collapse text-[11pt]">
          <thead>
            <tr>
              {["Ghế", "Số báo danh", "Họ và tên", "Ngày sinh", "Số CCCD", "Ngành", "Ký tên"].map((h) => (
                <th key={h} className="border border-black px-1.5 py-1 text-center">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.applicationId}>
                <td className="border border-black px-1.5 py-1.5 text-center">{c.registration!.seatNo}</td>
                <td className="border border-black px-1.5 py-1.5 text-center">{c.registration!.candidateNumber}</td>
                <td className="border border-black px-1.5 py-1.5">{c.fullName}</td>
                <td className="border border-black px-1.5 py-1.5 text-center">{dob(c.dob)}</td>
                <td className="border border-black px-1.5 py-1.5 text-center">{c.idNumber}</td>
                <td className="border border-black px-1.5 py-1.5">{c.majorName}</td>
                <td className="w-[24mm] border border-black px-1.5 py-1.5" />
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3">
          Tổng số: {list.length} thí sinh. Có mặt: ........ Vắng: ........
        </p>
        <div className="mt-6 grid grid-cols-2 text-center">
          <div>
            <p className="font-bold">Cán bộ coi thi 1</p>
            <p className="italic">(Ký, ghi rõ họ tên)</p>
          </div>
          <div>
            <p className="font-bold">Cán bộ coi thi 2</p>
            <p className="italic">(Ký, ghi rõ họ tên)</p>
          </div>
        </div>
      </article>
    </div>
  );
}

export default function EnglishTestPrintPage() {
  return (
    <Suspense fallback={null}>
      <PrintInner />
    </Suspense>
  );
}
