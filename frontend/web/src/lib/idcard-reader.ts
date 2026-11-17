"use client";

// ============================================================================
// Đọc tự động CCCD / văn bằng ngay trong trình duyệt (ảnh KHÔNG gửi lên máy chủ):
//   1. Thử đọc mã QR trên CCCD gắn chip (jsQR) — chính xác tuyệt đối.
//   2. Không có QR thì nhận dạng chữ (OCR, Tesseract tiếng Việt) rồi tách số CCCD, ngày cấp...
// Thư viện và dữ liệu ngôn ngữ chỉ được tải (từ CDN jsDelivr) khi bấm dùng lần đầu,
// không làm nặng trang. Tệp PDF: lấy trang 1 bằng pdf.js.
// ============================================================================
import { CDN, globalLib as g, loadScript } from "./cdn";
import { findInDocument, parseCccdQr, parseCccdText, type DocumentFindings, type IdCardFields } from "./idcard-parse";

type JsQR = (data: Uint8ClampedArray, w: number, h: number, opts?: { inversionAttempts?: string }) => { data: string } | null;
interface TesseractLike {
  recognize: (img: HTMLCanvasElement, lang: string, opts?: { logger?: (m: { status: string; progress: number }) => void }) => Promise<{ data: { text: string } }>;
}
interface PdfJsLike {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: { data: ArrayBuffer }) => { promise: Promise<{ getPage: (n: number) => Promise<PdfPage> }> };
}
interface PdfPage {
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
}

/** Ảnh hoặc PDF (trang 1) -> canvas, cạnh dài tối đa maxSide px */
async function toCanvas(file: Blob, maxSide = 2000): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  if (file.type === "application/pdf") {
    await loadScript(CDN.pdfjs);
    const pdfjs = g<PdfJsLike>("pdfjsLib");
    pdfjs.GlobalWorkerOptions.workerSrc = CDN.pdfWorker;
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(3, maxSide / Math.max(base.width, base.height)) });
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
    return canvas;
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Không mở được ảnh. Dùng ảnh JPG hoặc PNG."));
      i.src = url;
    });
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.round(img.naturalWidth * k);
    canvas.height = Math.round(img.naturalHeight * k);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

interface ZXingLike {
  readBarcodes: (img: ImageData, opts: Record<string, unknown>) => Promise<{ text: string }[]>;
}

/** Cắt một vùng (tỉ lệ 0–1) của ảnh và co / phóng để cạnh dài bằng maxSide */
function cropRegion(canvas: HTMLCanvasElement, fx: number, fy: number, fw: number, fh: number, maxSide: number): ImageData {
  const sw = Math.round(canvas.width * fw);
  const sh = Math.round(canvas.height * fh);
  const scale = Math.min(3, maxSide / Math.max(sw, sh)) || 1;
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(sw * scale));
  c.height = Math.max(1, Math.round(sh * scale));
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, Math.round(canvas.width * fx), Math.round(canvas.height * fy), sw, sh, 0, 0, c.width, c.height);
  return ctx.getImageData(0, 0, c.width, c.height);
}

/** Các vùng cần thử: cả ảnh, rồi lưới ô 1/2 và 1/3 chồng lên nhau (QR trên ảnh chụp thường nhỏ, nằm bất kỳ đâu) */
function regions(): [number, number, number, number][] {
  const out: [number, number, number, number][] = [[0, 0, 1, 1]];
  for (const f of [0.5, 0.34])
    for (let y = 0; y <= 1 - f + 1e-9; y += f / 2) for (let x = 0; x <= 1 - f + 1e-9; x += f / 2) out.push([x, y, f, f]);
  return out;
}

/** Đọc QR bằng ZXing: cả ảnh gốc, rồi từng vùng ở 2 cỡ (phóng to giúp đọc được QR nhỏ trong ảnh chụp) */
async function readQrZxing(canvas: HTMLCanvasElement): Promise<string | null> {
  await loadScript(CDN.zxing);
  const zx = g<ZXingLike>("ZXingWASM");
  const opts = { formats: ["QRCode"], tryHarder: true, tryDownscale: true, binarizer: "LocalAverage", maxNumberOfSymbols: 1 };
  const full = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
  const first = await zx.readBarcodes(full, opts);
  if (first[0]?.text) return first[0].text;
  for (const maxSide of [1200, 2400])
    for (const [fx, fy, fw, fh] of regions()) {
      const r = await zx.readBarcodes(cropRegion(canvas, fx, fy, fw, fh, maxSide), opts);
      if (r[0]?.text) return r[0].text;
    }
  return null;
}

