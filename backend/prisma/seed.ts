/* eslint-disable no-console */
// ============================================================================
// Seed dữ liệu.
//   npm run db:seed        -> tạo tài khoản Quản trị đầu tiên (nếu chưa có cán bộ nào)
//   npm run db:seed:demo   -> nạp bộ dữ liệu mẫu đầy đủ (chỉ chạy trên CSDL TRỐNG)
// Không bao giờ xóa dữ liệu: gặp CSDL đã có dữ liệu thì dừng và báo.
// Yêu cầu: đã chạy admission_db_v3.sql + migration_v4 + migration_v5 + migration_v6 (thư mục database/).
// ============================================================================
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { seedAnnouncements } from "./announcements-seed";
import { createSeedDb } from "./demo/mockData";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "Demo@123";
const DEMO_CANDIDATE_EMAIL = "thisinh.demo@gmail.com";
const uploadRoot = path.resolve(process.env.UPLOAD_DIR || "./uploads");
const B = (n: number) => BigInt(n);

async function roleIds() {
  const roles = await prisma.role.findMany();
  if (roles.length < 4) throw new Error("Chưa có bảng role đủ 4 vai trò — hãy chạy migration_v4_backend.sql trước.");
  return Object.fromEntries(roles.map((r) => [r.role_code, r.role_id]));
}

async function seedAdmin() {
  const count = await prisma.staff_account.count();
  if (count > 0) {
    console.log(`• Đã có ${count} tài khoản cán bộ — không tạo thêm tài khoản quản trị.`);
    return;
  }
  const roles = await roleIds();
  const password = process.env.SEED_ADMIN_PASSWORD || "Admin@123";
  await prisma.staff_account.create({
    data: {
      staff_code: "QT-001",
      full_name: "Quản trị hệ thống",
      email: "quantri@agu.edu.vn",
      password_hash: await bcrypt.hash(password, 10),
      must_change_password: true,
      staff_role: { create: [{ role_id: roles.ADMIN }] },
    },
  });
  console.log(`✓ Tạo tài khoản quản trị: quantri@agu.edu.vn / ${password}  (hệ thống bắt đổi mật khẩu ở lần đăng nhập đầu)`);
}

/** PDF 1 trang hợp lệ, đủ để xem thử trong trình duyệt */
function tinyPdf(lines: string[]): Buffer {
  const ascii = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[()\\]/g, "");
  const text = lines.map((l, i) => `BT /F1 ${i === 0 ? 16 : 11} Tf 60 ${760 - i * 26} Td (${ascii(l)}) Tj ET`).join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

