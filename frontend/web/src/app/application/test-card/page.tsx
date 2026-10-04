"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMyFullApplication, getMyProfile } from "@/lib/api";
import type { Candidate, FullApplication } from "@/lib/types";

/** Giấy báo dự thi đánh giá năng lực tiếng Anh — thí sinh in mang theo cùng CCCD */
function fmtDob(ymd: string | null | undefined) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}
const vnTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }) : "";

function Row({ label, value, strong }: { label: string; value?: string | number | null; strong?: boolean }) {
  return (
    <tr>
      <td className="w-[45mm] py-1 align-top">{label}</td>
      <td className={`py-1 ${strong ? "text-[15pt] font-bold" : "font-semibold"}`}>{value ?? ""}</td>
    </tr>
  );
}

export default function EnglishTestCard() {
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
  const t = app?.englishTest;
  if (error || !app || !me || !t?.candidateNumber)
    return (
      <div className="mx-auto max-w-md p-10 text-center text-sm text-gray-600">
        {error || "Bạn chưa được xếp lịch thi đánh giá năng lực tiếng Anh."}
        <div className="mt-4">
          <Link href="/application" className="font-semibold text-accent hover:underline">
            ← Về trang hồ sơ
          </Link>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 print:hidden">
        <p className="text-sm text-gray-600">Kiểm tra thông tin rồi bấm In (có thể chọn “Lưu thành PDF”). Dán ảnh 3x4 vào ô ảnh.</p>
        <div className="flex gap-2">
          <Link href="/application" className="rounded-input border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            ← Quay lại
          </Link>
          <button type="button" onClick={() => window.print()} className="rounded-input bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-dark">
            In giấy báo
          </button>
        </div>
      </div>

      <article
        className="mx-auto bg-white px-[18mm] py-[14mm] text-[13pt] leading-[1.5] text-black shadow-sm print:shadow-none"
        style={{ width: "210mm", fontFamily: "'Times New Roman', Times, serif" }}
      >
        <div className="grid grid-cols-[1fr_1.35fr] gap-2 text-center text-[11.5pt] leading-snug">
          <div>
            <p className="uppercase">Đại học Quốc gia TP. Hồ Chí Minh</p>
            <p className="font-bold uppercase">Trường Đại học An Giang</p>
          </div>
          <div>
            <p className="whitespace-nowrap font-bold uppercase">Cộng hòa xã hội chủ nghĩa Việt Nam</p>
            <p className="font-bold">
              <span className="border-b border-black">Độc lập - Tự do - Hạnh phúc</span>
            </p>
          </div>
        </div>

        <h1 className="mt-7 text-center text-[16pt] font-bold uppercase leading-snug">
          Giấy báo dự thi
          <br />
          đánh giá năng lực tiếng Anh
        </h1>
        <p className="text-center italic">Kỳ tuyển sinh sau đại học — {app.batch.batchName}</p>

        <div className="mt-6 flex items-start gap-6">
          <table className="flex-1">
            <tbody>
              <Row label="Số báo danh:" value={t.candidateNumber} strong />
              <Row label="Họ và tên:" value={me.fullName.toUpperCase()} />
              <Row label="Ngày sinh:" value={fmtDob(me.dob)} />
              <Row label="Số CCCD:" value={me.idNumber} />
              <Row label="Mã hồ sơ:" value={app.applicationCode} />
              <Row label="Ngành dự tuyển:" value={app.major.majorName} />
            </tbody>
          </table>
          <div className="flex h-[40mm] w-[30mm] shrink-0 items-center justify-center border border-black text-center text-[10pt] leading-tight">Ảnh 3x4</div>
        </div>

        <div className="mt-5 border border-black p-4">
          <table className="w-full">
            <tbody>
              <Row label="Thời gian:" value={vnTime(t.testAt)} />
              <Row label="Phòng thi:" value={`${t.room} (${t.sessionCode})`} />
              <Row label="Số ghế:" value={t.seatNo} />
              {t.location && <Row label="Địa điểm:" value={t.location} />}
            </tbody>
          </table>
        </div>

        <h2 className="mt-5 font-bold">Lưu ý thí sinh</h2>
        <ul className="list-disc pl-6 text-[12pt]">
          <li>Có mặt tại phòng thi trước giờ thi 30 phút; đến muộn quá 15 phút sau khi tính giờ làm bài không được dự thi.</li>
          <li>Mang theo giấy báo dự thi này và căn cước công dân bản gốc để đối chiếu.</li>
          <li>Không mang điện thoại, tài liệu, thiết bị thu phát vào phòng thi.</li>
          {t.note && <li>{t.note}</li>}
        </ul>

        <div className="mt-8 grid grid-cols-2 text-center text-[12pt]">
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
