"use client";

// ============================================================================
// Yêu cầu 2 — Lưu điều kiện tuyển sinh thành tệp (PDF để công bố / in, Excel để tổng hợp).
// Dùng chung cho cán bộ (trang chi tiết đợt) và thí sinh (tab "Đợt đang mở đăng ký").
// Tệp được tạo ngay trên trình duyệt từ dữ liệu đợt đang hiển thị, không cần gọi thêm máy chủ.
// ============================================================================
import type { BatchDetail } from "./admin/api";
import type { OpenBatch } from "./announcements";
import { DOC_LABEL } from "./application";
import { makePdf, makeXlsx, safeFileName, saveBlob, type PdfContent } from "./cdn";
import type { DocumentType } from "./types";

type ExamFormat = "THI_VIET" | "PHONG_VAN" | "XET_HO_SO";

export interface ConditionsDoc {
  batchCode: string;
  batchName: string;
  degreeLevel: "THAC_SI" | "TIEN_SI";
  registrationStartAt: string;
  registrationEndAt: string;
  examStartAt: string | null;
  examEndAt: string | null;
  legalBasis: string | null;
  majors: {
    majorCode: string;
    majorName: string;
    facultyName: string | null;
    quota: number;
    conditions: { description: string; minGpa: number | null; requiredCertificate: string | null; isMandatory: boolean }[];
    subjects: { subjectName: string; examFormat: ExamFormat; weight: number | null; maxScore?: number | null }[];
  }[];
}

const DEGREE = { THAC_SI: "Thạc sĩ", TIEN_SI: "Tiến sĩ" } as const;
const FORMAT = { THI_VIET: "Thi viết", PHONG_VAN: "Phỏng vấn", XET_HO_SO: "Xét hồ sơ" } as const;

/** Hồ sơ bắt buộc theo bậc — giống backend/src/common/documents.ts */
const BASE_DOCS: DocumentType[] = ["DON_DANG_KY", "SO_YEU_LY_LICH", "LY_LICH_CHUYEN_MON", "ANH_THE", "VAN_BANG", "BANG_DIEM", "CCCD"];
const PHD_DOCS: DocumentType[] = ["DE_CUONG_NCS", "THU_GIOI_THIEU"];
const OPTIONAL_NOTE =
  "Chứng chỉ ngoại ngữ (nếu đăng ký diện đã có chứng chỉ); giấy tờ nếu có: giấy giới thiệu, chứng chỉ AI, giấy xác nhận ưu tiên, công nhận văn bằng nước ngoài, công bố khoa học.";

export function requiredDocLabels(degree: "THAC_SI" | "TIEN_SI"): string[] {
  const list = degree === "TIEN_SI" ? [...BASE_DOCS, ...PHD_DOCS] : BASE_DOCS;
  return list.map((t) => (t === "VAN_BANG" && degree === "TIEN_SI" ? "Bằng tốt nghiệp thạc sĩ (và đại học)" : DOC_LABEL[t]));
}

export function fromOpenBatch(b: OpenBatch): ConditionsDoc {
  return { ...b, majors: b.majors.map((m) => ({ ...m, subjects: m.subjects.map((s) => ({ ...s, maxScore: null })) })) };
}

export function fromBatchDetail(d: BatchDetail): ConditionsDoc {
  const b = d.batch;
  return {
    batchCode: b.batchCode,
    batchName: b.batchName,
    degreeLevel: b.degreeLevel,
    registrationStartAt: b.registrationStartAt,
    registrationEndAt: b.registrationEndAt,
    examStartAt: b.examStartAt,
    examEndAt: b.examEndAt,
    legalBasis: b.legalBasis,
    majors: d.majors.map((m) => ({
      majorCode: m.major.majorCode,
      majorName: m.major.majorName,
      facultyName: m.major.facultyName,
      quota: m.quota,
      conditions: m.conditions.map((c) => ({ description: c.description, minGpa: c.minGpa, requiredCertificate: c.requiredCertificate, isMandatory: c.isMandatory })),
      subjects: m.subjects.map((s) => ({ subjectName: s.subjectName, examFormat: s.examFormat, weight: s.weight, maxScore: s.maxScore })),
    })),
  };
}

