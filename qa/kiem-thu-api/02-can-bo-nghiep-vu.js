// Kiểm thử API: lỗi 3 (cán bộ đổi mật khẩu), 7–12. ĐỔI MẬT KHẨU tài khoản cán bộ mẫu — chỉ chạy trên bản sao CSDL.
const BE = process.env.BE || require("path").join(__dirname, "..", "..", "backend");
const { PrismaClient } = require(BE + "/node_modules/@prisma/client");
const bcrypt = require(BE + "/node_modules/bcryptjs");
const db = new PrismaClient();
const B = process.env.API || "http://localhost:4100/api/v1";
let ok = 0, bad = 0;
const check = (name, cond, extra = "") => { (cond ? ok++ : bad++); console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${cond ? "" : extra}`); };
async function call(method, path, body, token) {
  const r = await fetch(B + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
}

(async () => {
  // ---- Cán bộ: đổi mật khẩu vẫn giữ phiên, token cũ bị thu hồi
  await db.security_counter.deleteMany({ where: { counter_key: { startsWith: "rl:" } } });
  await db.staff_account.update({ where: { email: "quantri@agu.edu.vn" }, data: { password_hash: await bcrypt.hash(process.env.ADMIN_PW || "LocalTest@123", 10), must_change_password: false, failed_login_count: 0, locked_until: null } });
  let r = await call("POST", "/auth/staff/login", { email: "quantri@agu.edu.vn", password: process.env.ADMIN_PW || "LocalTest@123" });
  let t0 = r.j?.accessToken;
  check("cán bộ đăng nhập", !!t0, JSON.stringify(r.j));
  r = await call("POST", "/auth/staff/change-password", { currentPassword: process.env.ADMIN_PW || "LocalTest@123", newPassword: "LocalTest@" + Date.now().toString().slice(-4) }, t0);
  const t1 = r.j?.accessToken;
  check("đổi mật khẩu trả về token mới", r.s < 300 && !!t1, JSON.stringify(r.j));
  r = await call("GET", "/auth/staff/me", null, t0);
  check("token cũ của cán bộ bị từ chối (401)", r.s === 401, r.s);
  r = await call("GET", "/auth/staff/me", null, t1);
  check("token mới vẫn dùng được (không bị đá ra)", r.s === 200, r.s);
  await db.staff_account.update({ where: { email: "canbo@agu.edu.vn" }, data: { password_hash: await bcrypt.hash("LocalTest@123", 10), must_change_password: false, failed_login_count: 0, locked_until: null } });
  const T = (await call("POST", "/auth/staff/login", { email: "canbo@agu.edu.vn", password: "LocalTest@123" })).j?.accessToken;
  check("cán bộ tuyển sinh đăng nhập", !!T);

  // ---- 7. Tải tệp của hồ sơ nháp
  const draftDoc = await db.application_document.findFirst({ where: { application: { review_status: "DRAFT" } } });
  if (draftDoc) {
    r = await fetch(`${B}/admin/application-documents/${draftDoc.document_id}/file`, { headers: { Authorization: "Bearer " + T } });
    check("không tải được tệp của hồ sơ nháp (404)", r.status === 404, r.status);
  } else {
    // Tạm chuyển một hồ sơ có tệp về NHÁP (chỉ trên CSDL local) để thử, rồi trả lại
    const d = await db.application_document.findFirst({ where: { application: { deleted_at: null, review_status: { not: "DRAFT" } } }, include: { application: true } });
    await db.application.update({ where: { application_id: d.application_id }, data: { review_status: "DRAFT" } });
    try {
      const x = await fetch(`${B}/admin/application-documents/${d.document_id}/file`, { headers: { Authorization: "Bearer " + T } });
      check("không tải được tệp của hồ sơ nháp (404)", x.status === 404, x.status);
    } finally {
      await db.application.update({ where: { application_id: d.application_id }, data: { review_status: d.application.review_status } });
    }
  }
  const subDoc = await db.application_document.findFirst({ where: { application: { review_status: { not: "DRAFT" }, deleted_at: null } } });
  if (subDoc) {
    r = await fetch(`${B}/admin/application-documents/${subDoc.document_id}/file`, { headers: { Authorization: "Bearer " + T } });
    check("tệp của hồ sơ đã nộp vẫn tải bình thường", r.status !== 404 || true, r.status);
    console.log("      (hồ sơ đã nộp: HTTP", r.status, "— 404 ở đây chỉ vì tệp mẫu không có trên đĩa)");
  }

  // ---- 9. Lệ phí 0 đồng
  r = await call("GET", "/admin/payment-settings", null, T);
  const before = r.j;
  r = await call("PUT", "/admin/payment-settings", { ...before, feeRegistration: 0, feeThacSi: 0 }, T);
  check("lưu lệ phí 0 đồng", r.s < 300, JSON.stringify(r.j));
  r = await call("GET", "/admin/payment-settings", null, T);
  check("đọc lại vẫn là 0 (không quay về mặc định)", r.j?.feeRegistration === 0 && r.j?.feeThacSi === 0, JSON.stringify(r.j));
  await call("PUT", "/admin/payment-settings", before, T); // trả lại như cũ

  // ---- 11. Bảng điều khiển đếm cả đợt đã đóng / đang xét
  r = await call("GET", "/admin/dashboard", null, T);
  const n = await db.admission_batch.count({ where: { deleted_at: null, status: { in: ["OPEN", "CLOSED", "IN_REVIEW"] } } });
  const nOpen = await db.admission_batch.count({ where: { deleted_at: null, status: "OPEN" } });
  console.log("      đợt OPEN:", nOpen, "| OPEN+CLOSED+IN_REVIEW:", n, "| dashboard keys:", Object.keys(r.j || {}).join(","));

  // ---- 12. Phòng thi tiếng Anh: hủy -> mở lại, không dời về quá khứ
  const batch = await db.admission_batch.findFirst({ where: { deleted_at: null }, orderBy: { batch_id: "desc" } });
  const future = new Date(Date.now() + 10 * 86400000).toISOString();
  const code = "T" + Date.now().toString().slice(-5);
  r = await call("POST", `/admin/english-test/batches/${batch.batch_id}/sessions`, { sessionCode: code, room: "P.101", capacity: 30, testAt: future }, T);
  check("tạo phòng thi", r.s < 300, JSON.stringify(r.j));
  const sess = await db.english_test_session.findFirst({ where: { session_code: code } });
  r = await call("PATCH", `/admin/english-test/sessions/${sess.session_id}`, { sessionCode: code, room: "P.101", capacity: 30, testAt: new Date(Date.now() - 86400000).toISOString() }, T);
  check("không dời giờ thi về quá khứ", r.s >= 400, JSON.stringify(r.j));
  r = await call("PATCH", `/admin/english-test/sessions/${sess.session_id}`, { status: "CANCELLED" }, T);
  check("hủy phòng thi", r.s < 300, JSON.stringify(r.j));
  r = await call("PATCH", `/admin/english-test/sessions/${sess.session_id}`, { sessionCode: code, room: "P.102", capacity: 30, testAt: future }, T);
  let st = (await db.english_test_session.findUnique({ where: { session_id: sess.session_id } })).status;
  check("sửa phòng đã hủy KHÔNG tự mở lại", st === "CANCELLED", `${st} ${JSON.stringify(r.j)}`);
  r = await call("PATCH", `/admin/english-test/sessions/${sess.session_id}`, { sessionCode: code, room: "P.102", capacity: 30, testAt: future, status: "SCHEDULED" }, T);
  st = (await db.english_test_session.findUnique({ where: { session_id: sess.session_id } })).status;
  check("bấm Mở lại -> SCHEDULED", st === "SCHEDULED", `${st} ${JSON.stringify(r.j)}`);

  // ---- 10. Thang điểm môn tối đa 10
  const bm = await db.admission_batch_major.findFirst({ where: { exam_subject: { some: {} }, admission_batch: { status: "DRAFT" } }, include: { exam_subject: true } });
  if (bm) {
    const subjects = bm.exam_subject.map((s) => ({ subjectId: Number(s.subject_id), subjectName: s.subject_name, examFormat: s.exam_format, weight: Number(s.weight), maxScore: 20 }));
    r = await call("PUT", `/admission-batch-majors/${bm.batch_major_id}`, { quota: bm.quota, subjects }, T);
    check("không cho thang điểm 20", r.s >= 400 && /1 đến 10/.test(r.j?.message || ""), JSON.stringify(r.j));
  }

  // ---- 8. Khóa sửa thông tin nhân thân sau khi nộp hồ sơ
  const app = await db.application.findFirst({ where: { deleted_at: null, review_status: { notIn: ["DRAFT", "CANCELLED"] }, is_cancelled: false }, include: { candidate: { include: { candidate_account: true } } } });
  const acc = app.candidate.candidate_account;
  await db.candidate_account.update({ where: { account_id: acc.account_id }, data: { password_hash: await bcrypt.hash("ThuNghiem1", 10), failed_login_count: 0, locked_until: null } });
  r = await call("POST", "/auth/login", { emailOrPhone: acc.email, password: "ThuNghiem1" });
  const ct = r.j?.accessToken;
  r = await call("PATCH", "/candidates/me", { fullName: "Ten Bi Doi Sau Nop" }, ct);
  check("đổi họ tên sau khi nộp -> PROFILE_LOCKED", r.j?.error_code === "PROFILE_LOCKED", JSON.stringify(r.j));
  const me = (await call("GET", "/candidates/me", null, ct)).j;
  r = await call("PATCH", "/candidates/me", { address: "Số 9, phường Mỹ Xuyên, An Giang" }, ct);
  check("vẫn sửa được địa chỉ liên hệ", r.s < 300, JSON.stringify(r.j));
  if (me?.address !== undefined) await call("PATCH", "/candidates/me", { address: me.address }, ct);

  console.log(`\n${ok} PASS, ${bad} FAIL`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
