"use client";

import { useMemo } from "react";
import { encodeQr } from "@/lib/qr";
import { vietQrPayload } from "@/lib/vietqr";

/**
 * Mã VietQR chuyển khoản: vẽ bằng SVG (sắc nét khi in/phóng to) và cho tải về ảnh PNG
 * để thí sinh dùng điện thoại mở app ngân hàng → Quét QR → chọn ảnh từ thư viện.
 */
export default function VietQrCode({
  bin,
  accountNo,
  amount,
  note,
  size = 220,
  fileName = "ma-qr-le-phi",
  caption,
}: {
  bin: string;
  accountNo: string;
  amount?: number;
  note?: string;
  size?: number;
  fileName?: string;
  caption?: string;
}) {
  const { matrix, error } = useMemo(() => {
    try {
      return { matrix: encodeQr(vietQrPayload({ bin, accountNo, amount, note })), error: "" };
    } catch (e) {
      return { matrix: null, error: (e as Error).message };
    }
  }, [bin, accountNo, amount, note]);

  if (!matrix) return <p className="text-xs text-danger">Không tạo được mã QR: {error}</p>;

  const quiet = 4;
  const n = matrix.length + quiet * 2;
  let d = "";
  matrix.forEach((row, y) => row.forEach((dark, x) => dark && (d += `M${x + quiet} ${y + quiet}h1v1h-1z`)));

  function download() {
    const scale = 10;
    const canvas = document.createElement("canvas");
    const pad = 48;
    canvas.width = n * scale;
    canvas.height = n * scale + (caption ? pad : 0);
    const ctx = canvas.getContext("2d");
    if (!ctx || !matrix) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000";
    matrix.forEach((row, y) => row.forEach((dark, x) => dark && ctx.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale)));
    if (caption) {
      ctx.fillStyle = "#142B4D";
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(caption, canvas.width / 2, n * scale + 30, canvas.width - 20);
    }
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${fileName}.png`;
    a.click();
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        viewBox={`0 0 ${n} ${n}`}
        width={size}
        height={size}
        shapeRendering="crispEdges"
        role="img"
        aria-label="Mã QR chuyển khoản lệ phí"
        className="rounded-input border border-gray-200 bg-white"
      >
        <rect width={n} height={n} fill="#fff" />
        <path d={d} fill="#000" />
      </svg>
      <button type="button" onClick={download} className="text-[13px] font-semibold text-accent hover:underline">
        Tải ảnh mã QR
      </button>
    </div>
  );
}
