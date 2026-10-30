/**
 * Chuỗi kết nối CSDL do nhà cung cấp đưa (VD Aiven: "...?ssl-mode=REQUIRED") dùng cú pháp của
 * công cụ mysql, Prisma không hiểu nên kết nối không mã hóa và bị máy chủ từ chối.
 * Đổi sang tham số của Prisma: sslaccept=accept_invalid_certs (vẫn mã hóa TLS, bỏ qua kiểm tra
 * chứng chỉ riêng của nhà cung cấp). Chuỗi không có ssl-mode thì giữ nguyên.
 */
export function normalizeDatabaseUrl(): void {
  const url = process.env.DATABASE_URL;
  if (!url || !/[?&]ssl-?mode=/i.test(url) || /[?&]sslaccept=/i.test(url)) return;
  const [base, query = ""] = url.split("?");
  const params = query.split("&").filter((p) => p && !/^ssl-?mode=/i.test(p));
  const required = /ssl-?mode=(required|verify_ca|verify_identity)/i.test(url);
  if (required) params.push("sslaccept=accept_invalid_certs");
  process.env.DATABASE_URL = params.length ? `${base}?${params.join("&")}` : base;
}