/** Thử đọc QR: ZXing trước (mạnh hơn), không được thì dùng jsQR như cũ */
async function readQr(canvas: HTMLCanvasElement): Promise<string | null> {
  const z = await readQrZxing(canvas).catch(() => null);
  if (z) return z;
  return readQrJsqr(canvas);
}

/** Cách cũ: jsQR trên cả ảnh và từng góc phóng to */
async function readQrJsqr(canvas: HTMLCanvasElement): Promise<string | null> {
  await loadScript(CDN.jsqr);
  const jsQR = g<JsQR>("jsQR");
  const tries: [number, number, number, number][] = [
    [0, 0, 1, 1],
    [0.5, 0, 0.5, 0.5],
    [0.55, 0, 0.45, 0.6],
    [0, 0, 0.5, 0.5],
    [0.5, 0.5, 0.5, 0.5],
    [0, 0.5, 0.5, 0.5],
  ];
  for (const [fx, fy, fw, fh] of tries) {
    const sw = Math.round(canvas.width * fw);
    const sh = Math.round(canvas.height * fh);
    const scale = Math.min(3, 1000 / Math.max(sw, sh)) || 1;
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(sw * scale));
    c.height = Math.max(1, Math.round(sh * scale));
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, Math.round(canvas.width * fx), Math.round(canvas.height * fy), sw, sh, 0, 0, c.width, c.height);
    const res = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height, { inversionAttempts: "attemptBoth" });
    if (res?.data) return res.data;
  }
  return null;
}

async function readText(canvas: HTMLCanvasElement, onProgress?: (msg: string) => void): Promise<string> {
  onProgress?.("Đang tải bộ nhận dạng chữ tiếng Việt (lần đầu mất vài giây)…");
  await loadScript(CDN.tesseract);
  const T = g<TesseractLike>("Tesseract");
  const res = await T.recognize(canvas, "vie", {
    logger: (m) => {
      if (m.status === "recognizing text") onProgress?.(`Đang nhận dạng chữ… ${Math.round(m.progress * 100)}%`);
    },
  });
  return res.data.text;
}

export interface IdCardResult {
  source: "QR" | "OCR";
  fields: IdCardFields;
  text?: string;
}

/** Thí sinh: đọc ảnh CCCD (mặt trước có QR là tốt nhất, hoặc mặt sau để lấy ngày cấp, nơi cấp) */
export async function readIdCard(file: Blob, onProgress?: (msg: string) => void): Promise<IdCardResult> {
  onProgress?.("Đang mở ảnh…");
  // Giữ ảnh lớn hơn (3000px) để mã QR nhỏ trong ảnh chụp điện thoại vẫn đủ chi tiết
  const canvas = await toCanvas(file, 3000);
  onProgress?.("Đang tìm mã QR trên thẻ…");
  const qr = await readQr(canvas).catch(() => null);
  const fromQr = qr ? parseCccdQr(qr) : null;
  if (fromQr) return { source: "QR", fields: fromQr };
  const text = await readText(canvas, onProgress);
  return { source: "OCR", fields: parseCccdText(text), text };
}

export interface DocumentReadResult extends DocumentFindings {
  source: "QR" | "OCR";
  qrFields?: IdCardFields;
}

/** Cán bộ: đọc tệp minh chứng (ảnh / PDF trang 1) để đối chiếu số CCCD, số hiệu văn bằng, họ tên */
export async function readDocumentForCheck(file: Blob, fullName: string, onProgress?: (msg: string) => void): Promise<DocumentReadResult> {
  onProgress?.("Đang mở tệp…");
  const canvas = await toCanvas(file);
  const qr = await readQr(canvas).catch(() => null);
  const fromQr = qr ? parseCccdQr(qr) : null;
  if (fromQr) {
    return {
      source: "QR",
      qrFields: fromQr,
      idNumbers: fromQr.idNumber ? [fromQr.idNumber] : [],
      nameFound: findInDocument(fromQr.fullName ?? "", fullName).nameFound,
    };
  }
  const text = await readText(canvas, onProgress);
  return { source: "OCR", ...findInDocument(text, fullName) };
}
