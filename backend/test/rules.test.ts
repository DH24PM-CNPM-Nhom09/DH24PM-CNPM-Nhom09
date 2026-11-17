// Kiểm thử đơn vị: quy tắc nghiệp vụ không cần CSDL — thẩm định hồ sơ, tính điểm, xếp lịch, CSV, phân quyền, phiên đăng nhập.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { to10, weightedTotal, workingSlots } from "../src/common/admission";
import { passwordVersion } from "../src/common/auth";
import { parseMoney } from "../src/common/config.service";
import { csvCell } from "../src/common/csv";
import { PERMISSION_MATRIX } from "../src/common/permissions";
import { blockReason, type ReviewFacts } from "../src/common/review-rules";
// Bản sao ma trận quyền ở frontend (chỉ để hiện / ẩn nút) phải khớp backend
import { PERMISSION_MATRIX as WEB_MATRIX } from "../../frontend/web/src/lib/admin/permissions";

const ok: ReviewFacts = { reviewStatus: "UNDER_REVIEW", isCancelled: false, paid: true, docsTotal: 3, docsValid: 3, pendingSupplementDeadline: null };

describe("Thẩm định hồ sơ (review-rules)", () => {
  it("đủ điều kiện thì được kết luận Đạt", () => assert.equal(blockReason(ok, "APPROVE"), null));
  it("chưa nộp lệ phí / còn minh chứng chưa hợp lệ thì chưa Đạt", () => {
    assert.match(blockReason({ ...ok, paid: false }, "APPROVE")!, /lệ phí/);
    assert.match(blockReason({ ...ok, docsValid: 2 }, "APPROVE")!, /minh chứng/);
  });
  it("thi tiếng Anh không đạt / vắng: không Đạt được nhưng vẫn kết luận Không đạt được", () => {
    for (const r of ["FAILED", "ABSENT"]) {
      const f = { ...ok, englishTestRequired: true, englishTestResult: r };
      assert.match(blockReason(f, "APPROVE")!, /tiếng Anh/);
      assert.equal(blockReason(f, "REJECT"), null);
    }
  });
  it("nghiên cứu sinh cần giảng viên hướng dẫn đồng ý", () => {
    assert.ok(blockReason({ ...ok, supervisorRequired: true, supervisorAccepted: false }, "APPROVE"));
    assert.equal(blockReason({ ...ok, supervisorRequired: true, supervisorAccepted: true }, "APPROVE"), null);
  });
  it("sai trạng thái / đã rút hồ sơ thì chặn", () => {
    assert.ok(blockReason({ ...ok, reviewStatus: "SUBMITTED" }, "APPROVE"));
    assert.ok(blockReason({ ...ok, isCancelled: true }, "REJECT"));
  });
  it("loại do quá hạn bổ sung chỉ khi hạn đã qua", () => {
    const f = { ...ok, reviewStatus: "NEEDS_SUPPLEMENT" };
    assert.ok(blockReason({ ...f, pendingSupplementDeadline: new Date(Date.now() + 3_600_000) }, "REJECT_EXPIRED"));
    assert.equal(blockReason({ ...f, pendingSupplementDeadline: new Date(Date.now() - 3_600_000) }, "REJECT_EXPIRED"), null);
  });
});

describe("Tính điểm theo thang 10", () => {
  it("quy từng môn về thang 10 trước khi nhân trọng số", () => {
    assert.equal(to10(4, 5), 8);
    assert.equal(to10(7, 10), 7);
    assert.equal(weightedTotal([{ score: 4, weight: 0.6, max: 5 }, { score: 8, weight: 0.4, max: 10 }]), 8);
    assert.equal(weightedTotal([{ score: 7.25, weight: 0.5 }, { score: 8.5, weight: 0.5 }]), 7.88);
  });
});

describe("Xếp lịch phỏng vấn (workingSlots)", () => {
  const vn = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 16).replace("T", " ");
  it("chỉ trong giờ hành chính, bỏ giờ nghỉ trưa và Chủ nhật", () => {
    // Thứ Bảy 21/11/2026, 11:00 giờ VN, mỗi lượt 30 phút
    const g = workingSlots(new Date("2026-11-21T04:00:00Z"), 30);
    const got = Array.from({ length: 4 }, () => vn(g.next().value as Date));
    assert.deepEqual(got, ["2026-11-21 11:00", "2026-11-21 13:30", "2026-11-21 14:00", "2026-11-21 14:30"]);
    const late = workingSlots(new Date("2026-11-21T09:45:00Z"), 30); // 16:45 thứ Bảy -> sang thứ Hai (bỏ Chủ nhật)
    assert.equal(vn(late.next().value as Date), "2026-11-23 07:30");
  });
});

describe("CSV mở bằng Excel", () => {
  it("chặn công thức, kể cả tab / CR / khoảng trắng đầu ô", () => {
    for (const s of ["=1+1", "+84", "-5", "@SUM(A1)", "\t=cmd", "\r=cmd", "  =HYPERLINK(1)"]) assert.ok(csvCell(s).startsWith(`"'`), JSON.stringify(s));
  });
  it("giữ nguyên dữ liệu thường và nhân đôi dấu ngoặc kép", () => {
    assert.equal(csvCell('Nguyễn "Văn" An'), '"Nguyễn ""Văn"" An"');
    assert.equal(csvCell(null), '""');
    assert.equal(csvCell("0912345678"), '"0912345678"');
  });
});

describe("Cấu hình lệ phí", () => {
  it("0 đồng là giá trị hợp lệ (miễn lệ phí), không quay về mặc định", () => {
    assert.equal(parseMoney("0", 100_000), 0);
    assert.equal(parseMoney("", 100_000), 100_000);
    assert.equal(parseMoney("-5", 100_000), 100_000);
    assert.equal(parseMoney("360000", 100_000), 360_000);
  });
});

describe("Phân quyền", () => {
  it("ma trận quyền frontend khớp backend", () => {
    for (const role of Object.keys(PERMISSION_MATRIX) as (keyof typeof PERMISSION_MATRIX)[])
      assert.deepEqual([...WEB_MATRIX[role]].sort(), [...PERMISSION_MATRIX[role]].sort(), role);
    assert.deepEqual(Object.keys(WEB_MATRIX).sort(), Object.keys(PERMISSION_MATRIX).sort());
  });
});

describe("Phiên đăng nhập", () => {
  it("đổi mật khẩu thì dấu phiên bản mật khẩu (pv) trong token đổi theo", () => {
    assert.notEqual(passwordVersion("$2a$10$aaa"), passwordVersion("$2a$10$bbb"));
    assert.equal(passwordVersion("$2a$10$aaa"), passwordVersion("$2a$10$aaa"));
    assert.equal(passwordVersion(null).length, 16);
  });
});
