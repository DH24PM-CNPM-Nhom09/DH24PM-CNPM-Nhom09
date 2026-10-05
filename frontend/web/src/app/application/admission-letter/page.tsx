"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMyFullApplication, getMyProfile } from "@/lib/api";
import type { Candidate, FullApplication } from "@/lib/types";

/** Giấy báo trúng tuyển — thí sinh in sau khi Quyết định công nhận trúng tuyển được ký ban hành */
const dmy = (ymd: string | null | undefined) => (ymd ? ymd.slice(0, 10).split("-").reverse().join("/") : "");
const vnTime = (iso: string) => new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });

function Row({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <tr>
      <td className="w-[48mm] py-1 align-top">{label}</td>
      <td className="py-1 font-semibold">{value ?? ""}</td>
    </tr>
  );
}

export default function AdmissionLetterPage() {
  const [app, setApp] = useState<FullApplication | null>(null);
  const [me, setMe] = useState<Candidate | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getMyFullApplication(), getMyProfile()])
      .then(([a, p]) => {
        setApp(a);
        setMe(p);
      })
      .catch((e) => setError(e?.message ?? "Không tải được thông tin."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-10 text-center text-sm text-gray-500">Đang chuẩn bị giấy báo…</div>;
  const e = app?.admission?.enrollment;
  const r = app?.admission?.result;
  if (error || !app || !me || !e || !r || e.status === "TU_CHOI_QUA_HAN")
    return (
      <div className="mx-auto max-w-md p-10 text-center text-sm text-gray-600">
        {error || "Chưa có quyết định công nhận trúng tuyển cho hồ sơ của bạn."}
        <div className="mt-4">
          <Link href="/application" className="font-semibold text-accent hover:underline">
            ← Về trang hồ sơ
          </Link>
        </div>
      </div>
    );
  const degree = app.degreeLevel === "TIEN_SI" ? "tiến sĩ" : "thạc sĩ";

  return (
    <div className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 print:hidden">
        <p className="text-sm text-gray-600">Kiểm tra thông tin rồi bấm In (có thể chọn “Lưu thành PDF”).</p>
        <div className="flex gap-2">
          <Link href="/application" className="rounded-input border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            ← Quay lại
          </Link>
          <button type="button" onClick={() => window.print()} className="rounded-input bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-dark">
            In giấy báo
          </button>
        </div>
      </div>

      <article className="mx-auto bg-white px-[20mm] py-[15mm] text-[13pt] leading-[1.5] text-black shadow-sm print:shadow-none" style={{ width: "210mm", fontFamily: "'Times New Roman', Times, serif" }}>
        <div className="grid grid-cols-[1fr_1.35fr] gap-2 text-center text-[11.5pt] leading-snug">
          <div>
            <p className="uppercase">Đại học Quốc gia TP. Hồ Chí Minh</p>
            <p className="font-bold uppercase">
              <span className="border-b border-black">Trường Đại học An Giang</span>
            </p>
          </div>
          <div>
            <p className="whitespace-nowrap font-bold uppercase">Cộng hòa xã hội chủ nghĩa Việt Nam</p>
            <p className="font-bold">
              <span className="border-b border-black">Độc lập - Tự do - Hạnh phúc</span>
            </p>
          </div>
        </div>

        <h1 className="mt-8 text-center text-[16pt] font-bold uppercase">Giấy báo trúng tuyển</h1>
        <p className="text-center italic">Trình độ {degree} — {app.batch.batchName}</p>

        <p className="mt-6">Trường Đại học An Giang trân trọng thông báo:</p>
        <table className="mt-2 w-full">
          <tbody>
            <Row label="Họ và tên:" value={me.fullName.toUpperCase()} />
            <Row label="Ngày sinh:" value={dmy(me.dob)} />
            <Row label="Số CCCD:" value={me.idNumber} />
            <Row label="Mã hồ sơ:" value={app.applicationCode} />
            <Row label="Ngành trúng tuyển:" value={`${app.major.majorName} (mã ${app.major.majorCode})`} />
            <Row label="Tổng điểm xét tuyển:" value={r.total === null ? "" : String(r.total).replace(".", ",")} />
          </tbody>
        </table>
        <p className="mt-3 text-justify">
          đã <b>TRÚNG TUYỂN</b> trình độ {degree} theo Quyết định số <b>{e.decisionNo}</b> ngày {dmy(e.decisionDate)} của Hiệu trưởng Trường Đại học An Giang.
        </p>

        <h2 className="mt-5 font-bold">Thủ tục nhập học</h2>
        <ol className="list-decimal pl-6 text-justify text-[12.5pt]">
          <li>Xác nhận nhập học trên Cổng tuyển sinh sau đại học trước {vnTime(e.deadline)}. Quá hạn không xác nhận được xem như từ chối nhập học.</li>
          <li>Nộp bản chính (hoặc bản sao chứng thực) văn bằng, bảng điểm, chứng chỉ đã khai khi đăng ký và giấy báo này tại Phòng Đào tạo Sau đại học để đối chiếu.</li>
          <li>Sau khi đối chiếu, Nhà trường hoàn tất thủ tục và cấp mã học viên trên cổng tuyển sinh.</li>
        </ol>
        {e.status === "DA_XAC_NHAN" && <p className="mt-3 italic">Thí sinh đã xác nhận nhập học lúc {e.confirmedAt ? vnTime(e.confirmedAt) : ""}.</p>}
        {e.studentCode && (
          <p className="mt-1">
            Mã học viên: <b>{e.studentCode}</b>
          </p>
        )}

        <div className="mt-10 grid grid-cols-2 text-center text-[12pt]">
          <div />
          <div>
            <p className="font-bold uppercase">Phòng Đào tạo Sau đại học</p>
            <p className="italic">(Giấy báo in từ Cổng tuyển sinh sau đại học)</p>
          </div>
        </div>
      </article>
    </div>
  );
}
