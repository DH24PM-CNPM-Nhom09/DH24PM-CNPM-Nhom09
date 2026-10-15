"use client";

// ============================================================================
// Yêu cầu 3 — Tự tạo giấy báo trúng tuyển dạng PDF.
//   • Thí sinh: tải giấy báo của mình sau khi quyết định trúng tuyển được ký ban hành.
//   • Cán bộ: tải giấy báo của 1 thí sinh hoặc cả danh sách trong 1 quyết định (mỗi người 1 trang).
// Mỗi giấy báo có mã QR chứa mã hồ sơ + số quyết định để đối chiếu khi thí sinh làm thủ tục.
// ============================================================================
import { makePdf, safeFileName, saveBlob, type PdfContent } from "./cdn";

export interface LetterData {
  fullName: string;
  dob: string | null; // yyyy-mm-dd
  gender?: string | null; // NAM | NU | KHAC
  idNumber?: string | null;
  applicationCode: string;
  degreeLevel: "THAC_SI" | "TIEN_SI";
  batchName: string;
  majorName: string;
  majorCode: string;
  total: number | null;
  decisionNo: string;
  decisionDate: string | null; // yyyy-mm-dd
  /** Hạn xác nhận nhập học (ISO) */
  deadline: string | null;
  confirmedAt?: string | null;
  studentCode?: string | null;
}

