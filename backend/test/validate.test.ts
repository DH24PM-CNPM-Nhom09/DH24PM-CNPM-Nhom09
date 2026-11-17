// Kiểm thử đơn vị: kiểm tra / chuẩn hóa dữ liệu nhập (src/common/validate.ts). Chạy: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ageOn, dobError, fullNameError, normalizeFullName, normalizePhone, parseDateTimeVn, parseYmd, tooLong } from "../src/common/validate";

/** "Bây giờ" cố định: 10:00 sáng 06/11/2026 giờ Việt Nam */
const NOW = new Date("2026-11-06T03:00:00Z");

describe("parseYmd — ngày có thật", () => {
  it("nhận ngày hợp lệ, kể cả 29/02 năm nhuận", () => {
    assert.equal(parseYmd("2008-11-06")?.toISOString(), "2008-11-06T00:00:00.000Z");
    assert.ok(parseYmd("2024-02-29"));
  });
  it("từ chối ngày không tồn tại thay vì tự đổi sang tháng sau", () => {
    assert.equal(parseYmd("2008-02-30"), null);
    assert.equal(parseYmd("2023-02-29"), null);
    assert.equal(parseYmd("2026-04-31"), null);
    assert.equal(parseYmd("2026-13-01"), null);
  });
  it("từ chối sai định dạng", () => {
    for (const s of ["", "06/11/2008", "2008-1-6", "2008-11-06T00:00", "abc", null, undefined]) assert.equal(parseYmd(s), null, String(s));
  });
});

describe("ageOn / dobError — đủ 18 tuổi đúng ngày sinh nhật", () => {
  it("đúng ngày sinh nhật thứ 18 là đủ tuổi (công thức /365.25 cũ ra 17,9996)", () => {
    assert.equal(ageOn(parseYmd("2008-11-06")!, NOW), 18);
    assert.equal(dobError(parseYmd("2008-11-06"), NOW), null);
  });
  it("thiếu 1 ngày thì chưa đủ 18", () => {
    assert.equal(ageOn(parseYmd("2008-11-07")!, NOW), 17);
    assert.match(dobError(parseYmd("2008-11-07"), NOW)!, /18 tuổi/);
  });
  it("tính theo ngày Việt Nam: 23:30 giờ VN ngày 05/11 vẫn là ngày 05/11", () => {
    const lateEvening = new Date("2026-11-05T16:30:00Z"); // 23:30 VN ngày 05/11
    assert.equal(ageOn(parseYmd("2008-11-06")!, lateEvening), 17);
    const justAfterMidnight = new Date("2026-11-05T17:05:00Z"); // 00:05 VN ngày 06/11
    assert.equal(ageOn(parseYmd("2008-11-06")!, justAfterMidnight), 18);
  });
  it("sinh 29/02: năm không nhuận đủ tuổi vào 01/03", () => {
    const dob = parseYmd("2008-02-29")!;
    assert.equal(ageOn(dob, new Date("2026-02-28T03:00:00Z")), 17);
    assert.equal(ageOn(dob, new Date("2026-03-01T03:00:00Z")), 18);
  });
  it("ngày không có thật / quá 80 tuổi bị từ chối", () => {
    assert.ok(dobError(parseYmd("2008-02-30"), NOW));
    assert.ok(dobError(parseYmd("1940-01-01"), NOW));
  });
});

describe("Họ tên", () => {
  it("chuẩn hóa NFD (bàn phím Mac / iOS) về NFC rồi chấp nhận", () => {
    const nfd = "Nguyễn Văn Đức".normalize("NFD");
    assert.notEqual(nfd, "Nguyễn Văn Đức");
    const n = normalizeFullName(nfd);
    assert.equal(n, "Nguyễn Văn Đức");
    assert.equal(fullNameError(n), null);
  });
  it("cho phép dấu gạch nối và dấu nháy giữa các chữ", () => {
    for (const s of ["H'Hen Niê", "Nguyễn-Trần Minh An", "Y Moan Ê Ban", "O’Neil Trần"]) assert.equal(fullNameError(normalizeFullName(s)), null, s);
  });
  it("gộp khoảng trắng thừa", () => assert.equal(normalizeFullName("  Lê   Văn  Tám "), "Lê Văn Tám"));
  it("từ chối số, ký tự lạ, dấu gạch đứng đầu / liền nhau, quá ngắn, quá dài", () => {
    for (const s of ["Nguyễn Văn 2", "Lê <script>", "-An Bình", "An -- Bình", "An", "a".repeat(101)]) assert.ok(fullNameError(normalizeFullName(s)), s);
  });
});

describe("Số điện thoại", () => {
  it("đăng ký và sửa thông tin cùng một cách chuẩn hóa", () => {
    assert.equal(normalizePhone("0912 345 678"), "0912345678");
    assert.equal(normalizePhone("0912.345.678"), "0912345678");
    assert.equal(normalizePhone("0912-345-678"), "0912345678");
    assert.equal(normalizePhone("+84 912 345 678"), "0912345678");
    assert.equal(normalizePhone("(0296) 3 846 020"), "02963846020");
  });
});

describe("parseDateTimeVn — múi giờ", () => {
  it("chuỗi không có múi giờ được hiểu là giờ Việt Nam (không lệch 7 tiếng)", () => {
    assert.equal(parseDateTimeVn("2026-11-20T17:00")?.toISOString(), "2026-11-20T10:00:00.000Z");
    assert.equal(parseDateTimeVn("2026-11-20 08:30:00")?.toISOString(), "2026-11-20T01:30:00.000Z");
    assert.equal(parseDateTimeVn("2026-11-20")?.toISOString(), "2026-11-19T17:00:00.000Z");
  });
  it("chuỗi có múi giờ giữ nguyên", () => {
    assert.equal(parseDateTimeVn("2026-11-20T10:00:00.000Z")?.toISOString(), "2026-11-20T10:00:00.000Z");
    assert.equal(parseDateTimeVn("2026-11-20T17:00:00+07:00")?.toISOString(), "2026-11-20T10:00:00.000Z");
  });
  it("từ chối ngày giờ không có thật", () => {
    for (const s of ["2026-02-30T10:00", "2026-11-20T25:00", "hôm nay", "", "2026-02-30T10:00:00Z"]) assert.equal(parseDateTimeVn(s), null, s);
  });
});

describe("tooLong", () => {
  it("báo lỗi rõ thay vì để CSDL trả lỗi 500", () => {
    assert.equal(tooLong("abc", 3, "Tên"), null);
    assert.match(tooLong("abcd", 3, "Tên")!, /tối đa 3 ký tự/);
    assert.equal(tooLong(null, 3, "Tên"), null);
  });
});
