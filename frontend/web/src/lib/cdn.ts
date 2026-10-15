"use client";

// ============================================================================
// Tải thư viện từ CDN jsDelivr khi cần (không cài qua npm để trang nhẹ, chỉ tải khi người dùng bấm).
// Dùng cho: đọc CCCD (jsQR, Tesseract, pdf.js), tạo PDF (pdfmake), tạo Excel (SheetJS).
// ============================================================================
export const CDN = {
  jsqr: "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js",
  tesseract: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js",
  pdfjs: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
  pdfWorker: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js",
  pdfmake: "https://cdn.jsdelivr.net/npm/pdfmake@0.2.10/build/pdfmake.min.js",
  pdfmakeFonts: "https://cdn.jsdelivr.net/npm/pdfmake@0.2.10/build/vfs_fonts.js",
  xlsx: "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
};

const loaded = new Map<string, Promise<void>>();

/** Nạp 1 thẻ script (mỗi địa chỉ chỉ nạp 1 lần); lỗi mạng thì cho phép thử lại */
export function loadScript(src: string): Promise<void> {
  if (!loaded.has(src)) {
    loaded.set(
      src,
      new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.crossOrigin = "anonymous";
        s.onload = () => resolve();
        s.onerror = () => {
          loaded.delete(src);
          s.remove();
          reject(new Error("Không tải được công cụ tạo tệp. Kiểm tra kết nối mạng rồi thử lại."));
        };
        document.head.appendChild(s);
      }),
    );
  }
  return loaded.get(src)!;
}

/** Biến toàn cục do thư viện CDN gắn vào window */
export function globalLib<T>(name: string): T {
  return (window as unknown as Record<string, T>)[name];
}

/** Lưu Blob thành tệp tải về */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Tên tệp an toàn: bỏ dấu, thay ký tự lạ bằng "-" */
export function safeFileName(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------- pdfmake
/* Kiểu tối thiểu của pdfmake (thư viện nạp từ CDN, không có sẵn kiểu TypeScript) */
export type PdfContent = unknown;
export interface PdfDoc {
  pageSize?: string;
  pageMargins?: [number, number, number, number];
  content: PdfContent[];
  defaultStyle?: Record<string, unknown>;
  styles?: Record<string, Record<string, unknown>>;
  footer?: (currentPage: number, pageCount: number) => PdfContent;
  info?: Record<string, string>;
}
interface PdfMake {
  createPdf: (doc: PdfDoc) => { getBlob: (cb: (b: Blob) => void) => void };
}

/** Tạo PDF (font Roboto có đủ dấu tiếng Việt) và trả về Blob */
export async function makePdf(doc: PdfDoc): Promise<Blob> {
  await loadScript(CDN.pdfmake);
  await loadScript(CDN.pdfmakeFonts);
  const pdfMake = globalLib<PdfMake>("pdfMake");
  return new Promise<Blob>((resolve) => pdfMake.createPdf({ pageSize: "A4", ...doc }).getBlob(resolve));
}

// ---------------------------------------------------------------------------- SheetJS
interface SheetJs {
  utils: {
    book_new: () => unknown;
    aoa_to_sheet: (rows: unknown[][]) => Record<string, unknown>;
    book_append_sheet: (wb: unknown, ws: unknown, name: string) => void;
  };
  write: (wb: unknown, opts: { bookType: "xlsx"; type: "array" }) => ArrayBuffer;
}

/** Tạo tệp Excel nhiều trang tính; cols = độ rộng cột (số ký tự) cho từng trang */
export async function makeXlsx(sheets: { name: string; rows: (string | number | null)[][]; cols?: number[] }[]): Promise<Blob> {
  await loadScript(CDN.xlsx);
  const XLSX = globalLib<SheetJs>("XLSX");
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    if (s.cols) ws["!cols"] = s.cols.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