const tz = { timeZone: "Asia/Ho_Chi_Minh" } as const;
const dmy = (ymd: string | null | undefined) => (ymd ? ymd.slice(0, 10).split("-").reverse().join("/") : "");
const vnTime = (iso: string) => new Date(iso).toLocaleString("vi-VN", { ...tz, hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
const GENDER: Record<string, string> = { NAM: "Nam", NU: "Nữ", KHAC: "Khác" };

function todayLine() {
  const d = new Date(new Date().toLocaleString("en-US", tz));
  return `An Giang, ngày ${String(d.getDate()).padStart(2, "0")} tháng ${String(d.getMonth() + 1).padStart(2, "0")} năm ${d.getFullYear()}`;
}

/** Nội dung 1 giấy báo (1 trang A4) */
function letter(l: LetterData, first: boolean): PdfContent[] {
  const degree = l.degreeLevel === "TIEN_SI" ? "tiến sĩ" : "thạc sĩ";
  const row = (label: string, value: string) => [{ text: label }, { text: value, bold: true }];
  const info: unknown[][] = [
    row("Họ và tên:", l.fullName.toUpperCase()),
    row("Ngày sinh:", `${dmy(l.dob)}${l.gender && GENDER[l.gender] ? `        Giới tính: ${GENDER[l.gender]}` : ""}`),
    ...(l.idNumber ? [row("Số CCCD:", l.idNumber)] : []),
    row("Mã hồ sơ:", l.applicationCode),
    row("Ngành trúng tuyển:", `${l.majorName} (mã ${l.majorCode})`),
    row("Trình độ:", degree.charAt(0).toUpperCase() + degree.slice(1)),
    ...(l.total !== null ? [row("Tổng điểm xét tuyển:", String(Math.round(l.total * 100) / 100).replace(".", ","))] : []),
  ];
  const steps = [
    `Xác nhận nhập học trên Cổng tuyển sinh sau đại học${l.deadline ? ` trước ${vnTime(l.deadline)}` : " trong thời hạn quy định"}. Quá hạn không xác nhận được xem như từ chối nhập học.`,
    "Nộp bản chính (hoặc bản sao chứng thực) văn bằng, bảng điểm, chứng chỉ đã khai khi đăng ký và giấy báo này tại Phòng Đào tạo Sau đại học để đối chiếu.",
    "Sau khi đối chiếu hồ sơ, Nhà trường hoàn tất thủ tục và cấp mã học viên trên Cổng tuyển sinh.",
  ];
  return [
    {
      columns: [
        { width: "42%", stack: [{ text: "ĐẠI HỌC QUỐC GIA TP. HỒ CHÍ MINH", fontSize: 9.5 }, { text: "TRƯỜNG ĐẠI HỌC AN GIANG", bold: true, fontSize: 10 }, { canvas: [{ type: "line", x1: 55, y1: 2, x2: 150, y2: 2, lineWidth: 0.7 }] }], alignment: "center" },
        { width: "58%", stack: [{ text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", bold: true, fontSize: 10 }, { text: "Độc lập - Tự do - Hạnh phúc", bold: true, fontSize: 10.5 }, { canvas: [{ type: "line", x1: 95, y1: 2, x2: 210, y2: 2, lineWidth: 0.7 }] }], alignment: "center" },
      ],
      ...(first ? {} : { pageBreak: "before" }),
    },
    { text: todayLine(), italics: true, alignment: "right", fontSize: 10.5, margin: [0, 10, 0, 0] },
    { text: "GIẤY BÁO TRÚNG TUYỂN", style: "title", margin: [0, 20, 0, 2] },
    { text: `Trình độ ${degree} — ${l.batchName}`, alignment: "center", italics: true },
    { text: "Trường Đại học An Giang trân trọng thông báo:", margin: [0, 18, 0, 6] },
    { table: { widths: [140, "*"], body: info }, layout: "noBorders", margin: [14, 0, 0, 0] },
    {
      text: [
        "đã ",
        { text: "TRÚNG TUYỂN", bold: true },
        ` trình độ ${degree} theo Quyết định số `,
        { text: l.decisionNo, bold: true },
        `${l.decisionDate ? ` ngày ${dmy(l.decisionDate)}` : ""} của Hiệu trưởng Trường Đại học An Giang.`,
      ],
      alignment: "justify",
      margin: [0, 10, 0, 0],
    },
    { text: "Thủ tục nhập học", bold: true, margin: [0, 14, 0, 4] },
    { ol: steps, alignment: "justify", margin: [10, 0, 0, 0] },
    ...(l.confirmedAt ? [{ text: `Thí sinh đã xác nhận nhập học lúc ${vnTime(l.confirmedAt)}.`, italics: true, margin: [0, 8, 0, 0] }] : []),
    ...(l.studentCode ? [{ text: [{ text: "Mã học viên: " }, { text: l.studentCode, bold: true }], margin: [0, 4, 0, 0] }] : []),
    {
      columns: [
        {
          width: 150,
          stack: [
            { qr: `GIAY BAO TRUNG TUYEN|${l.applicationCode}|QD ${l.decisionNo}|${l.decisionDate ?? ""}`, fit: 84 },
            { text: "Mã đối chiếu hồ sơ", fontSize: 8, color: "#555", margin: [0, 3, 0, 0] },
          ],
        },
        { width: "*", text: "" },
        {
          width: 230,
          stack: [
            { text: "PHÒNG ĐÀO TẠO SAU ĐẠI HỌC", bold: true },
            { text: "(Giấy báo được tạo tự động từ Cổng tuyển sinh sau đại học, căn cứ quyết định nêu trên)", italics: true, fontSize: 9, margin: [0, 2, 0, 0] },
          ],
          alignment: "center",
        },
      ],
      margin: [0, 26, 0, 0],
    },
  ];
}

/** Tạo 1 tệp PDF gồm các giấy báo (mỗi thí sinh 1 trang) rồi tải về */
export async function downloadAdmissionLetters(letters: LetterData[], fileName?: string) {
  if (!letters.length) throw new Error("Không có thí sinh nào để tạo giấy báo.");
  const blob = await makePdf({
    pageMargins: [56, 42, 48, 42],
    info: { title: "Giấy báo trúng tuyển", author: "Cổng tuyển sinh sau đại học" },
    defaultStyle: { fontSize: 12, lineHeight: 1.25 },
    styles: { title: { fontSize: 16, bold: true, alignment: "center" } },
    content: letters.flatMap((l, i) => letter(l, i === 0)),
  });
  const name = fileName ?? (letters.length === 1 ? `Giay-bao-trung-tuyen-${safeFileName(letters[0].applicationCode)}` : `Giay-bao-trung-tuyen-${letters.length}-thi-sinh`);
  saveBlob(blob, `${name}.pdf`);
}
