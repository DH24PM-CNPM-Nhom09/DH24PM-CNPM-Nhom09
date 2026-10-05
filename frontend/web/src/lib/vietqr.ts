// ============================================================================
// Mã VietQR (chuẩn EMVCo của NAPAS) để chuyển khoản nhanh 24/7.
// Mọi app ngân hàng tại Việt Nam quét được; mã đã điền sẵn ngân hàng,
// số tài khoản, số tiền và nội dung chuyển khoản.
// ============================================================================

/** Ngân hàng hỗ trợ VietQR — bin là mã định danh ngân hàng trên mạng NAPAS */
export const BANKS: { bin: string; short: string; name: string }[] = [
  { bin: "970405", short: "Agribank", name: "Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam" },
  { bin: "970436", short: "Vietcombank", name: "Ngân hàng TMCP Ngoại thương Việt Nam" },
  { bin: "970415", short: "VietinBank", name: "Ngân hàng TMCP Công thương Việt Nam" },
  { bin: "970418", short: "BIDV", name: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam" },
  { bin: "970407", short: "Techcombank", name: "Ngân hàng TMCP Kỹ thương Việt Nam" },
  { bin: "970422", short: "MB", name: "Ngân hàng TMCP Quân đội" },
  { bin: "970416", short: "ACB", name: "Ngân hàng TMCP Á Châu" },
  { bin: "970432", short: "VPBank", name: "Ngân hàng TMCP Việt Nam Thịnh Vượng" },
  { bin: "970403", short: "Sacombank", name: "Ngân hàng TMCP Sài Gòn Thương Tín" },
  { bin: "970423", short: "TPBank", name: "Ngân hàng TMCP Tiên Phong" },
  { bin: "970441", short: "VIB", name: "Ngân hàng TMCP Quốc tế Việt Nam" },
  { bin: "970443", short: "SHB", name: "Ngân hàng TMCP Sài Gòn - Hà Nội" },
  { bin: "970437", short: "HDBank", name: "Ngân hàng TMCP Phát triển TP. Hồ Chí Minh" },
  { bin: "970448", short: "OCB", name: "Ngân hàng TMCP Phương Đông" },
  { bin: "970426", short: "MSB", name: "Ngân hàng TMCP Hàng Hải Việt Nam" },
  { bin: "970440", short: "SeABank", name: "Ngân hàng TMCP Đông Nam Á" },
  { bin: "970431", short: "Eximbank", name: "Ngân hàng TMCP Xuất Nhập khẩu Việt Nam" },
  { bin: "970449", short: "LPBank", name: "Ngân hàng TMCP Lộc Phát Việt Nam" },
  { bin: "970428", short: "Nam A Bank", name: "Ngân hàng TMCP Nam Á" },
  { bin: "970409", short: "Bac A Bank", name: "Ngân hàng TMCP Bắc Á" },
  { bin: "970452", short: "KienlongBank", name: "Ngân hàng TMCP Kiên Long" },
  { bin: "970400", short: "Saigonbank", name: "Ngân hàng TMCP Sài Gòn Công Thương" },
  { bin: "970438", short: "BaoViet Bank", name: "Ngân hàng TMCP Bảo Việt" },
  { bin: "970412", short: "PVcomBank", name: "Ngân hàng TMCP Đại Chúng Việt Nam" },
  { bin: "970425", short: "ABBANK", name: "Ngân hàng TMCP An Bình" },
  { bin: "970419", short: "NCB", name: "Ngân hàng TMCP Quốc Dân" },
  { bin: "970454", short: "BVBank", name: "Ngân hàng TMCP Bản Việt" },
  { bin: "970430", short: "PGBank", name: "Ngân hàng TMCP Thịnh vượng và Phát triển" },
  { bin: "970406", short: "DongA Bank", name: "Ngân hàng TMCP Đông Á" },
  { bin: "970446", short: "Co-opBank", name: "Ngân hàng Hợp tác xã Việt Nam" },
];

export function bankByBin(bin: string | null | undefined) {
  return BANKS.find((b) => b.bin === bin) ?? null;
}

/** CRC-16/CCITT-FALSE (khởi tạo 0xFFFF, đa thức 0x1021) — trường 63 của EMVCo */
function crc16(s: string) {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let k = 0; k < 8; k++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

/** Nội dung chuyển khoản an toàn cho mọi ngân hàng: không dấu, chỉ chữ, số, khoảng trắng */
export function cleanTransferNote(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 25);
}

/** Chuỗi dữ liệu VietQR: chuyển khoản tới tài khoản, có số tiền và nội dung */
export function vietQrPayload(o: { bin: string; accountNo: string; amount?: number; note?: string }) {
  const account = field("00", o.bin) + field("01", o.accountNo.replace(/\s/g, ""));
  const merchant = field("00", "A000000727") + field("01", account) + field("02", "QRIBFTTA");
  const amount = o.amount && o.amount > 0 ? String(Math.round(o.amount)) : "";
  const note = o.note ? cleanTransferNote(o.note) : "";
  const body =
    field("00", "01") +
    field("01", amount ? "12" : "11") +
    field("38", merchant) +
    field("53", "704") +
    (amount ? field("54", amount) : "") +
    field("58", "VN") +
    (note ? field("62", field("08", note)) : "") +
    "6304";
  return body + crc16(body);
}