// ---------------------------------------------------------------------------- định dạng
const tz = { timeZone: "Asia/Ho_Chi_Minh" } as const;
const dmy = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("vi-VN", { ...tz, day: "2-digit", month: "2-digit", year: "numeric" }) : "");
const dmyhm = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("vi-VN", { ...tz, hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }) : "";
/** Trọng số lưu dạng 0,5 hoặc 50 -> "50%" */
const pct = (w: number | null) => (w === null || w === undefined ? "" : `${Math.round((w <= 1 ? w * 100 : w) * 10) / 10}%`.replace(".", ","));
const gpa = (g: number | null) => (g === null ? "" : String(g).replace(".", ","));

function conditionText(c: ConditionsDoc["majors"][number]["conditions"][number]) {
  const extra = [c.minGpa !== null ? `điểm trung bình tích lũy tối thiểu ${gpa(c.minGpa)}` : "", c.requiredCertificate ? `yêu cầu: ${c.requiredCertificate}` : ""].filter(Boolean);
  const text = c.description.trim().replace(/[.;]+$/, "");
  return `${text}${extra.length ? ` (${extra.join("; ")})` : ""}${c.isMandatory ? "" : " — không bắt buộc"}.`;
}

function examPeriod(d: ConditionsDoc) {
  if (!d.examStartAt && !d.examEndAt) return "Theo thông báo của Phòng Đào tạo Sau đại học";
  return [dmy(d.examStartAt), dmy(d.examEndAt)].filter(Boolean).join(" – ");
}

function baseName(d: ConditionsDoc) {
  return `Dieu-kien-tuyen-sinh-${safeFileName(d.batchCode)}`;
}

