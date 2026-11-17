// Kiểm thử API: lỗi bảo mật đăng nhập / đăng ký (lỗi 1, 2, 3, 6). Xem qa/kiem-thu-api/README.md
const BE = process.env.BE || require("path").join(__dirname, "..", "..", "backend");
const { PrismaClient } = require(BE + "/node_modules/@prisma/client");
const db = new PrismaClient();
const B = process.env.API || "http://localhost:4100/api/v1";
const tag = Date.now().toString().slice(-6);
let ok = 0, bad = 0;
const check = (name, cond, extra = "") => { (cond ? ok++ : bad++); console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${cond ? "" : extra}`); };
async function call(method, path, body, token) {
  const r = await fetch(B + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
}
const reg = (email, phone, password) => call("POST", "/auth/register", { fullName: "Thi Sinh Thu", dob: "1999-01-01", email, phoneNumber: phone, password, agreePrivacy: true });
const phone = () => "09" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");

(async () => {
  // 1. Ghi đè mật khẩu đăng ký đang chờ + Google chiếm tài khoản
  const e1 = `victim${tag}@example.test`, p1 = phone();
  await db.security_counter.deleteMany({ where: { counter_key: { startsWith: "rl:" } } });
  let r = await reg(e1, p1, "KeTanCong1");
  check("đăng ký lần đầu", r.s === 200 || r.s === 201, JSON.stringify(r.j));
  const otp1 = r.j?.devOtp;
  r = await reg(e1, phone(), "KhacMatKhau2");
  check("đăng ký lại bằng mật khẩu khác khi mã còn hạn -> REGISTRATION_PENDING", r.j?.error_code === "REGISTRATION_PENDING", JSON.stringify(r.j));
  r = await reg(e1, p1, "KeTanCong1");
  // Đúng mật khẩu cũ: không bị chặn REGISTRATION_PENDING (có thể chỉ phải đợi 60 giây mới gửi lại mã)
  check("chính người đó đăng ký lại (đúng mật khẩu) không bị chặn", r.s < 300 || r.j?.error_code === "OTP_RESEND_TOO_SOON", JSON.stringify(r.j));
  r = await call("POST", "/auth/register/verify", { email: e1, otp: otp1, password: "SaiMatKhau9" });
  check("xác thực kèm mật khẩu không khớp -> REGISTRATION_CHANGED", r.j?.error_code === "REGISTRATION_CHANGED", JSON.stringify(r.j));
  r = await call("POST", "/auth/google", { idToken: "dev:" + e1 });
  check("Google (dev) kích hoạt tài khoản đang chờ", r.s < 300 && r.j?.accessToken, JSON.stringify(r.j));
  const acc1 = await db.candidate_account.findFirst({ where: { email: e1 } });
  console.log("      (dev token: verifiedByGoogle =", acc1.password_hash === null ? "true -> đã xóa mật khẩu" : "false -> giữ mật khẩu", ")");

  // 2. Chiếm số điện thoại
  const e2 = `squat${tag}@example.test`, e3 = `owner${tag}@example.test`, p2 = phone();
  r = await reg(e2, p2, "GiuCho1234");
  r = await reg(e3, p2, "ChuThat1234");
  check("SĐT đang bị đăng ký chờ (mã còn hạn) giữ -> DUPLICATE_PHONE", r.j?.error_code === "DUPLICATE_PHONE", JSON.stringify(r.j));
  const acc2 = await db.candidate_account.findFirst({ where: { email: e2 } });
  await db.otp_verification.updateMany({ where: { account_id: acc2.account_id }, data: { expires_at: new Date(Date.now() - 1000) } });
  r = await reg(e3, p2, "ChuThat1234");
  check("mã của người giữ chỗ hết hạn -> chủ thật đăng ký được SĐT", r.s < 300, JSON.stringify(r.j));
  const acc2b = await db.candidate_account.findFirst({ where: { email: e2 } });
  check("SĐT bị gỡ khỏi tài khoản giữ chỗ", acc2b.phone_number !== p2, acc2b.phone_number);

  // 3. Đổi/đặt lại mật khẩu thu hồi token cũ
  const e4 = `token${tag}@example.test`;
  r = await reg(e4, phone(), "MatKhauCu1");
  r = await call("POST", "/auth/register/verify", { email: e4, otp: r.j.devOtp, password: "MatKhauCu1" });
  const t1 = r.j?.accessToken;
  check("xác thực đăng ký thành công", !!t1, JSON.stringify(r.j));
  r = await call("GET", "/candidates/me", null, t1);
  check("token mới dùng được", r.s === 200, r.s);
  r = await call("POST", "/auth/forgot-password", { emailOrPhone: e4 });
  r = await call("POST", "/auth/reset-password", { emailOrPhone: e4, otp: r.j.devOtp, newPassword: "MatKhauMoi2" });
  check("đặt lại mật khẩu", r.s < 300, JSON.stringify(r.j));
  r = await call("GET", "/candidates/me", null, t1);
  check("token cũ bị từ chối sau khi đặt lại mật khẩu (401)", r.s === 401, `${r.s} ${JSON.stringify(r.j)}`);
  r = await call("POST", "/auth/login", { emailOrPhone: e4, password: "MatKhauMoi2" });
  check("đăng nhập bằng mật khẩu mới", !!r.j?.accessToken, JSON.stringify(r.j));

  // 6. Đếm nhập sai OTP lưu trong CSDL
  const e5 = `otp${tag}@example.test`;
  r = await reg(e5, phone(), "OtpThu1234");
  const good = r.j.devOtp, wrongCode = good === "000000" ? "111111" : "000000";
  for (let i = 0; i < 4; i++) r = await call("POST", "/auth/register/verify", { email: e5, otp: wrongCode });
  const acc5 = await db.candidate_account.findFirst({ where: { email: e5 } });
  const otpRow = await db.otp_verification.findFirst({ where: { account_id: acc5.account_id }, orderBy: { otp_id: "desc" } });
  const cnt = await db.security_counter.findUnique({ where: { counter_key: "otp:" + otpRow.otp_id } });
  check("bộ đếm sai OTP nằm trong bảng security_counter (4 lần)", cnt?.hits === 4, JSON.stringify(cnt));
  r = await call("POST", "/auth/register/verify", { email: e5, otp: wrongCode });
  check("lần sai thứ 5 hủy mã", r.j?.error_code === "OTP_LOCKED", JSON.stringify(r.j));
  r = await call("POST", "/auth/register/verify", { email: e5, otp: good });
  check("sau 5 lần sai, mã đúng cũng bị từ chối", r.s >= 400, JSON.stringify(r.j));

  console.log(`\n${ok} PASS, ${bad} FAIL`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
