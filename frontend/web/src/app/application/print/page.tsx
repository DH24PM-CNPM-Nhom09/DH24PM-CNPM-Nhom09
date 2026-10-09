"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMyFullApplication, getMyProfile } from "@/lib/api";
import { EDU_LABEL, LANGUAGE_OPTION_TEXT } from "@/lib/application";
import type { Candidate, FullApplication } from "@/lib/types";

/**
 * Đơn đăng ký dự tuyển — điền sẵn từ thông tin thí sinh đã khai trên hệ thống.
 * Thí sinh in ra (hoặc "Lưu thành PDF"), ghi thêm các mục để trống, ký tên rồi tải lên mục "Đơn đăng ký dự tuyển".
 */
const GENDER: Record<string, string> = { NAM: "Nam", NU: "Nữ", KHAC: "Khác" };

function fmtDob(ymd: string | null | undefined) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

/** Một dòng thông tin: có dữ liệu thì in ra, chưa có thì để dòng chấm cho thí sinh viết tay */
function Line({ label, value, wide }: { label: string; value?: string | number | null; wide?: boolean }) {
  return (
    <div className={`flex items-end gap-2 ${wide ? "col-span-2" : ""}`}>
      <span className="shrink-0">{label}:</span>
      {value ? <span className="font-semibold">{value}</span> : <span className="mb-1 flex-1 border-b border-dotted border-gray-500" />}
    </div>
  );
}

export default function PrintApplicationForm() {
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

  if (loading) return <div className="p-10 text-center text-sm text-gray-500">Đang chuẩn bị đơn…</div>;
  if (error || !app || !me)
    return (
      <div className="mx-auto max-w-md p-10 text-center text-sm text-gray-600">
        {error || "Bạn chưa có hồ sơ xét tuyển. Hãy chọn đợt, ngành và khai quá trình đào tạo trước khi in đơn."}
        <div className="mt-4">
          <Link href="/application/new" className="font-semibold text-accent hover:underline">
            Tạo hồ sơ xét tuyển →
          </Link>
        </div>
      </div>
    );

  const degreeText = app.degreeLevel === "TIEN_SI" ? "TIẾN SĨ" : "THẠC SĨ";
  const year = new Date(app.batch.registrationEndAt).getFullYear();
  const edu = app.education;

  return (
    <div className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      {/* Thanh công cụ — không in */}
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 print:hidden">
        <p className="text-sm text-gray-600">
          Kiểm tra thông tin, bấm <span className="font-semibold">In đơn</span> (có thể chọn “Lưu thành PDF”). Ghi thêm các mục còn trống, dán ảnh 3x4, ký tên rồi tải lên hệ thống.
        </p>
        <div className="flex gap-2">
          <Link href="/application/new" className="rounded-input border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            ← Quay lại hồ sơ
          </Link>
          <button type="button" onClick={() => window.print()} className="rounded-input bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-dark">
            In đơn
          </button>
        </div>
      </div>

      <article
        className="mx-auto bg-white px-[18mm] py-[15mm] text-[13.5pt] leading-[1.55] text-black shadow-sm print:shadow-none"
        style={{ width: "210mm", minHeight: "297mm", fontFamily: "'Times New Roman', Times, serif" }}
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

        <div className="mt-6 flex items-start gap-6">
          <div className="flex h-[40mm] w-[30mm] shrink-0 items-center justify-center border border-black text-center text-[10pt] leading-tight">
            Ảnh 3x4
            <br />
            (đóng dấu giáp lai)
          </div>
          <div className="flex-1 pt-2 text-center">
            <h1 className="text-[15pt] font-bold uppercase leading-snug">
              Đơn đăng ký dự tuyển
              <br />
              đào tạo trình độ {degreeText} năm {year}
            </h1>
            <p className="mt-1 italic">({app.batch.batchName})</p>
            <p className="mt-3">Kính gửi: Hiệu trưởng Trường Đại học An Giang, ĐHQG-HCM</p>
          </div>
        </div>

        <p className="mt-4 text-right text-[11pt]">
          Mã hồ sơ: <span className="font-bold">{app.applicationCode}</span>
        </p>

        <h2 className="mt-3 font-bold">I. THÔNG TIN CÁ NHÂN</h2>
        <div className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1.5">
          <Line label="Họ và tên" value={me.fullName.toUpperCase()} />
          <Line label="Giới tính" value={me.gender ? GENDER[me.gender] : ""} />
          <Line label="Ngày sinh" value={fmtDob(me.dob)} />
          <Line label="Nơi sinh" value={me.birthplace} />
          <Line label="Dân tộc" value={me.ethnicity} />
          <Line label="Quốc tịch" value={me.nationality} />
          <Line label="Số CCCD" value={me.idNumber} />
          <Line label="Ngày cấp" value={me.idIssueDate ? fmtDob(me.idIssueDate) : null} />
          <Line label="Nơi cấp" value={me.idIssuePlace} wide />
          <Line label="Nơi thường trú" value={me.permanentAddress} wide />
          <Line label="Địa chỉ liên hệ" value={me.address} wide />
          <Line label="Điện thoại" value={me.phoneNumber} />
          <Line label="Email" value={me.email} />
          <Line label="Cơ quan công tác (nếu có)" wide />
        </div>

        <h2 className="mt-4 font-bold">II. QUÁ TRÌNH ĐÀO TẠO</h2>
        <div className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1.5">
          <Line label="Trình độ" value={edu ? EDU_LABEL[edu.degreeLevel] : ""} />
          <Line label="Năm tốt nghiệp" value={edu?.graduationYear} />
          <Line label="Ngành tốt nghiệp" value={edu?.majorName} wide />
          <Line label="Cơ sở đào tạo" value={edu?.institutionName} wide />
          <Line label="Điểm trung bình tích lũy" value={edu ? `${edu.gpa ?? ""}/${edu.gpaScale}` : ""} />
          <Line label="Hình thức đào tạo" />
        </div>

        <h2 className="mt-4 font-bold">III. ĐĂNG KÝ DỰ TUYỂN</h2>
        <div className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1.5">
          <Line label="Ngành đăng ký" value={app.major.majorName} />
          <Line label="Mã ngành" value={app.major.majorCode} />
          <Line label="Ngoại ngữ" value={app.language.option ? LANGUAGE_OPTION_TEXT[app.language.option].title : ""} wide />
          {app.language.note && <Line label="Lý do miễn ngoại ngữ" value={app.language.note} wide />}
          {app.proposal && <Line label="Đề tài nghiên cứu dự kiến" value={app.proposal.researchTopic} wide />}
          {app.proposal && <Line label="Người hướng dẫn dự kiến" value={app.proposal.lecturerName} wide />}
          <Line label="Đối tượng ưu tiên (nếu có)" wide />
        </div>

        <p className="mt-5 text-justify indent-8">
          Tôi xin cam đoan những lời khai trên là đúng sự thật, đã đọc và đồng ý thực hiện đúng quy định tuyển sinh của Nhà trường. Nếu sai, tôi xin hoàn toàn chịu trách nhiệm và chịu xử lý theo quy định.
        </p>

        <div className="mt-6 grid grid-cols-2">
          <div />
          <div className="text-center">
            <p className="italic">.................., ngày ...... tháng ...... năm {year}</p>
            <p className="font-bold">Người làm đơn</p>
            <p className="italic">(Ký và ghi rõ họ tên)</p>
            <div className="h-[22mm]" />
            <p className="font-bold">{me.fullName}</p>
          </div>
        </div>
      </article>
    </div>
  );
}