// ---------------------------------------------------------------------------- PDF
export async function exportConditionsPdf(d: ConditionsDoc) {
  const degree = DEGREE[d.degreeLevel];
  const totalQuota = d.majors.reduce((s, m) => s + m.quota, 0);
  const cell = (text: string, opts: Record<string, unknown> = {}) => ({ text, ...opts });
  const head = (text: string) => ({ text, style: "th" });

  const content: PdfContent[] = [
    {
      columns: [
        { width: "42%", stack: [{ text: "ĐẠI HỌC QUỐC GIA TP. HỒ CHÍ MINH", fontSize: 9 }, { text: "TRƯỜNG ĐẠI HỌC AN GIANG", bold: true, fontSize: 9.5 }, { text: "PHÒNG ĐÀO TẠO SAU ĐẠI HỌC", bold: true, fontSize: 9.5 }], alignment: "center" },
        { width: "58%", stack: [{ text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", bold: true, fontSize: 9.5 }, { text: "Độc lập - Tự do - Hạnh phúc", bold: true, fontSize: 10 }], alignment: "center" },
      ],
    },
    { text: "ĐIỀU KIỆN VÀ CHỈ TIÊU TUYỂN SINH", style: "title", margin: [0, 22, 0, 2] },
    { text: `Trình độ ${degree.toLowerCase()} — ${d.batchName}`, alignment: "center", italics: true },
    { text: `Mã đợt: ${d.batchCode}`, alignment: "center", fontSize: 9.5, color: "#444", margin: [0, 2, 0, 12] },

    { text: "I. THÔNG TIN CHUNG", style: "h2" },
    {
      table: {
        widths: [150, "*"],
        body: [
          [cell("Thời gian nhận hồ sơ", { bold: true }), cell(`Từ ${dmyhm(d.registrationStartAt)} đến ${dmyhm(d.registrationEndAt)}`)],
          [cell("Thời gian thi / xét tuyển", { bold: true }), cell(examPeriod(d))],
          [cell("Hình thức nộp hồ sơ", { bold: true }), cell("Trực tuyến trên Cổng tuyển sinh sau đại học (khai thông tin, tải minh chứng, nộp lệ phí).")],
          [cell("Căn cứ", { bold: true }), cell(d.legalBasis || "Quy chế tuyển sinh và đào tạo trình độ " + degree.toLowerCase() + " hiện hành.")],
        ],
      },
      layout: "lightHorizontalLines",
      fontSize: 10,
    },

    { text: "II. NGÀNH TUYỂN SINH VÀ CHỈ TIÊU", style: "h2" },
    {
      table: {
        headerRows: 1,
        widths: [24, 62, "*", 120, 46],
        body: [
          [head("STT"), head("Mã ngành"), head("Tên ngành"), head("Khoa / Viện"), head("Chỉ tiêu")],
          ...d.majors.map((m, i) => [cell(String(i + 1), { alignment: "center" }), cell(m.majorCode), cell(m.majorName, { bold: true }), cell(m.facultyName ?? ""), cell(String(m.quota), { alignment: "right" })]),
          [{ text: "Tổng chỉ tiêu", colSpan: 4, bold: true, alignment: "right" }, {}, {}, {}, cell(String(totalQuota), { bold: true, alignment: "right" })],
        ],
      },
      fontSize: 10,
    },

    { text: "III. ĐIỀU KIỆN DỰ TUYỂN VÀ HÌNH THỨC XÉT TUYỂN THEO NGÀNH", style: "h2" },
    ...d.majors.flatMap((m, i) => [
      { text: `${i + 1}. ${m.majorName} (mã ${m.majorCode})${m.facultyName ? ` — ${m.facultyName}` : ""}`, bold: true, margin: [0, 6, 0, 3] },
      { text: "Điều kiện dự tuyển:", italics: true, fontSize: 10 },
      m.conditions.length
        ? { ul: m.conditions.map(conditionText), fontSize: 10, margin: [8, 1, 0, 4] }
        : { text: "Theo quy chế tuyển sinh chung của đợt.", fontSize: 10, margin: [8, 1, 0, 4] },
      { text: "Hình thức xét tuyển:", italics: true, fontSize: 10 },
      m.subjects.length
        ? {
            table: {
              headerRows: 1,
              widths: ["*", 90, 60, 60],
              body: [
                [head("Môn / nội dung"), head("Hình thức"), head("Trọng số"), head("Thang điểm")],
                ...m.subjects.map((s) => [cell(s.subjectName), cell(FORMAT[s.examFormat] ?? s.examFormat), cell(pct(s.weight), { alignment: "center" }), cell(s.maxScore ? String(s.maxScore) : "10", { alignment: "center" })]),
              ],
            },
            fontSize: 9.5,
            margin: [8, 2, 0, 4],
          }
        : { text: "Xét hồ sơ.", fontSize: 10, margin: [8, 1, 0, 4] },
    ]),

    { text: "IV. HỒ SƠ ĐĂNG KÝ DỰ TUYỂN", style: "h2" },
    { ol: requiredDocLabels(d.degreeLevel), fontSize: 10, margin: [8, 0, 0, 2] },
    { text: OPTIONAL_NOTE, fontSize: 9.5, italics: true, margin: [8, 2, 0, 0] },
    { text: "Bản scan cần rõ nét, đủ trang, có dấu và chữ ký; PDF, JPG hoặc PNG, tối đa 5MB mỗi tệp.", fontSize: 9.5, margin: [8, 2, 0, 0] },

    { text: "Thông tin chi tiết và đăng ký: Cổng tuyển sinh sau đại học — Phòng Đào tạo Sau đại học, Trường Đại học An Giang, ĐHQG-HCM.", fontSize: 9.5, color: "#444", margin: [0, 14, 0, 0] },
  ];

  const blob = await makePdf({
    pageMargins: [48, 40, 40, 44],
    info: { title: `Điều kiện tuyển sinh ${d.batchCode}`, author: "Cổng tuyển sinh sau đại học" },
    defaultStyle: { fontSize: 10.5, lineHeight: 1.2 },
    styles: {
      title: { fontSize: 15, bold: true, alignment: "center" },
      h2: { fontSize: 11, bold: true, color: "#142B4D", margin: [0, 12, 0, 5] },
      th: { bold: true, fillColor: "#EEF2F7", fontSize: 9.5 },
    },
    footer: (page, count) => ({
      columns: [
        { text: `Tạo từ Cổng tuyển sinh sau đại học ngày ${dmy(new Date().toISOString())}`, fontSize: 8, color: "#777" },
        { text: `Trang ${page}/${count}`, alignment: "right", fontSize: 8, color: "#777" },
      ],
      margin: [48, 14, 40, 0],
    }),
    content,
  });
  saveBlob(blob, `${baseName(d)}.pdf`);
}

// ---------------------------------------------------------------------------- Excel
export async function exportConditionsXlsx(d: ConditionsDoc) {
  const degree = DEGREE[d.degreeLevel];
  const blob = await makeXlsx([
    {
      name: "Thông tin đợt",
      cols: [28, 90],
      rows: [
        ["ĐIỀU KIỆN VÀ CHỈ TIÊU TUYỂN SINH", ""],
        ["Đợt tuyển sinh", d.batchName],
        ["Mã đợt", d.batchCode],
        ["Trình độ", degree],
        ["Nhận hồ sơ từ", dmyhm(d.registrationStartAt)],
        ["Nhận hồ sơ đến", dmyhm(d.registrationEndAt)],
        ["Thời gian thi / xét tuyển", examPeriod(d)],
        ["Căn cứ", d.legalBasis ?? ""],
        ["Tổng chỉ tiêu", d.majors.reduce((s, m) => s + m.quota, 0)],
        ["Ngày tạo tệp", dmyhm(new Date().toISOString())],
      ],
    },
    {
      name: "Ngành - chỉ tiêu",
      cols: [6, 12, 40, 32, 10],
      rows: [["STT", "Mã ngành", "Tên ngành", "Khoa / Viện", "Chỉ tiêu"], ...d.majors.map((m, i) => [i + 1, m.majorCode, m.majorName, m.facultyName ?? "", m.quota])],
    },
    {
      name: "Điều kiện dự tuyển",
      cols: [12, 36, 70, 14, 30, 12],
      rows: [
        ["Mã ngành", "Tên ngành", "Điều kiện", "GPA tối thiểu", "Chứng chỉ yêu cầu", "Bắt buộc"],
        ...d.majors.flatMap((m) => m.conditions.map((c) => [m.majorCode, m.majorName, c.description, c.minGpa, c.requiredCertificate ?? "", c.isMandatory ? "Có" : "Không"])),
      ],
    },
    {
      name: "Hình thức xét tuyển",
      cols: [12, 36, 40, 14, 10, 12],
      rows: [
        ["Mã ngành", "Tên ngành", "Môn / nội dung", "Hình thức", "Trọng số", "Thang điểm"],
        ...d.majors.flatMap((m) => m.subjects.map((s) => [m.majorCode, m.majorName, s.subjectName, FORMAT[s.examFormat] ?? s.examFormat, pct(s.weight), s.maxScore ?? 10])),
      ],
    },
    {
      name: "Hồ sơ cần nộp",
      cols: [6, 70],
      rows: [["STT", "Giấy tờ"], ...requiredDocLabels(d.degreeLevel).map((x, i) => [i + 1, x]), ["", OPTIONAL_NOTE]],
    },
  ]);
  saveBlob(blob, `${baseName(d)}.xlsx`);
}