async function seedDemo() {
  const [staffCount, batchCount, appCount] = await Promise.all([prisma.staff_account.count(), prisma.admission_batch.count(), prisma.application.count()]);
  if (staffCount + batchCount + appCount > 0) {
    console.log("✗ CSDL đã có dữ liệu (cán bộ / đợt / hồ sơ). Dữ liệu mẫu chỉ nạp vào CSDL trống để không ghi đè dữ liệu thật.");
    console.log("  Muốn làm lại từ đầu: tạo CSDL mới bằng admission_db_v3.sql + migration_v4_backend.sql rồi chạy lại lệnh này.");
    process.exitCode = 1;
    return;
  }
  const roles = await roleIds();
  const db = createSeedDb();
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  console.log("• Cán bộ, ngành, đợt tuyển sinh…");
  for (const s of db.staff) {
    await prisma.staff_account.create({
      data: {
        staff_account_id: B(s.staffAccountId),
        staff_code: s.staffCode,
        full_name: s.fullName,
        email: s.email,
        password_hash: s.hasPassword ? hash : null,
        status: s.status,
        staff_role: { create: s.roles.map((r) => ({ role_id: roles[r] })) },
      },
    });
  }
  await prisma.admission_major.createMany({
    data: db.majors.map((m) => ({ major_id: B(m.majorId), major_code: m.majorCode, major_name: m.majorName, degree_level: m.degreeLevel, faculty_name: m.facultyName })),
  });
  await prisma.admission_batch.createMany({
    data: db.batches.map((b) => ({
      batch_id: B(b.batchId),
      batch_code: b.batchCode,
      batch_name: b.batchName,
      degree_level: b.degreeLevel,
      registration_start_at: new Date(b.registrationStartAt),
      registration_end_at: new Date(b.registrationEndAt),
      exam_start_at: b.examStartAt ? new Date(b.examStartAt) : null,
      exam_end_at: b.examEndAt ? new Date(b.examEndAt) : null,
      legal_basis: b.legalBasis,
      status: b.status,
      created_at: new Date(b.createdAt),
    })),
  });
  for (const bm of db.batchMajors) {
    await prisma.admission_batch_major.create({
      data: {
        batch_major_id: B(bm.batchMajorId),
        batch_id: B(bm.batchId),
        major_id: B(bm.majorId),
        quota: bm.quota,
        status: bm.status,
        approved_by_staff_id: bm.approvedByStaffId ? B(bm.approvedByStaffId) : null,
        approved_at: bm.approvedByStaffId ? new Date(db.batches.find((b) => b.batchId === bm.batchId)!.createdAt) : null,
        exam_subject: {
          create: bm.subjects.map((s) => ({ subject_id: B(s.subjectId), subject_name: s.subjectName, exam_format: s.examFormat, weight: s.weight, max_score: s.maxScore })),
        },
        admission_condition: {
          create: bm.conditions.map((c) => ({
            condition_id: B(c.conditionId),
            condition_code: c.conditionCode,
            description: c.description,
            min_gpa: c.minGpa,
            required_certificate: c.requiredCertificate,
            is_mandatory: c.isMandatory,
          })),
        },
      },
    });
  }

  // Một hồ sơ "Chờ bổ sung" còn hạn giao cho tài khoản thí sinh demo để thử cổng thí sinh
  const demoApp = db.applications.find((a) => a.reviewStatus === "NEEDS_SUPPLEMENT" && a.supplements.some((s) => s.status === "PENDING" && new Date(s.deadline) > new Date()));

  console.log(`• ${db.applications.length} hồ sơ, minh chứng (tệp PDF mẫu), lệ phí, lịch sử…`);
  const usedEmails = new Set<string>();
  const usedIds = new Set<string>();
  for (const a of db.applications) {
    const c = a.candidate;
    let email = a === demoApp ? DEMO_CANDIDATE_EMAIL : c.email;
    while (usedEmails.has(email)) email = email.replace("@", `${usedEmails.size}@`);
    usedEmails.add(email);
    let idNumber = c.idNumber;
    while (usedIds.has(idNumber)) idNumber = String(Number(idNumber) + 1).padStart(12, "0");
    usedIds.add(idNumber);

    const account = await prisma.candidate_account.create({
      data: { username: email, email, phone_number: null, status: "ACTIVE", password_hash: a === demoApp ? hash : null },
    });
    await prisma.candidate.create({
      data: {
        candidate_id: B(c.candidateId),
        account_id: account.account_id,
        full_name: c.fullName,
        dob: new Date(`${c.dob}T00:00:00Z`),
        gender: c.gender,
        id_number: idNumber,
        address: c.address,
      },
    });
    // Số điện thoại có thể trùng trong dữ liệu ngẫu nhiên -> gán sau, bỏ qua nếu trùng
    await prisma.candidate_account.update({ where: { account_id: account.account_id }, data: { phone_number: c.phoneNumber } }).catch(() => undefined);

    const submittedAt = new Date(a.submittedAt);
    await prisma.application.create({
      data: {
        application_id: B(a.applicationId),
        application_code: a.applicationCode,
        candidate_id: B(c.candidateId),
        batch_major_id: B(a.batchMajorId),
        review_status: a.reviewStatus,
        admission_status: a.admissionStatus,
        assigned_staff_id: a.assignedStaffId ? B(a.assignedStaffId) : null,
        submitted_at: submittedAt,
        created_at: new Date(submittedAt.getTime() - 86_400_000),
      },
    });
    const isPhd = a.batchMajorId === 5 || a.batchMajorId === 6;
    await prisma.application_education.create({
      data: {
        application_id: B(a.applicationId),
        degree_level: isPhd ? "THAC_SI" : "DAI_HOC",
        institution_name: c.graduatedFrom,
        major_name: c.graduatedMajor,
        graduation_year: c.graduationYear,
        gpa: c.gpa,
        gpa_scale: 4,
      },
    });

    fs.mkdirSync(path.join(uploadRoot, "demo", String(a.applicationId)), { recursive: true });
    for (const d of a.documents) {
      const buf = tinyPdf([
        "Tep minh chung mau - Du lieu demo",
        `Ho so: ${a.applicationCode}`,
        `Thi sinh: ${c.fullName}`,
        `Loai giay to: ${d.documentType}`,
        `Ten tep: ${d.fileName}`,
        "Day khong phai giay to that.",
      ]);
      const rel = path.posix.join("demo", String(a.applicationId), `${d.documentId}.pdf`);
      fs.writeFileSync(path.join(uploadRoot, rel), buf);
      await prisma.application_document.create({
        data: {
          document_id: B(d.documentId),
          application_id: B(a.applicationId),
          document_type: d.documentType,
          file_name: d.fileName,
          file_path: rel,
          file_hash: createHash("sha256").update(buf).digest("hex"),
          file_size_kb: Math.max(1, Math.ceil(buf.length / 1024)),
          verify_status: d.verifyStatus,
          verify_note: d.invalidReason,
          verified_by_staff_id: d.verifyStatus !== "PENDING" && a.assignedStaffId ? B(a.assignedStaffId) : null,
          verified_at: d.verifyStatus !== "PENDING" ? new Date(Math.min(Date.now(), submittedAt.getTime() + 2 * 86_400_000)) : null,
          uploaded_at: new Date(d.uploadedAt),
        },
      });
    }
    await prisma.application_payment.create({
      data: {
        application_id: B(a.applicationId),
        amount: a.payment.amount,
        payment_method: a.payment.paymentMethod,
        transaction_code: a.payment.transactionCode,
        gateway_status: a.payment.gatewayStatus,
        receipt_no: a.payment.transactionCode ? `BL-${a.applicationId}` : null,
        paid_at: a.payment.paidAt ? new Date(a.payment.paidAt) : null,
      },
    });
    for (const s of [...a.supplements].reverse()) {
      await prisma.supplement_request.create({
        data: {
          application_id: B(a.applicationId),
          requested_by_staff_id: s.requestedByStaffId ? B(s.requestedByStaffId) : null,
          content: s.content,
          deadline: new Date(s.deadline),
          status: s.status,
          created_at: new Date(s.createdAt),
          responded_at: s.respondedAt ? new Date(s.respondedAt) : null,
        },
      });
    }
    await prisma.application_status_history.createMany({
      data: a.history.map((h) => ({
        application_id: B(a.applicationId),
        old_status: h.oldStatus,
        new_status: h.newStatus,
        changed_by_type: h.changedByType,
        changed_by_staff_id: h.changedByStaffId ? B(h.changedByStaffId) : null,
        reason: h.reason,
        changed_at: new Date(h.changedAt),
      })),
    });
    const final = a.history[a.history.length - 1];
    const result = a.reviewStatus === "APPROVED" ? "PASS" : a.reviewStatus === "REJECTED" ? "FAIL" : a.reviewStatus === "NEEDS_SUPPLEMENT" ? "NEEDS_SUPPLEMENT" : null;
    if (result && final?.changedByStaffId) {
      await prisma.application_review.create({
        data: { application_id: B(a.applicationId), reviewer_staff_id: B(final.changedByStaffId), review_type: "MANUAL_REVIEW", review_result: result, note: final.reason, reviewed_at: new Date(final.changedAt) },
      });
    }
  }

  console.log("• Giảng viên hướng dẫn và yêu cầu hướng dẫn NCS…");
  const lecturers = [
    { code: "GV-CNTT-01", name: "PGS.TS Trần Văn Long", email: "tvlong@agu.edu.vn", faculty: "Khoa Công nghệ thông tin" },
    { code: "GV-CNTT-02", name: "TS. Lê Thị Minh Thư", email: "ltmthu@agu.edu.vn", faculty: "Khoa Công nghệ thông tin" },
    { code: "GV-NN-01", name: "PGS.TS Nguyễn Văn Hòa", email: "nvhoa@agu.edu.vn", faculty: "Khoa Nông nghiệp - Tài nguyên thiên nhiên" },
  ];
  const lecturerIds: Record<string, bigint> = {};
  for (const l of lecturers) {
    const row = await prisma.lecturer.create({ data: { lecturer_code: l.code, full_name: l.name, email: l.email, faculty_name: l.faculty } });
    lecturerIds[l.code] = row.lecturer_id;
  }
  const topics: Record<number, string[]> = {
    5: ["Phát hiện bất thường trong dữ liệu giao dịch bằng học sâu", "Tối ưu mô hình ngôn ngữ cho tiếng Việt chuyên ngành nông nghiệp"],
    6: ["Chọn tạo giống lúa chịu mặn cho vùng Đồng bằng sông Cửu Long", "Quản lý dịch hại tổng hợp trên cây ăn trái"],
  };
  let k = 0;
  for (const a of db.applications.filter((x) => x.batchMajorId === 5 || x.batchMajorId === 6)) {
    const doc = a.documents.find((d) => d.documentType === "DE_CUONG_NCS");
    if (!doc) continue;
    const lecturer = a.batchMajorId === 5 ? (k % 2 === 0 ? "GV-CNTT-01" : "GV-CNTT-02") : "GV-NN-01";
    const proposal = await prisma.research_proposal.create({
      data: {
        application_id: B(a.applicationId),
        document_id: B(doc.documentId),
        research_topic: topics[a.batchMajorId][k % 2],
        research_field: a.batchMajorId === 5 ? "Khoa học máy tính" : "Khoa học cây trồng",
        preferred_lecturer_id: lecturerIds[lecturer],
      },
    });
    const accepted = a.reviewStatus === "APPROVED" || k % 3 === 1;
    await prisma.supervisor_request.create({
      data: {
        proposal_id: proposal.proposal_id,
        lecturer_id: lecturerIds[lecturer],
        status: accepted ? "ACCEPTED" : "PENDING",
        requested_at: new Date(a.submittedAt),
        responded_at: accepted ? new Date(Math.min(Date.now(), new Date(a.submittedAt).getTime() + 3 * 86_400_000)) : null,
        response_note: accepted ? "Đồng ý hướng dẫn, đề nghị thí sinh liên hệ để hoàn thiện đề cương." : null,
      },
    });
    k++;
  }

  console.log("• Điểm thi và đơn phúc khảo (đợt đang xét kết quả)…");
  for (const p of db.appeals) {
    const app = db.applications.find((a) => a.applicationId === p.applicationId)!;
    const bm = db.batchMajors.find((x) => x.batchMajorId === app.batchMajorId)!;
    const subject = bm.subjects.find((s) => s.subjectName === p.subjectName) ?? bm.subjects[0];
    // Nhập điểm -> trigger #4 tự tạo application_ranking và tính total_score
    const score = await prisma.exam_score.create({
      data: { application_id: B(app.applicationId), subject_id: B(subject.subjectId), score: p.oldScore, grader_staff_id: B(3), graded_at: new Date(p.createdAt) },
    });
    const appeal = await prisma.score_appeal.create({
      data: { score_id: score.score_id, reason: p.reason, old_score: p.oldScore, status: "PENDING", created_at: new Date(p.createdAt) },
    });
    if (p.status !== "PENDING") {
      // Cập nhật thành đã xử lý -> trigger #3 tự sửa exam_score nếu đổi điểm
      await prisma.score_appeal.update({
        where: { appeal_id: appeal.appeal_id },
        data: {
          status: p.status,
          new_score: p.newScore,
          resolved_at: p.resolvedAt ? new Date(p.resolvedAt) : new Date(),
          resolved_by_staff_id: p.resolvedByStaffId ? B(p.resolvedByStaffId) : null,
          resolution_note: p.resolutionNote,
        },
      });
    }
  }

  console.log("• Nhật ký hệ thống mẫu…");
  await prisma.audit_log.createMany({
    data: db.auditLogs.map((l) => ({
      actor_type: l.actorType,
      actor_id: l.actorId ? B(l.actorId) : null,
      action: l.action,
      entity_table: l.entityTable,
      entity_id: l.entityId ? B(l.entityId) : null,
      detail: l.detail,
      created_at: new Date(l.createdAt),
    })),
  });

  const nAnn = await seedAnnouncements(prisma);
  if (nAnn) console.log(`✓ Đã nạp ${nAnn} thông báo tuyển sinh / quy định mẫu.`);

  console.log("\n✓ Đã nạp dữ liệu mẫu. Tài khoản đăng nhập (mật khẩu chung: " + DEMO_PASSWORD + "):");
  console.log("  Cán bộ tuyển sinh  canbo@agu.edu.vn");
  console.log("  Hội đồng           hoidong@agu.edu.vn");
  console.log("  Lãnh đạo           lanhdao@agu.edu.vn");
  console.log("  Quản trị           quantri@agu.edu.vn");
  if (demoApp) console.log(`  Thí sinh (cổng thí sinh) ${DEMO_CANDIDATE_EMAIL} — hồ sơ ${demoApp.applicationCode} đang chờ bổ sung`);
}

(async () => {
  try {
    if (process.argv.includes("--demo")) await seedDemo();
    else await seedAdmin();
  } catch (e) {
    console.error("✗ Seed thất bại:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
