// ============================================================================
// Dữ liệu mẫu cho chế độ MOCK của phân hệ Quản lý.
// Sinh tất định (cùng seed -> cùng dữ liệu) để cả nhóm demo thấy giống nhau.
// Mốc thời gian tính tương đối theo lúc khởi tạo, nên hạn bổ sung / hạn đăng ký
// luôn hợp lý dù chạy vào ngày nào.
// ============================================================================
import type {
  AdminApplication,
  AdminCandidate,
  AdminDb,
  AdminDocument,
  AdmissionCondition,
  ExamSubject,
  AdmissionBatch,
  AdmissionMajor,
  AuditLog,
  BatchMajor,
  DocumentType,
  Payment,
  ReviewStatus,
  ScoreAppeal,
  StaffAccount,
  StatusHistoryEntry,
  SupplementRequest,
} from "./types";

export const DB_VERSION = 6;

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 86_400_000;

export function createSeedDb(nowMs = Date.now()): AdminDb {
  const rand = mulberry32(20260929);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
  const iso = (ms: number) => new Date(ms).toISOString();
  const at = (daysFromNow: number, hour = 9, minute = 0) => {
    const d = new Date(nowMs + daysFromNow * DAY);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };
  const hex = (n: number) => Array.from({ length: n }, () => "0123456789abcdef"[int(0, 15)]).join("");

  // ---------------------------------------------------------------- Cán bộ
  const staff: StaffAccount[] = [
    { staffAccountId: 1, staffCode: "CBTS-001", fullName: "Nguyễn Thị Thu Hà", email: "canbo@agu.edu.vn", hasPassword: true, status: "ACTIVE", roles: ["CAN_BO_TUYEN_SINH"] },
    { staffAccountId: 2, staffCode: "CBTS-002", fullName: "Lê Minh Tuấn", email: "lmtuan@agu.edu.vn", hasPassword: false, status: "ACTIVE", roles: ["CAN_BO_TUYEN_SINH"] },
    { staffAccountId: 3, staffCode: "HD-001", fullName: "PGS.TS Phạm Quốc Bảo", email: "hoidong@agu.edu.vn", hasPassword: true, status: "ACTIVE", roles: ["HOI_DONG"] },
    { staffAccountId: 4, staffCode: "HD-002", fullName: "TS. Võ Thị Ngọc Lan", email: "vtnlan@agu.edu.vn", hasPassword: false, status: "ACTIVE", roles: ["HOI_DONG"] },
    { staffAccountId: 5, staffCode: "LD-001", fullName: "PGS.TS Đặng Văn Khoa", email: "lanhdao@agu.edu.vn", hasPassword: true, status: "ACTIVE", roles: ["LANH_DAO_KHOA"] },
    { staffAccountId: 6, staffCode: "QT-001", fullName: "Huỳnh Gia Phát", email: "quantri@agu.edu.vn", hasPassword: true, status: "ACTIVE", roles: ["ADMIN"] },
    { staffAccountId: 7, staffCode: "CBTS-003", fullName: "Trương Mỹ Linh", email: "tmlinh@agu.edu.vn", hasPassword: true, status: "LOCKED", roles: ["CAN_BO_TUYEN_SINH"] },
    { staffAccountId: 8, staffCode: "HD-003", fullName: "TS. Nguyễn Hoàng Nam", email: "nhnam@agu.edu.vn", hasPassword: true, status: "ACTIVE", roles: ["HOI_DONG", "CAN_BO_TUYEN_SINH"] },
  ];

  // ---------------------------------------------------------------- Ngành (mã ngành theo danh mục GD&ĐT)
  const majors: AdmissionMajor[] = [
    { majorId: 1, majorCode: "8480101", majorName: "Khoa học máy tính", degreeLevel: "THAC_SI", facultyName: "Khoa Công nghệ thông tin" },
    { majorId: 2, majorCode: "8340101", majorName: "Quản trị kinh doanh", degreeLevel: "THAC_SI", facultyName: "Khoa Kinh tế - Quản trị kinh doanh" },
    { majorId: 3, majorCode: "8220201", majorName: "Ngôn ngữ Anh", degreeLevel: "THAC_SI", facultyName: "Khoa Ngoại ngữ" },
    { majorId: 4, majorCode: "8620110", majorName: "Khoa học cây trồng", degreeLevel: "THAC_SI", facultyName: "Khoa Nông nghiệp - Tài nguyên thiên nhiên" },
    { majorId: 5, majorCode: "9480101", majorName: "Khoa học máy tính", degreeLevel: "TIEN_SI", facultyName: "Khoa Công nghệ thông tin" },
    { majorId: 6, majorCode: "9620110", majorName: "Khoa học cây trồng", degreeLevel: "TIEN_SI", facultyName: "Khoa Nông nghiệp - Tài nguyên thiên nhiên" },
  ];

  // ---------------------------------------------------------------- Đợt tuyển sinh
  const LEGAL = "Thông tư 53/2026/TT-BGDĐT";
  const batches: AdmissionBatch[] = [
    { batchId: 1, batchCode: "THS-2026-D2", batchName: "Tuyển sinh thạc sĩ đợt 2 năm 2026", degreeLevel: "THAC_SI", registrationStartAt: at(-45), registrationEndAt: at(14, 17), examStartAt: at(40), examEndAt: at(42, 17), legalBasis: LEGAL, status: "OPEN", createdAt: at(-60) },
    { batchId: 2, batchCode: "TS-2026", batchName: "Tuyển sinh tiến sĩ năm 2026", degreeLevel: "TIEN_SI", registrationStartAt: at(-30), registrationEndAt: at(45, 17), examStartAt: at(70), examEndAt: at(72, 17), legalBasis: LEGAL, status: "OPEN", createdAt: at(-50) },
    { batchId: 3, batchCode: "THS-2026-D1", batchName: "Tuyển sinh thạc sĩ đợt 1 năm 2026", degreeLevel: "THAC_SI", registrationStartAt: at(-150), registrationEndAt: at(-90, 17), examStartAt: at(-20), examEndAt: at(-18, 17), legalBasis: LEGAL, status: "IN_REVIEW", createdAt: at(-170) },
    { batchId: 4, batchCode: "THS-2027-D1", batchName: "Tuyển sinh thạc sĩ đợt 1 năm 2027", degreeLevel: "THAC_SI", registrationStartAt: at(150), registrationEndAt: at(210, 17), examStartAt: at(240), examEndAt: at(242, 17), legalBasis: LEGAL, status: "DRAFT", createdAt: at(-3) },
  ];

  let subjectId = 1;
  let conditionId = 1;
  const thsSubjects = (w1 = 0.4, w2 = 0.6): ExamSubject[] => [
    { subjectId: subjectId++, subjectName: "Đánh giá hồ sơ học thuật", examFormat: "XET_HO_SO" as const, weight: w1, maxScore: 10 },
    { subjectId: subjectId++, subjectName: "Phỏng vấn chuyên môn", examFormat: "PHONG_VAN" as const, weight: w2, maxScore: 10 },
  ];
  const tsSubjects = (): ExamSubject[] => [
    { subjectId: subjectId++, subjectName: "Đánh giá hồ sơ và đề cương nghiên cứu", examFormat: "XET_HO_SO" as const, weight: 0.6, maxScore: 10 },
    { subjectId: subjectId++, subjectName: "Trình bày đề cương trước tiểu ban", examFormat: "PHONG_VAN" as const, weight: 0.4, maxScore: 10 },
  ];
  const thsConditions = (): AdmissionCondition[] => [
    { conditionId: conditionId++, conditionCode: "TN_DH", description: "Tốt nghiệp đại học ngành phù hợp hoặc ngành gần (đã học bổ sung kiến thức).", minGpa: 2.5, requiredCertificate: null, isMandatory: true },
    { conditionId: conditionId++, conditionCode: "NN_B1", description: "Năng lực ngoại ngữ từ bậc 3/6 Khung năng lực ngoại ngữ Việt Nam trở lên.", minGpa: null, requiredCertificate: "Bậc 3/6 (B1) hoặc tương đương", isMandatory: true },
  ];
  const tsConditions = (): AdmissionCondition[] => [
    { conditionId: conditionId++, conditionCode: "TN_THS", description: "Có bằng thạc sĩ ngành phù hợp, hoặc tốt nghiệp đại học loại giỏi trở lên.", minGpa: 3.2, requiredCertificate: null, isMandatory: true },
    { conditionId: conditionId++, conditionCode: "NN_B2", description: "Năng lực ngoại ngữ từ bậc 4/6 trở lên.", minGpa: null, requiredCertificate: "Bậc 4/6 (B2) hoặc tương đương", isMandatory: true },
    { conditionId: conditionId++, conditionCode: "CBKH", description: "Là tác giả chính của ít nhất 01 bài báo khoa học trong 3 năm gần nhất.", minGpa: null, requiredCertificate: null, isMandatory: true },
  ];

  let bmId = 1;
  const bm = (batchId: number, majorId: number, quota: number, status: BatchMajor["status"], subjects = thsSubjects(), conditions = thsConditions(), approvedBy: number | null = 5): BatchMajor => ({
    batchMajorId: bmId++, batchId, majorId, quota, benchmarkScore: null, status, subjects, conditions, approvedByStaffId: approvedBy,
  });
  const batchMajors: BatchMajor[] = [
    bm(1, 1, 30, "OPEN"),
    bm(1, 2, 40, "OPEN"),
    bm(1, 3, 25, "OPEN"),
    bm(1, 4, 20, "OPEN"),
    bm(2, 5, 5, "OPEN", tsSubjects(), tsConditions()),
    bm(2, 6, 4, "OPEN", tsSubjects(), tsConditions()),
    bm(3, 1, 25, "CLOSED"),
    bm(3, 2, 35, "CLOSED"),
    // Đợt nháp 2027: 1 ngành đã duyệt, 1 ngành tổng trọng số chưa đủ 100% để demo kiểm tra
    bm(4, 1, 35, "CONFIGURING", thsSubjects(0.5, 0.3), thsConditions(), null),
    bm(4, 2, 45, "APPROVED", thsSubjects(), thsConditions(), 5),
  ];

  // ---------------------------------------------------------------- Thí sinh
  const familyNames = ["Nguyễn", "Trần", "Lê", "Phạm", "Huỳnh", "Võ", "Phan", "Trương", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lâm", "Châu"];
  const maleMiddle = ["Văn", "Minh", "Quốc", "Hoàng", "Thanh", "Đức", "Hữu", "Gia"];
  const femaleMiddle = ["Thị", "Ngọc", "Thanh", "Mỹ", "Thu", "Kim", "Bảo", "Phương"];
  const maleGiven = ["Khang", "Phúc", "Tài", "Lộc", "Nhân", "Trí", "Hiếu", "Duy", "Khoa", "Tâm", "Thịnh", "Vinh", "Huy", "Long"];
  const femaleGiven = ["Trâm", "Ngân", "Vy", "Hân", "Thảo", "Nhi", "Uyên", "Quyên", "Diễm", "Như", "Yến", "Trinh", "Linh", "Tiên"];
  const addresses = ["Phường Long Xuyên, tỉnh An Giang", "Phường Châu Đốc, tỉnh An Giang", "Phường Rạch Giá, tỉnh An Giang", "Xã Chợ Mới, tỉnh An Giang", "Phường Ninh Kiều, TP. Cần Thơ", "Phường Cao Lãnh, tỉnh Đồng Tháp", "Xã Tri Tôn, tỉnh An Giang"];
  const universities = ["Trường Đại học An Giang", "Trường Đại học Cần Thơ", "Trường Đại học Đồng Tháp", "Trường Đại học Kiên Giang", "Trường Đại học Nam Cần Thơ"];
  const bachelorOf: Record<number, string[]> = {
    1: ["Công nghệ thông tin", "Kỹ thuật phần mềm", "Hệ thống thông tin"],
    2: ["Quản trị kinh doanh", "Kế toán", "Tài chính - Ngân hàng"],
    3: ["Ngôn ngữ Anh", "Sư phạm Tiếng Anh"],
    4: ["Nông học", "Bảo vệ thực vật", "Khoa học cây trồng"],
    5: ["Thạc sĩ Khoa học máy tính", "Thạc sĩ Hệ thống thông tin"],
    6: ["Thạc sĩ Khoa học cây trồng", "Thạc sĩ Bảo vệ thực vật"],
  };
  const stripVn = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");

  let candidateId = 100;
  function makeCandidate(majorId: number): AdminCandidate {
    const female = rand() < 0.55;
    const family = pick(familyNames);
    const middle = pick(female ? femaleMiddle : maleMiddle);
    const given = pick(female ? femaleGiven : maleGiven);
    const fullName = `${family} ${middle} ${given}`;
    const isPhd = majorId >= 5;
    const birthYear = isPhd ? int(1984, 1995) : int(1994, 2003);
    const slug = stripVn(`${given}${family}`).toLowerCase();
    return {
      candidateId: candidateId++,
      fullName,
      dob: `${birthYear}-${String(int(1, 12)).padStart(2, "0")}-${String(int(1, 28)).padStart(2, "0")}`,
      gender: female ? "NU" : "NAM",
      idNumber: `0890${String(birthYear).slice(2)}${String(int(100000, 999999))}`,
      email: `${slug}${int(10, 99)}@gmail.com`,
      phoneNumber: `09${int(10, 99)}${int(100, 999)}${int(100, 999)}`,
      address: pick(addresses),
      graduatedFrom: pick(universities),
      graduatedMajor: pick(bachelorOf[majorId]),
      graduationYear: Math.min(2026, birthYear + (isPhd ? int(26, 32) : int(22, 24))),
      gpa: Math.round((isPhd ? 3.2 + rand() * 0.7 : 2.5 + rand() * 1.3) * 100) / 100,
    };
  }

  // ---------------------------------------------------------------- Hồ sơ
  const thsDocs: [DocumentType, string][] = [
    ["VAN_BANG", "bang_tot_nghiep_dai_hoc.pdf"],
    ["BANG_DIEM", "bang_diem_toan_khoa.pdf"],
    ["CHUNG_CHI_NGOAI_NGU", "chung_chi_ngoai_ngu_b1.pdf"],
  ];
  const tsDocs: [DocumentType, string][] = [
    ["VAN_BANG", "bang_thac_si.pdf"],
    ["BANG_DIEM", "bang_diem_thac_si.pdf"],
    ["CHUNG_CHI_NGOAI_NGU", "chung_chi_ngoai_ngu_b2.pdf"],
    ["DE_CUONG_NCS", "de_cuong_nghien_cuu.pdf"],
    ["THU_GIOI_THIEU", "thu_gioi_thieu_1.pdf"],
    ["CONG_BO_KHOA_HOC", "bai_bao_khoa_hoc.pdf"],
  ];
  // Lý do không hợp lệ đúng với từng loại giấy tờ
  const invalidReasons: Partial<Record<DocumentType, string[]>> = {
    VAN_BANG: ["Bản scan bị mờ, không đọc được số hiệu văn bằng.", "Thông tin họ tên trên văn bằng không khớp với CCCD."],
    BANG_DIEM: ["Bảng điểm thiếu trang cuối có chữ ký và con dấu."],
    CHUNG_CHI_NGOAI_NGU: ["Chứng chỉ ngoại ngữ đã hết hạn (quá 2 năm kể từ ngày cấp).", "Chứng chỉ chưa đạt bậc yêu cầu của ngành."],
    DE_CUONG_NCS: ["Đề cương thiếu phần tổng quan tài liệu và kế hoạch nghiên cứu."],
    THU_GIOI_THIEU: ["Thư giới thiệu chưa có chữ ký của người giới thiệu."],
    CONG_BO_KHOA_HOC: ["Bài báo không thuộc danh mục tạp chí được tính điểm."],
  };

  let applicationId = 1;
  let documentId = 1;
  let paymentId = 1;
  let historyId = 1;
  let supplementId = 1;
  const seqByBm: Record<number, number> = {};
  const applications: AdminApplication[] = [];

  function makeApplication(batchMajorId: number, status: ReviewStatus, opts: { overdue?: boolean; unpaid?: boolean; readyToApprove?: boolean; hadSupplement?: boolean; admission?: AdminApplication["admissionStatus"] } = {}) {
    const bmRow = batchMajors.find((b) => b.batchMajorId === batchMajorId)!;
    const batch = batches.find((b) => b.batchId === bmRow.batchId)!;
    const major = majors.find((m) => m.majorId === bmRow.majorId)!;
    seqByBm[batchMajorId] = (seqByBm[batchMajorId] ?? 0) + int(1, 4);
    const code = `${batch.batchCode}-${major.majorCode}-${String(seqByBm[batchMajorId]).padStart(5, "0")}`;
    const candidate = makeCandidate(major.majorId);

    const regStart = new Date(batch.registrationStartAt).getTime();
    const regEnd = Math.min(new Date(batch.registrationEndAt).getTime(), nowMs - DAY / 2);
    // Hồ sơ càng "đi xa" trong quy trình thì nộp càng sớm
    const progress = { DRAFT: 0, SUBMITTED: 0.85, UNDER_REVIEW: 0.55, NEEDS_SUPPLEMENT: 0.35, APPROVED: 0.25, REJECTED: 0.3 }[status];
    const window = regEnd - regStart;
    const submittedMs = regStart + window * Math.max(0, Math.min(1, progress + (rand() - 0.5) * 0.25));
    const submittedAt = iso(submittedMs);
    const step = (k: number) => iso(Math.min(nowMs - 3_600_000, submittedMs + k * DAY * (0.6 + rand())));

    const docDefs = major.degreeLevel === "TIEN_SI" ? tsDocs : thsDocs;
    const documents: AdminDocument[] = docDefs.map(([documentType, fileName]) => ({
      documentId: documentId++,
      documentType,
      fileName,
      fileSizeKb: int(240, 4800),
      fileHash: hex(64),
      verifyStatus: "PENDING",
      uploadedAt: iso(submittedMs - int(1, 40) * 3_600_000),
      invalidReason: null,
    }));

    const reviewer = pick([1, 2, 8]);
    const history: StatusHistoryEntry[] = [
      { historyId: historyId++, oldStatus: "DRAFT", newStatus: "SUBMITTED", changedByType: "CANDIDATE", changedByStaffId: null, reason: null, changedAt: submittedAt },
    ];
    const supplements: SupplementRequest[] = [];
    let assignedStaffId: number | null = null;
    const push = (oldStatus: ReviewStatus, newStatus: ReviewStatus, changedAt: string, reason: string | null = null, type: "STAFF" | "CANDIDATE" | "SYSTEM" = "STAFF") =>
      history.push({ historyId: historyId++, oldStatus, newStatus, changedByType: type, changedByStaffId: type === "STAFF" ? reviewer : null, reason, changedAt });

    if (status !== "SUBMITTED") {
      assignedStaffId = reviewer;
      push("SUBMITTED", "UNDER_REVIEW", step(1));
    }

    if (status === "UNDER_REVIEW") {
      if (opts.readyToApprove) documents.forEach((d) => (d.verifyStatus = "VALID"));
      else documents.forEach((d, i) => (d.verifyStatus = i < int(0, documents.length - 1) ? "VALID" : "PENDING"));
    }

    if (status === "NEEDS_SUPPLEMENT" || opts.hadSupplement) {
      const bad = documents[int(0, documents.length - 1)];
      const reason = pick(invalidReasons[bad.documentType] ?? ["Giấy tờ chưa đúng mẫu quy định."]);
      documents.forEach((d) => (d.verifyStatus = "VALID"));
      bad.verifyStatus = "INVALID";
      bad.invalidReason = reason;
      const createdAt = step(2);
      const deadline = opts.overdue ? at(-int(1, 3), 17) : at(int(3, 9), 17);
      push("UNDER_REVIEW", "NEEDS_SUPPLEMENT", createdAt, `Bổ sung minh chứng: ${reason}`);
      supplements.push({
        requestId: supplementId++,
        requestedByStaffId: reviewer,
        content: `Đề nghị nộp lại "${bad.fileName}". ${reason}`,
        deadline,
        status: "PENDING",
        createdAt,
        respondedAt: null,
      });
      if (opts.hadSupplement) {
        const respondedAt = step(4);
        supplements[0].status = "RESOLVED";
        supplements[0].respondedAt = respondedAt;
        bad.verifyStatus = "VALID";
        bad.invalidReason = null;
        bad.fileName = bad.fileName.replace(".pdf", "_bo_sung.pdf");
        push("NEEDS_SUPPLEMENT", "UNDER_REVIEW", respondedAt, "Thí sinh đã nộp bổ sung", "CANDIDATE");
      }
    }

    if (status === "APPROVED") {
      documents.forEach((d) => (d.verifyStatus = "VALID"));
      push("UNDER_REVIEW", "APPROVED", step(5), "Hồ sơ đủ điều kiện dự tuyển.");
    }
    if (status === "REJECTED") {
      const bad = documents[0];
      bad.verifyStatus = "INVALID";
      bad.invalidReason = "Ngành tốt nghiệp không thuộc danh mục ngành phù hợp hoặc ngành gần.";
      documents.slice(1).forEach((d) => (d.verifyStatus = "VALID"));
      push("UNDER_REVIEW", "REJECTED", step(3), "Không đáp ứng điều kiện văn bằng theo Điều 6 Thông tư 53/2026/TT-BGDĐT.");
    }

    const paid = !opts.unpaid;
    const method = pick(["VNPAY", "MOMO", "BANK_TRANSFER"] as const);
    const payment: Payment = {
      paymentId: paymentId++,
      amount: major.degreeLevel === "TIEN_SI" ? 1_000_000 : 600_000,
      paymentMethod: method,
      transactionCode: paid ? `${method === "VNPAY" ? "VNP" : method === "MOMO" ? "MM" : "CK"}${int(10000000, 99999999)}` : null,
      gatewayStatus: paid ? "SUCCESS" : "PENDING",
      paidAt: paid ? iso(submittedMs - 2 * 3_600_000) : null,
    };

    applications.push({
      applicationId: applicationId++,
      applicationCode: code,
      candidate,
      batchMajorId,
      reviewStatus: status,
      admissionStatus: opts.admission ?? "NONE",
      isCancelled: false,
      submittedAt,
      assignedStaffId,
      documents,
      payment,
      supplements,
      history,
    });
  }

  // Đợt thạc sĩ đang mở — phân bố trạng thái gần với thực tế giữa kỳ tuyển sinh
  // Phân bổ lệch theo mức độ "hot" của ngành cho giống thực tế
  const thsBms = [1, 1, 1, 2, 2, 2, 2, 3, 4];
  const plan: [ReviewStatus, number, Parameters<typeof makeApplication>[2]?][] = [
    ["SUBMITTED", 12],
    ["SUBMITTED", 2, { unpaid: true }],
    ["UNDER_REVIEW", 6],
    ["UNDER_REVIEW", 5, { readyToApprove: true }],
    ["UNDER_REVIEW", 1, { unpaid: true }],
    ["NEEDS_SUPPLEMENT", 5],
    ["NEEDS_SUPPLEMENT", 2, { overdue: true }],
    ["APPROVED", 9],
    ["APPROVED", 2, { hadSupplement: true }],
    ["REJECTED", 4],
  ];
  let k = 0;
  for (const [st, count, opts] of plan) {
    for (let i = 0; i < count; i++) makeApplication(thsBms[(k++ * 7 + int(0, 8)) % thsBms.length], st, opts);
  }
  // Đợt tiến sĩ
  makeApplication(5, "SUBMITTED");
  makeApplication(6, "SUBMITTED");
  makeApplication(5, "SUBMITTED");
  makeApplication(5, "UNDER_REVIEW");
  makeApplication(6, "UNDER_REVIEW", { readyToApprove: true });
  makeApplication(5, "NEEDS_SUPPLEMENT");
  makeApplication(6, "APPROVED");
  // Đợt 1 (đã thi xong, đang xét kết quả)
  for (let i = 0; i < 10; i++) makeApplication(i % 2 === 0 ? 7 : 8, i === 9 ? "REJECTED" : "APPROVED");

  // Đẩy hồ sơ mới nộp lên đầu khi sắp xếp theo thời gian
  applications.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  // ---------------------------------------------------------------- Phúc khảo (đợt 1 — đã có điểm thi)
  const d1Apps = applications.filter((a) => (a.batchMajorId === 7 || a.batchMajorId === 8) && a.reviewStatus === "APPROVED");
  const appealReasons = [
    "Em đã trả lời đầy đủ phần câu hỏi về hướng nghiên cứu, đề nghị hội đồng xem lại điểm phỏng vấn.",
    "Điểm đánh giá hồ sơ chưa tính bài báo hội thảo em đã nộp kèm.",
    "Em nghĩ điểm phỏng vấn bị nhập nhầm so với thông báo miệng của tiểu ban.",
    "Đề nghị phúc khảo vì điểm hồ sơ thấp hơn bạn cùng khóa có GPA thấp hơn.",
  ];
  const appeals: ScoreAppeal[] = d1Apps.slice(0, 6).map((a, i) => {
    const oldScore = Math.round((5 + rand() * 3) * 4) / 4;
    const resolved = i >= 4;
    const changed = i === 4;
    return {
      appealId: i + 1,
      applicationId: a.applicationId,
      subjectName: i % 2 === 0 ? "Phỏng vấn chuyên môn" : "Đánh giá hồ sơ học thuật",
      reason: appealReasons[i % appealReasons.length],
      oldScore,
      newScore: resolved ? (changed ? oldScore + 0.75 : oldScore) : null,
      status: resolved ? (changed ? "RESOLVED_CHANGED" : "RESOLVED_UNCHANGED") : "PENDING",
      createdAt: at(-int(2, 9), int(8, 16), int(0, 59)),
      resolvedAt: resolved ? at(-1, 15, 30) : null,
      resolvedByStaffId: resolved ? 3 : null,
      resolutionNote: resolved ? (changed ? "Cộng điểm minh chứng bài báo hội thảo bị sót khi chấm." : "Hội đồng chấm lại, giữ nguyên kết quả.") : null,
    };
  });

  // ---------------------------------------------------------------- Nhật ký mẫu
  let logId = 1;
  const log = (daysAgo: number, actorId: number | null, action: string, entityTable: string | null, entityId: number | null, detail: string, actorType: AuditLog["actorType"] = "STAFF"): AuditLog => ({
    logId: logId++, actorType, actorId, action, entityTable, entityId, detail,
    // không để mốc mẫu rơi vào "tương lai" so với lúc khởi tạo
    createdAt: iso(Math.min(new Date(at(-daysAgo, int(7, 17), int(0, 59))).getTime(), nowMs - (daysAgo + 1) * 3_600_000)),
  });
  const auditLogs: AuditLog[] = [
    log(60, 1, "BATCH_CREATE", "admission_batch", 1, "Tạo đợt THS-2026-D2"),
    log(48, 5, "BATCH_MAJOR_APPROVE", "admission_batch_major", 1, "Phê duyệt chỉ tiêu Khoa học máy tính: 30"),
    log(45, 1, "BATCH_STATUS_CHANGE", "admission_batch", 1, "THS-2026-D2: Nháp → Mở đăng ký"),
    log(30, 1, "BATCH_STATUS_CHANGE", "admission_batch", 2, "TS-2026: Nháp → Mở đăng ký"),
    log(20, null, "EXAM_FINISHED", "admission_batch", 3, "Kết thúc buổi phỏng vấn đợt THS-2026-D1", "SYSTEM"),
    log(12, 6, "STAFF_LOCK", "staff_account", 7, "Khóa tài khoản CBTS-003 (nghỉ phép dài hạn)"),
    log(3, 1, "BATCH_CREATE", "admission_batch", 4, "Tạo đợt THS-2027-D1"),
    log(1, 3, "APPEAL_RESOLVE", "score_appeal", 5, "Phúc khảo: điều chỉnh điểm"),
    log(1, 3, "APPEAL_RESOLVE", "score_appeal", 6, "Phúc khảo: giữ nguyên điểm"),
    log(0, null, "SUPPLEMENT_OVERDUE_SCAN", "supplement_request", null, "Quét hạn bổ sung: phát hiện 2 yêu cầu quá hạn", "SYSTEM"),
  ];

  return {
    version: DB_VERSION,
    seededAt: iso(nowMs),
    staff,
    majors,
    batches,
    batchMajors,
    applications,
    appeals,
    auditLogs,
    notifications: [],
    seq: {
      staff: staff.length + 1,
      batch: batches.length + 1,
      batchMajor: bmId,
      subject: subjectId,
      condition: conditionId,
      history: historyId,
      supplement: supplementId,
      audit: logId,
      notification: 1,
    },
  };
}
