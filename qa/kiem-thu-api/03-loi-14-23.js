// Kiểm thử API: lỗi 14–23. SỬA DỮ LIỆU (đổi trạng thái đợt, hồ sơ, xếp lịch...) — chỉ chạy trên bản sao CSDL.
const BE = process.env.BE || require("path").join(__dirname, "..", "..", "backend");
const { PrismaClient } = require(BE + "/node_modules/@prisma/client");
const bcrypt = require(BE + "/node_modules/bcryptjs");
const db = new PrismaClient();
const B = process.env.API || "http://localhost:4100/api/v1";
let ok = 0, bad = 0;
const check = (name, cond, extra = "") => { (cond ? ok++ : bad++); console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${cond ? "" : extra}`); };
async function call(method, path, body, token) {
  const r = await fetch(B + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = null; const t = await r.text(); try { j = JSON.parse(t); } catch { j = t; }
  return { s: r.status, j, h: r.headers };
}
const tag = Date.now().toString().slice(-6);
const phone = () => "09" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const reg = (o) => call("POST", "/auth/register", { fullName: "Thi Sinh Thu", dob: "1999-01-01", email: `t${tag}${Math.random().toString(36).slice(2, 6)}@example.test`, phoneNumber: phone(), password: "MatKhau123", agreePrivacy: true, ...o });
const vnToday = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const minusYears = (ymd, y, dd = 0) => { const d = new Date(ymd + "T00:00:00Z"); d.setUTCFullYear(d.getUTCFullYear() - y); d.setUTCDate(d.getUTCDate() + dd); return d.toISOString().slice(0, 10); };

(async () => {
  await db.security_counter.deleteMany({ where: { counter_key: { startsWith: "rl:" } } });
  // ===================================================== 18–22 kiểm tra đầu vào
  const today = vnToday();
  let r = await reg({ dob: minusYears(today, 18) });
  check(`18: sinh ${minusYears(today, 18)} (tròn 18 tuổi hôm nay) đăng ký được`, r.s < 300, JSON.stringify(r.j));
  r = await reg({ dob: minusYears(today, 18, 1) });
  check(`18: sinh ${minusYears(today, 18, 1)} (mai mới đủ 18) bị chặn`, r.s === 400, JSON.stringify(r.j));
  r = await reg({ dob: "2000-02-30" });
  check("19: ngày sinh 2000-02-30 bị từ chối", r.s === 400, JSON.stringify(r.j));
  const nfd = "Nguyễn-Trần Đức H'Hen".normalize("NFD");
  const eN = `nfd${tag}@example.test`;
  r = await reg({ fullName: nfd, email: eN, phoneNumber: "+84 9" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0") });
  check("20: tên Unicode tổ hợp (NFD) có - và ' đăng ký được", r.s < 300, JSON.stringify(r.j));
  const accN = await db.candidate_account.findFirst({ where: { email: eN }, include: { candidate: true } });
  check("20: tên lưu dạng NFC", accN?.candidate?.full_name === "Nguyễn-Trần Đức H'Hen", accN?.candidate?.full_name);
  check("22: SĐT +84… được chuẩn hóa thành 0…", /^0\d{9}$/.test(accN?.phone_number ?? ""), accN?.phone_number);
  r = await reg({ fullName: "Nguyễn " + "A".repeat(300) });
  check("21: họ tên 300 ký tự -> 400 (không phải 500)", r.s === 400, `${r.s} ${JSON.stringify(r.j)}`);

  // Thí sinh kích hoạt để thử sửa thông tin
  r = await reg({ email: `prof${tag}@example.test` });
  r = await call("POST", "/auth/register/verify", { email: `prof${tag}@example.test`, otp: r.j.devOtp });
  const ct = r.j.accessToken;
  r = await call("PATCH", "/candidates/me", { fullName: "Lê <b>" }, ct);
  check("22: sửa họ tên kiểm tra như lúc đăng ký (ký tự lạ bị chặn)", r.s === 400, JSON.stringify(r.j));
  r = await call("PATCH", "/candidates/me", { fullName: "X".repeat(300) }, ct);
  check("21/22: sửa họ tên 300 ký tự -> 400", r.s === 400, `${r.s} ${JSON.stringify(r.j)}`);
  const p2 = phone();
  r = await call("PATCH", "/candidates/me", { phoneNumber: `${p2.slice(0, 4)}.${p2.slice(4, 7)}.${p2.slice(7)}` }, ct);
  const me2 = (await call("GET", "/candidates/me", null, ct)).j;
  check("22: sửa SĐT dạng 09xx.xxx.xxx được chuẩn hóa như lúc đăng ký", r.s < 300 && (me2.phoneNumber ?? me2.account?.phoneNumber) === p2, `${r.s} ${JSON.stringify(r.j)} ${JSON.stringify(me2).slice(0, 200)}`);
  r = await call("PATCH", "/candidates/me", { dob: "2001-02-30" }, ct);
  check("19: sửa ngày sinh 2001-02-30 bị từ chối", r.s === 400, JSON.stringify(r.j));

  // Cán bộ
  await db.staff_account.update({ where: { email: "canbo@agu.edu.vn" }, data: { password_hash: await bcrypt.hash("LocalTest@123", 10), must_change_password: false, failed_login_count: 0, locked_until: null } });
  const T = (await call("POST", "/auth/staff/login", { email: "canbo@agu.edu.vn", password: "LocalTest@123" })).j.accessToken;
  const future = new Date(Date.now() + 30 * 86400e3);
  const ymdF = future.toISOString().slice(0, 10);
  r = await call("POST", "/admission-batches", { batchCode: "TEST-" + tag, batchName: "Đợt thử " + "x".repeat(300), degreeLevel: "THAC_SI", registrationStartAt: `${ymdF}T08:00`, registrationEndAt: `${ymdF}T17:00` }, T);
  check("21: tên đợt 300 ký tự -> 400 có câu dễ hiểu", r.s === 400 && /Tên đợt/.test(r.j.message), `${r.s} ${JSON.stringify(r.j)}`);
  r = await call("POST", "/admission-batches", { batchCode: "TEST-" + tag, batchName: "Đợt thử", legalBasis: "Căn cứ ".repeat(30), degreeLevel: "THAC_SI", registrationStartAt: `${ymdF}T08:00`, registrationEndAt: `${ymdF}T17:00` }, T);
  check("21: căn cứ pháp lý > 100 ký tự -> 400", r.s === 400 && /Căn cứ/.test(r.j.message), `${r.s} ${JSON.stringify(r.j)}`);
  r = await call("POST", "/admission-batches", { batchCode: "TEST-" + tag, batchName: "Đợt thử múi giờ", degreeLevel: "THAC_SI", registrationStartAt: `${ymdF}T08:00`, registrationEndAt: `${ymdF}T17:00` }, T);
  const nb = await db.admission_batch.findFirst({ where: { batch_code: "TEST-" + tag } });
  check("23: giờ không kèm múi giờ hiểu là giờ VN (08:00 VN = 01:00Z)", nb?.registration_start_at.toISOString() === `${ymdF}T01:00:00.000Z`, `${r.s} ${JSON.stringify(r.j)} ${nb?.registration_start_at.toISOString()}`);

  // ===================================================== 16 CSV
  const victim = await db.candidate.findFirst({ where: { candidate_account: { deleted_at: null } } });
  await db.candidate.update({ where: { candidate_id: victim.candidate_id }, data: { address: "\t=HYPERLINK(\"http://x\")" } });
  r = await fetch(B + "/admin/candidates/export", { headers: { Authorization: "Bearer " + T } });
  const csv = await r.text();
  const total = await db.candidate_account.count({ where: { deleted_at: null } });
  check("16: header X-Export-Total / Rows có mặt", r.headers.get("x-export-total") && r.headers.get("x-export-rows"), [...r.headers.keys()].join(","));
  check("16: ô bắt đầu bằng tab + = bị vô hiệu hóa", csv.includes(`"'\t=HYPERLINK`), csv.slice(0, 120));
  console.log(`      CSV: ${r.headers.get("x-export-rows")}/${r.headers.get("x-export-total")} dòng (tài khoản chưa xóa: ${total}), cắt bớt: ${r.headers.get("x-export-truncated") ?? "không"}`);

  // ===================================================== 15 lịch phỏng vấn trùng phòng giữa các ngành
  const [bm7, bm8] = [7n, 8n];
  for (const bm of [bm7, bm8]) {
    if (!(await db.admission_committee.count({ where: { batch_major_id: bm, status: "ACTIVE" } })))
      await db.admission_committee.create({ data: { batch_major_id: bm, committee_name: `Tiểu ban thử ${bm}`, status: "ACTIVE" } });
  }
  await db.interview_schedule.deleteMany({ where: { application: { batch_major_id: { in: [bm7, bm8] } } } });
  const elig = async (bm) => db.application.count({ where: { batch_major_id: bm, review_status: "APPROVED", is_cancelled: false, deleted_at: null } });
  console.log("      hồ sơ đạt: ngành 7 =", await elig(bm7), ", ngành 8 =", await elig(bm8));
  // Thứ Hai tới, 07:30 giờ VN
  const d = new Date(Date.now() + 7 * 3600e3); d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
  const monday = d.toISOString().slice(0, 10);
  const room = "Phòng thử " + tag;
  r = await call("POST", `/admin/scoring/majors/7/interviews/auto`, { startAt: `${monday}T07:30`, minutes: 30, location: room }, T);
  check("15: xếp lịch ngành 7", r.s < 300, JSON.stringify(r.j));
  r = await call("POST", `/admin/scoring/majors/8/interviews/auto`, { startAt: `${monday}T07:30`, minutes: 30, location: room }, T);
  check("15: xếp lịch ngành 8 cùng phòng, cùng giờ bắt đầu", r.s < 300, JSON.stringify(r.j));
  console.log("      kết quả ngành 8:", JSON.stringify(r.j));
  const sch = await db.interview_schedule.findMany({ where: { location_or_link: room, status: "SCHEDULED" }, orderBy: { scheduled_at: "asc" } });
  let clash = 0;
  for (let i = 1; i < sch.length; i++) if (sch[i].scheduled_at - sch[i - 1].scheduled_at < 30 * 60e3) clash++;
  check(`15: ${sch.length} lượt trong cùng phòng không trùng giờ`, sch.length > 0 && clash === 0, `clash=${clash}`);
  const a7 = sch.find((s) => s.committee_id !== sch[sch.length - 1].committee_id) ?? sch[0];
  const b8 = sch[sch.length - 1];
  r = await call("PATCH", `/admin/scoring/interviews/${b8.schedule_id}`, { scheduledAt: a7.scheduled_at.toISOString(), location: room }, T);
  check("15: sửa tay sang giờ đã có người trong cùng phòng -> 409 SCHEDULE_CLASH", r.s === 409 && r.j.error_code === "SCHEDULE_CLASH", `${r.s} ${JSON.stringify(r.j)}`);
  r = await call("PATCH", `/admin/scoring/interviews/${b8.schedule_id}`, { scheduledAt: a7.scheduled_at.toISOString(), location: room + " (phòng khác)" }, T);
  const sameCommittee = a7.committee_id === b8.committee_id;
  check(`15: cùng giờ nhưng phòng khác -> ${sameCommittee ? "vẫn chặn vì cùng tiểu ban" : "được"}`, sameCommittee ? r.s === 409 : r.s < 300, `${r.s} ${JSON.stringify(r.j)}`);

  // ===================================================== 14 mã học viên khi hai cán bộ bấm cùng lúc
  const admitted = await db.application.findMany({ where: { deleted_at: null, is_cancelled: false, review_status: "APPROVED", OR: [{ enrollment_completion: null }, { enrollment_completion: { completed_at: null } }] }, take: 3, include: { admission_batch_major: true } });
  const sameBatch = admitted.filter((x) => x.admission_batch_major.batch_id === admitted[0].admission_batch_major.batch_id).slice(0, 3);
  for (const a of sameBatch) {
    await db.enrollment_confirmation.upsert({ where: { application_id: a.application_id }, create: { application_id: a.application_id, deadline: future, status: "DA_XAC_NHAN", confirmed_at: new Date() }, update: { status: "DA_XAC_NHAN" } });
    await db.original_document_submission.upsert({ where: { application_id: a.application_id }, create: { application_id: a.application_id, status: "VERIFIED", submitted_at: new Date(), verified_at: new Date() }, update: { status: "VERIFIED" } });
  }
  const T2 = (await call("POST", "/auth/staff/login", { email: "canbo@agu.edu.vn", password: "LocalTest@123" })).j.accessToken;
  const res = await Promise.all([
    ...sameBatch.map((a, i) => call("POST", `/admin/decisions/enrollment/${a.application_id}/complete`, {}, i % 2 ? T2 : T)),
    call("POST", `/admin/decisions/enrollment/${sameBatch[0].application_id}/complete`, {}, T2), // bấm trùng hồ sơ
  ]);
  const refs = res.filter((x) => x.s < 300).map((x) => x.j.transferRef);
  check(`14: ${sameBatch.length} hồ sơ hoàn tất cùng lúc -> ${sameBatch.length} mã khác nhau`, refs.length === sameBatch.length && new Set(refs).size === refs.length, JSON.stringify(res.map((x) => [x.s, x.j.transferRef ?? x.j.error_code])));
  console.log("      mã cấp:", refs.join(", "), "| lần bấm trùng:", res[res.length - 1].s, res[res.length - 1].j.error_code ?? "");

  // ===================================================== 17 hồ sơ kẹt vì trượt / vắng thi tiếng Anh
  const b3 = await db.admission_batch.findFirst({ where: { batch_code: "THS-2026-D1" } });
  await db.admission_batch.update({ where: { batch_id: b3.batch_id }, data: { status: "CLOSED" } });
  const pend = await db.application.findMany({ where: { admission_batch_major: { batch_id: b3.batch_id }, deleted_at: null, is_cancelled: false, review_status: { in: ["SUBMITTED", "UNDER_REVIEW", "NEEDS_SUPPLEMENT"] } } });
  // Cho các hồ sơ đang chờ khác kết luận xong để chỉ còn hồ sơ trượt tiếng Anh
  for (const p of pend) await db.application.update({ where: { application_id: p.application_id }, data: { review_status: "REJECTED" } });
  const victimApp = await db.application.findFirst({ where: { admission_batch_major: { batch_id: b3.batch_id }, deleted_at: null, is_cancelled: false }, orderBy: { application_id: "asc" } });
  await db.application.update({ where: { application_id: victimApp.application_id }, data: { review_status: "UNDER_REVIEW", language_option: "TEST" } });
  const sess = await db.english_test_session.create({ data: { batch_id: b3.batch_id, session_code: "TA-T" + tag.slice(-3), room: "B1", capacity: 10, test_at: new Date(Date.now() - 86400e3), status: "COMPLETED" } }).catch(async (e) => { console.log("      (tạo phòng thi lỗi:", e.message.split("\n").pop(), ")"); return null; });
  if (sess) {
    await db.english_test_registration.deleteMany({ where: { application_id: victimApp.application_id } });
    await db.english_test_registration.create({ data: { application_id: victimApp.application_id, session_id: sess.session_id, candidate_number: "SBD" + tag, seat_no: 1, result: "ABSENT" } });
    r = await call("PATCH", `/admission-batches/${b3.batch_id}/status`, { status: "IN_REVIEW" }, T);
    const after = await db.application.findUnique({ where: { application_id: victimApp.application_id }, include: { application_status_history: { orderBy: { history_id: "desc" }, take: 1 } } });
    check("17: đợt chuyển sang Xét kết quả, không còn kẹt", r.s < 300 && r.j.autoRejected === 1, `${r.s} ${JSON.stringify(r.j)}`);
    check("17: hồ sơ vắng thi tiếng Anh tự kết luận Không đạt, có lý do", after.review_status === "REJECTED" && /ngoại ngữ/.test(after.application_status_history[0]?.reason ?? ""), `${after.review_status} ${after.application_status_history[0]?.reason}`);
  }

  console.log(`\n${ok} PASS, ${bad} FAIL`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
