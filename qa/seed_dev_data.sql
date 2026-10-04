-- ============================================================================
-- DỮ LIỆU MẪU (SEED) — admission_db v3.1 — CHỈ DÙNG CHO MÔI TRƯỜNG DEV/TEST
-- Người thực hiện : Lâm Hoài An
-- Cách dùng       : nạp SAU KHI đã nạp admission_db_v3.sql (DB còn trống).
--                   Chạy lại lần 2 sẽ báo trùng khóa -> chạy seed_reset.sql trước.
-- Nội dung        : 6 tài khoản nhân viên (4 vai trò), 2 đợt tuyển sinh (ThS, TS),
--                   8 thí sinh GIẢ, 7 hồ sơ nằm ở các giai đoạn khác nhau.
-- Lưu ý          : * Mọi thí sinh/CCCD/SĐT ở đây là GIẢ. Không đưa dữ liệu thật vào repo.
--                  * Các trạng thái "trúng tuyển / xác nhận / nhập học" KHÔNG gán cứng
--                    mà được tạo bằng UPDATE để các trigger của DB tự chạy (vừa là dữ liệu
--                    mẫu, vừa là cách kiểm tra trigger hoạt động đúng).
--                  * notification.recipient_id / audit_log.actor_id là polymorphic:
--                    ở đây quy ước recipient_id = candidate_id (hoặc staff_account_id).
--                    Hãy thống nhất quy ước này với Backend.
-- ============================================================================

USE admission_db;
SET NAMES utf8mb4;

-- ----------------------------------------------------------------------------
-- 1. CẤU HÌNH HỆ THỐNG
-- ----------------------------------------------------------------------------
INSERT INTO system_config (config_key, config_value, description) VALUES
('OTP_EXPIRE_MINUTES',  '5',      'Thời hạn hiệu lực của mã OTP (phút)'),
('OTP_MAX_RESEND',      '3',      'Số lần gửi lại OTP tối đa'),
('LOGIN_MAX_FAILED',    '5',      'Số lần đăng nhập sai trước khi khóa tài khoản'),
('LOGIN_LOCK_MINUTES',  '15',     'Thời gian khóa tài khoản tạm thời (phút)'),
('FILE_MAX_SIZE_KB',    '5120',   'Dung lượng tối đa mỗi tệp minh chứng (KB)'),
('FILE_MAX_TOTAL_KB',   '30720',  'Tổng dung lượng tối đa minh chứng mỗi hồ sơ (KB)'),
('APPLICATION_FEE_VND', '500000', 'Lệ phí xét tuyển (VND)');

-- ----------------------------------------------------------------------------
-- 2. VAI TRÒ & NHÂN VIÊN
--    Email dùng để thử Google Login -> phải là email thật của từng người.
--    (Lấy từ README của repo; ai muốn dùng email khác thì sửa tại đây.)
-- ----------------------------------------------------------------------------
INSERT INTO role (role_code, role_name) VALUES
('ADMIN',             'Quản trị hệ thống'),
('CAN_BO_TUYEN_SINH', 'Cán bộ tuyển sinh'),
('HOI_DONG',          'Thành viên hội đồng tuyển sinh'),
('LANH_DAO_KHOA',     'Lãnh đạo khoa');

INSERT INTO staff_account (staff_code, full_name, email, status) VALUES
('ST001', 'Thái Hoàng Minh',   'minh_dpm235451@student.agu.edu.vn', 'ACTIVE'),
('ST002', 'Lê Phước Hào',      'hao_dpm235507@student.agu.edu.vn',  'ACTIVE'),
('ST003', 'Phạm Lư Gia Quân',  'quan_dpm235470@student.agu.edu.vn', 'ACTIVE'),
('ST004', 'Phan Minh Trí',     'tri_dpm235489@student.agu.edu.vn',  'ACTIVE'),
('ST005', 'Lâm Hoài An',       'an_dpm235402@student.agu.edu.vn',   'ACTIVE'),
('ST006', 'Tài khoản bị khóa (dùng để test)', 'locked.staff@example.com', 'LOCKED');

-- ST001 = ADMIN | ST002 = Cán bộ TS | ST003 = Hội đồng | ST004 = Lãnh đạo khoa
-- ST005 = vừa Cán bộ TS vừa Hội đồng (test 1 người nhiều vai trò) | ST006 = bị khóa, không có vai trò
INSERT INTO staff_role (staff_account_id, role_id)
SELECT s.staff_account_id, r.role_id
FROM staff_account s
JOIN role r ON (s.staff_code, r.role_code) IN (
    ('ST001', 'ADMIN'),
    ('ST002', 'CAN_BO_TUYEN_SINH'),
    ('ST003', 'HOI_DONG'),
    ('ST004', 'LANH_DAO_KHOA'),
    ('ST005', 'CAN_BO_TUYEN_SINH'),
    ('ST005', 'HOI_DONG')
);

SET @st_minh = (SELECT staff_account_id FROM staff_account WHERE staff_code = 'ST001');
SET @st_hao  = (SELECT staff_account_id FROM staff_account WHERE staff_code = 'ST002');
SET @st_quan = (SELECT staff_account_id FROM staff_account WHERE staff_code = 'ST003');
SET @st_tri  = (SELECT staff_account_id FROM staff_account WHERE staff_code = 'ST004');

-- ----------------------------------------------------------------------------
-- 3. GIẢNG VIÊN
-- ----------------------------------------------------------------------------
INSERT INTO lecturer (lecturer_code, full_name, email, faculty_name, status) VALUES
('GV001', 'PGS.TS Trần Văn Hùng',  'gv001@example.edu.vn', 'Khoa Công nghệ thông tin', 'ACTIVE'),
('GV002', 'TS. Nguyễn Thị Lan',    'gv002@example.edu.vn', 'Khoa Công nghệ thông tin', 'ACTIVE'),
('GV003', 'TS. Lê Quang Minh',     'gv003@example.edu.vn', 'Khoa Công nghệ thông tin', 'ACTIVE'),
('GV004', 'TS. Phạm Văn Nghỉ (đã nghỉ hưu)', 'gv004@example.edu.vn', 'Khoa Công nghệ thông tin', 'INACTIVE');

SET @gv1 = (SELECT lecturer_id FROM lecturer WHERE lecturer_code = 'GV001');

-- ----------------------------------------------------------------------------
-- 4. NGÀNH, ĐỢT TUYỂN SINH, CHỈ TIÊU
--    Lưu ý trigger: bậc đào tạo của ngành phải khớp bậc của đợt.
--    Giờ lưu UTC (UTC+7 = giờ Việt Nam).
-- ----------------------------------------------------------------------------
INSERT INTO admission_major (major_code, major_name, degree_level, faculty_name) VALUES
('8480101', 'Khoa học máy tính',   'THAC_SI', 'Khoa Công nghệ thông tin'),
('8340101', 'Quản trị kinh doanh', 'THAC_SI', 'Khoa Kinh tế - Quản trị kinh doanh'),
('9480101', 'Khoa học máy tính',   'TIEN_SI', 'Khoa Công nghệ thông tin');

SET @maj_khmt_ths = (SELECT major_id FROM admission_major WHERE major_code = '8480101');
SET @maj_qtkd_ths = (SELECT major_id FROM admission_major WHERE major_code = '8340101');
SET @maj_khmt_ts  = (SELECT major_id FROM admission_major WHERE major_code = '9480101');

INSERT INTO admission_batch
    (batch_code, batch_name, degree_level, registration_start_at, registration_end_at,
     exam_start_at, exam_end_at, legal_basis, status) VALUES
('2026-D1-THS', 'Tuyển sinh thạc sĩ đợt 1 năm 2026', 'THAC_SI',
 '2026-06-01 01:00:00', '2026-07-15 16:59:59', '2026-08-10 01:00:00', '2026-08-11 10:00:00',
 'Thông tư 53/2026/TT-BGDĐT', 'IN_REVIEW'),
('2026-D1-TS',  'Tuyển sinh tiến sĩ đợt 1 năm 2026', 'TIEN_SI',
 '2026-09-01 01:00:00', '2026-11-30 16:59:59', '2026-12-15 01:00:00', '2026-12-16 10:00:00',
 'Thông tư 53/2026/TT-BGDĐT', 'OPEN');

SET @batch_ths = (SELECT batch_id FROM admission_batch WHERE batch_code = '2026-D1-THS');
SET @batch_ts  = (SELECT batch_id FROM admission_batch WHERE batch_code = '2026-D1-TS');

INSERT INTO admission_batch_major (batch_id, major_id, quota, benchmark_score, status) VALUES
(@batch_ths, @maj_khmt_ths, 30, 6.50, 'CLOSED'),
(@batch_ths, @maj_qtkd_ths, 40, NULL, 'CLOSED'),
(@batch_ts,  @maj_khmt_ts,   5, NULL, 'OPEN');

SET @bm1 = (SELECT batch_major_id FROM admission_batch_major WHERE batch_id = @batch_ths AND major_id = @maj_khmt_ths);
SET @bm2 = (SELECT batch_major_id FROM admission_batch_major WHERE batch_id = @batch_ths AND major_id = @maj_qtkd_ths);
SET @bm3 = (SELECT batch_major_id FROM admission_batch_major WHERE batch_id = @batch_ts  AND major_id = @maj_khmt_ts);

INSERT INTO admission_condition (batch_major_id, condition_code, description, min_gpa, required_certificate, is_mandatory) VALUES
(@bm1, 'DK-BANG', 'Tốt nghiệp đại học ngành đúng hoặc phù hợp với ngành đăng ký', NULL, NULL, 1),
(@bm1, 'DK-GPA',  'Điểm trung bình toàn khóa đại học từ 2.00/4.00 trở lên',       2.00, NULL, 1),
(@bm1, 'DK-NN',   'Có chứng chỉ ngoại ngữ bậc 3/6 hoặc tương đương',              NULL, 'Bậc 3/6 KNLNNVN hoặc tương đương', 1),
(@bm2, 'DK-BANG', 'Tốt nghiệp đại học ngành đúng hoặc phù hợp với ngành đăng ký', NULL, NULL, 1),
(@bm2, 'DK-NN',   'Có chứng chỉ ngoại ngữ bậc 3/6 hoặc tương đương',              NULL, 'Bậc 3/6 KNLNNVN hoặc tương đương', 1),
(@bm3, 'DK-THS',  'Có bằng thạc sĩ ngành đúng hoặc phù hợp',                      NULL, NULL, 1),
(@bm3, 'DK-CB',   'Có ít nhất 01 công bố khoa học liên quan hướng nghiên cứu',    NULL, NULL, 0);

-- Môn thi / hình thức xét: tổng trọng số mỗi ngành = 1.00 để total_score nằm trong thang 0-10
INSERT INTO exam_subject (batch_major_id, subject_name, exam_format, weight) VALUES
(@bm1, 'Cơ sở ngành',                    'THI_VIET',  0.60),
(@bm1, 'Ngoại ngữ',                      'THI_VIET',  0.40),
(@bm2, 'Kiến thức cơ bản về quản trị',   'THI_VIET',  0.60),
(@bm2, 'Ngoại ngữ',                      'THI_VIET',  0.40),
(@bm3, 'Xét hồ sơ và đề cương',          'XET_HO_SO', 0.50),
(@bm3, 'Phỏng vấn chuyên môn',           'PHONG_VAN', 0.50);

SET @sub_cs = (SELECT subject_id FROM exam_subject WHERE batch_major_id = @bm1 AND subject_name = 'Cơ sở ngành');
SET @sub_nn = (SELECT subject_id FROM exam_subject WHERE batch_major_id = @bm1 AND subject_name = 'Ngoại ngữ');

-- Hội đồng tuyển sinh
INSERT INTO admission_committee (batch_major_id, committee_name, decision_no, formed_at) VALUES
(@bm1, 'Hội đồng tuyển sinh thạc sĩ - ngành Khoa học máy tính', 'QĐ-HĐTS-01/2026', '2026-07-20'),
(@bm3, 'Hội đồng tuyển sinh tiến sĩ - ngành Khoa học máy tính', 'QĐ-HĐTS-02/2026', '2026-09-05');

SET @cm1 = (SELECT committee_id FROM admission_committee WHERE decision_no = 'QĐ-HĐTS-01/2026');
SET @cm2 = (SELECT committee_id FROM admission_committee WHERE decision_no = 'QĐ-HĐTS-02/2026');

INSERT INTO committee_member (committee_id, full_name, lecturer_code, role_in_committee) VALUES
(@cm1, 'PGS.TS Trần Văn Hùng', 'GV001', 'CHU_TICH'),
(@cm1, 'TS. Nguyễn Thị Lan',   'GV002', 'THU_KY'),
(@cm1, 'TS. Lê Quang Minh',    'GV003', 'UY_VIEN'),
(@cm2, 'PGS.TS Trần Văn Hùng', 'GV001', 'CHU_TICH'),
(@cm2, 'TS. Lê Quang Minh',    'GV003', 'THU_KY'),
(@cm2, 'TS. Nguyễn Thị Lan',   'GV002', 'UY_VIEN');

INSERT INTO exam_room (batch_id, room_code, location, capacity) VALUES
(@batch_ths, 'P101', 'Phòng A1.101', 40),
(@batch_ths, 'P102', 'Phòng A1.102', 40);

-- ----------------------------------------------------------------------------
-- 5. THÍ SINH (TOÀN BỘ LÀ GIẢ) — mật khẩu NULL vì dùng Google Login
-- ----------------------------------------------------------------------------
INSERT INTO candidate_account (username, email, phone_number, status) VALUES
('thisinh01', 'thisinh01@example.com', '0900000001', 'ACTIVE'),
('thisinh02', 'thisinh02@example.com', '0900000002', 'ACTIVE'),
('thisinh03', 'thisinh03@example.com', '0900000003', 'ACTIVE'),
('thisinh04', 'thisinh04@example.com', '0900000004', 'ACTIVE'),
('thisinh05', 'thisinh05@example.com', '0900000005', 'ACTIVE'),
('thisinh06', 'thisinh06@example.com', '0900000006', 'ACTIVE'),
('thisinh07', 'thisinh07@example.com', '0900000007', 'ACTIVE'),
('thisinh08', 'thisinh08@example.com', '0900000008', 'PENDING_VERIFY');

INSERT INTO candidate (account_id, full_name, dob, gender, id_number, address)
SELECT a.account_id, v.fn, v.dob, v.g, v.idn, v.addr
FROM candidate_account a
JOIN (
    SELECT 'thisinh01' u, 'Nguyễn Văn Bình'   fn, DATE '1998-03-12' dob, 'NAM' g, '079000000001' idn, 'Ninh Kiều, Cần Thơ' addr
    UNION ALL SELECT 'thisinh02', 'Trần Thị Cẩm',     DATE '1997-07-25', 'NU',  '079000000002', 'Long Xuyên, An Giang'
    UNION ALL SELECT 'thisinh03', 'Lê Hoàng Dũng',    DATE '1999-11-02', 'NAM', '079000000003', 'Châu Đốc, An Giang'
    UNION ALL SELECT 'thisinh04', 'Phạm Thị Em',      DATE '2000-01-18', 'NU',  '079000000004', 'Cao Lãnh, Đồng Tháp'
    UNION ALL SELECT 'thisinh05', 'Võ Minh Phúc',     DATE '1996-05-30', 'NAM', '079000000005', 'Rạch Giá, Kiên Giang'
    UNION ALL SELECT 'thisinh06', 'Đặng Thu Giang',   DATE '1998-09-09', 'NU',  '079000000006', 'Vĩnh Long'
    UNION ALL SELECT 'thisinh07', 'Huỳnh Quốc Hưng',  DATE '1990-12-01', 'NAM', '079000000007', 'Ninh Kiều, Cần Thơ'
) v ON v.u = a.username;
-- thisinh08 chỉ có tài khoản (chưa xác thực OTP, chưa có hồ sơ cá nhân) để test luồng đăng ký.

INSERT INTO otp_verification (account_id, purpose, otp_code_hash, expires_at)
SELECT account_id, 'REGISTER', SHA2('seed-otp-123456', 256), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 5 MINUTE)
FROM candidate_account WHERE username = 'thisinh08';

-- ----------------------------------------------------------------------------
-- 6. HỒ SƠ XÉT TUYỂN — 7 hồ sơ ở các giai đoạn khác nhau
--    HS-0001..0004: ThS KHMT, đã duyệt, có điểm  -> kết thúc ở ENROLLED / CONFIRMED / ADMITTED / WAITLISTED
--    HS-0005      : ThS QTKD, đang chờ bổ sung minh chứng
--    HS-0006      : ThS QTKD, đang thẩm định
--    HS-0007      : TS KHMT, mới nộp, có đề cương NCS
--    admission_status để mặc định NONE rồi cho trigger tự cập nhật ở các bước sau.
-- ----------------------------------------------------------------------------
INSERT INTO application (application_code, candidate_id, batch_major_id, review_status, submitted_at)
SELECT v.code, c.candidate_id, v.bm, v.rs, v.sub
FROM candidate c
JOIN (
    SELECT 'HS-2026-0001' code, '079000000001' idn, @bm1 bm, 'APPROVED' rs,         TIMESTAMP '2026-06-10 03:00:00' sub
    UNION ALL SELECT 'HS-2026-0002', '079000000002', @bm1, 'APPROVED',         TIMESTAMP '2026-06-11 03:00:00'
    UNION ALL SELECT 'HS-2026-0003', '079000000003', @bm1, 'APPROVED',         TIMESTAMP '2026-06-12 03:00:00'
    UNION ALL SELECT 'HS-2026-0004', '079000000004', @bm1, 'APPROVED',         TIMESTAMP '2026-06-13 03:00:00'
    UNION ALL SELECT 'HS-2026-0005', '079000000005', @bm2, 'NEEDS_SUPPLEMENT', TIMESTAMP '2026-06-14 03:00:00'
    UNION ALL SELECT 'HS-2026-0006', '079000000006', @bm2, 'UNDER_REVIEW',     TIMESTAMP '2026-06-15 03:00:00'
    UNION ALL SELECT 'HS-2026-0007', '079000000007', @bm3, 'SUBMITTED',        TIMESTAMP '2026-09-20 03:00:00'
) v ON v.idn = c.id_number;

SET @app1 = (SELECT application_id FROM application WHERE application_code = 'HS-2026-0001');
SET @app2 = (SELECT application_id FROM application WHERE application_code = 'HS-2026-0002');
SET @app3 = (SELECT application_id FROM application WHERE application_code = 'HS-2026-0003');
SET @app4 = (SELECT application_id FROM application WHERE application_code = 'HS-2026-0004');
SET @app5 = (SELECT application_id FROM application WHERE application_code = 'HS-2026-0005');
SET @app6 = (SELECT application_id FROM application WHERE application_code = 'HS-2026-0006');
SET @app7 = (SELECT application_id FROM application WHERE application_code = 'HS-2026-0007');

-- Minh chứng (văn bằng + bảng điểm cho cả 7 hồ sơ). Hash là SHA-256 giả lập, tệp thật không tồn tại.
INSERT INTO application_document (application_id, document_type, file_name, file_path, file_hash, file_size_kb, verify_status)
SELECT a.application_id, d.t, d.f,
       CONCAT('uploads/seed/', a.application_code, '/', d.f),
       SHA2(CONCAT(a.application_code, '/', d.f), 256),
       d.sz,
       IF(a.review_status = 'APPROVED', 'VALID', 'PENDING')
FROM application a
JOIN (
    SELECT 'VAN_BANG' t, 'van_bang.pdf' f, 1800 sz
    UNION ALL SELECT 'BANG_DIEM', 'bang_diem.pdf', 900
) d
WHERE a.application_id IN (@app1, @app2, @app3, @app4, @app5, @app6, @app7);

-- Chứng chỉ ngoại ngữ cho 4 hồ sơ ThS KHMT
INSERT INTO application_document (application_id, document_type, file_name, file_path, file_hash, file_size_kb, verify_status)
SELECT a.application_id, 'CHUNG_CHI_NGOAI_NGU', 'chung_chi_nn.pdf',
       CONCAT('uploads/seed/', a.application_code, '/chung_chi_nn.pdf'),
       SHA2(CONCAT(a.application_code, '/chung_chi_nn.pdf'), 256), 600, 'VALID'
FROM application a
WHERE a.application_id IN (@app1, @app2, @app3, @app4);

-- Hồ sơ tiến sĩ: đề cương NCS + thư giới thiệu
INSERT INTO application_document (application_id, document_type, file_name, file_path, file_hash, file_size_kb, verify_status)
SELECT a.application_id, d.t, d.f,
       CONCAT('uploads/seed/', a.application_code, '/', d.f),
       SHA2(CONCAT(a.application_code, '/', d.f), 256), d.sz, 'PENDING'
FROM application a
JOIN (
    SELECT 'DE_CUONG_NCS' t, 'de_cuong_nghien_cuu.pdf' f, 2500 sz
    UNION ALL SELECT 'THU_GIOI_THIEU', 'thu_gioi_thieu.pdf', 300
) d
WHERE a.application_id = @app7;

-- HS-0005 có bảng điểm không hợp lệ -> bị yêu cầu bổ sung
UPDATE application_document SET verify_status = 'INVALID'
WHERE application_id = @app5 AND document_type = 'BANG_DIEM';

INSERT INTO research_proposal (application_id, document_id, research_topic, research_field, preferred_lecturer_id)
SELECT @app7, document_id, 'Ứng dụng học máy trong dự báo năng suất cây trồng vùng ĐBSCL', 'Khoa học máy tính', @gv1
FROM application_document WHERE application_id = @app7 AND document_type = 'DE_CUONG_NCS';

INSERT INTO supervisor_request (proposal_id, lecturer_id, status)
SELECT proposal_id, @gv1, 'PENDING' FROM research_proposal WHERE application_id = @app7;

-- Lệ phí. HS-0006 và HS-0007 chưa thanh toán -> transaction_code = NULL (2 dòng NULL cùng tồn tại
-- được vì UNIQUE của MariaDB cho phép nhiều NULL; đây là hành vi ĐÚNG, QA đừng báo là lỗi).
INSERT INTO application_payment (application_id, amount, payment_method, transaction_code, gateway_status, receipt_no, paid_at) VALUES
(@app1, 500000.00, 'VNPAY',         'VNP-SEED-0001', 'SUCCESS', 'BL-0001', '2026-06-10 03:05:00'),
(@app2, 500000.00, 'MOMO',          'MOMO-SEED-0002','SUCCESS', 'BL-0002', '2026-06-11 03:05:00'),
(@app3, 500000.00, 'BANK_TRANSFER', 'BANK-SEED-0003','SUCCESS', 'BL-0003', '2026-06-12 03:05:00'),
(@app4, 500000.00, 'VNPAY',         'VNP-SEED-0004', 'SUCCESS', 'BL-0004', '2026-06-13 03:05:00'),
(@app5, 500000.00, 'VNPAY',         'VNP-SEED-0005', 'SUCCESS', 'BL-0005', '2026-06-14 03:05:00'),
(@app6, 500000.00, 'VNPAY',         NULL,            'PENDING', NULL,      NULL),
(@app7, 500000.00, 'MOMO',          NULL,            'PENDING', NULL,      NULL);

-- ----------------------------------------------------------------------------
-- 7. THẨM ĐỊNH
-- ----------------------------------------------------------------------------
INSERT INTO application_review (application_id, reviewer_staff_id, review_type, review_result, note, reviewed_at) VALUES
(@app1, NULL,    'AUTO_CHECK',    'PASS', 'Đủ minh chứng bắt buộc', '2026-06-10 03:10:00'),
(@app1, @st_hao, 'MANUAL_REVIEW', 'PASS', 'Hồ sơ hợp lệ',           '2026-06-20 02:00:00'),
(@app2, NULL,    'AUTO_CHECK',    'PASS', 'Đủ minh chứng bắt buộc', '2026-06-11 03:10:00'),
(@app2, @st_hao, 'MANUAL_REVIEW', 'PASS', 'Hồ sơ hợp lệ',           '2026-06-20 02:10:00'),
(@app3, NULL,    'AUTO_CHECK',    'PASS', 'Đủ minh chứng bắt buộc', '2026-06-12 03:10:00'),
(@app3, @st_hao, 'MANUAL_REVIEW', 'PASS', 'Hồ sơ hợp lệ',           '2026-06-20 02:20:00'),
(@app4, NULL,    'AUTO_CHECK',    'PASS', 'Đủ minh chứng bắt buộc', '2026-06-13 03:10:00'),
(@app4, @st_hao, 'MANUAL_REVIEW', 'PASS', 'Hồ sơ hợp lệ',           '2026-06-20 02:30:00'),
(@app5, @st_hao, 'MANUAL_REVIEW', 'NEEDS_SUPPLEMENT', 'Bảng điểm đại học mờ, không đọc được điểm trung bình', '2026-06-20 02:40:00'),
(@app6, NULL,    'AUTO_CHECK',    'PASS', 'Đủ minh chứng bắt buộc', '2026-06-15 03:10:00'),
(@app7, NULL,    'AUTO_CHECK',    'PASS', 'Đủ minh chứng bắt buộc', '2026-09-20 03:10:00');

INSERT INTO supplement_request (application_id, requested_by_staff_id, content, deadline, status) VALUES
(@app5, @st_hao, 'Bổ sung bản scan rõ nét bảng điểm đại học có công chứng',
 DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY), 'PENDING');

-- ----------------------------------------------------------------------------
-- 8. SỐ BÁO DANH, ĐIỂM, PHÚC KHẢO, XẾP HẠNG (cho 4 hồ sơ ThS KHMT)
-- ----------------------------------------------------------------------------
INSERT INTO exam_assignment (application_id, room_id, sbd_code, seat_no)
SELECT v.app, r.room_id, v.sbd, v.seat
FROM (
    SELECT @app1 app, 'SBD2026-0001' sbd, '01' seat
    UNION ALL SELECT @app2, 'SBD2026-0002', '02'
    UNION ALL SELECT @app3, 'SBD2026-0003', '03'
    UNION ALL SELECT @app4, 'SBD2026-0004', '04'
) v
JOIN exam_room r ON r.batch_id = @batch_ths AND r.room_code = 'P101';

-- Mỗi lần INSERT exam_score, trigger tự tạo/cập nhật dòng application_ranking.total_score
INSERT INTO exam_score (application_id, subject_id, score, grader_staff_id, graded_at) VALUES
(@app1, @sub_cs, 8.50, @st_quan, '2026-08-20 03:00:00'),
(@app1, @sub_nn, 8.00, @st_quan, '2026-08-20 03:00:00'),
(@app2, @sub_cs, 7.50, @st_quan, '2026-08-20 03:00:00'),
(@app2, @sub_nn, 7.00, @st_quan, '2026-08-20 03:00:00'),
(@app3, @sub_cs, 7.00, @st_quan, '2026-08-20 03:00:00'),
(@app3, @sub_nn, 6.50, @st_quan, '2026-08-20 03:00:00'),
(@app4, @sub_cs, 5.50, @st_quan, '2026-08-20 03:00:00'),
(@app4, @sub_nn, 6.50, @st_quan, '2026-08-20 03:00:00');
-- Tổng điểm dự kiến: HS-0001 = 8.30 | HS-0002 = 7.30 | HS-0003 = 6.80 | HS-0004 = 5.90 (sẽ thành 6.20 sau phúc khảo)

-- Phúc khảo: HS-0004 xin phúc khảo môn Cơ sở ngành, được nâng 5.50 -> 6.00.
-- Tạo ở trạng thái PENDING rồi UPDATE -> trigger tự sửa exam_score -> trigger tự tính lại total_score.
-- Phải lấy score_id ra biến TRƯỚC: nếu UPDATE score_appeal mà còn đọc exam_score trong cùng câu lệnh,
-- MariaDB báo lỗi 1442 vì trigger lại sửa exam_score. (Backend cũng cần tránh kiểu viết này.)
SET @score_app4_cs = (SELECT score_id FROM exam_score WHERE application_id = @app4 AND subject_id = @sub_cs);

INSERT INTO score_appeal (score_id, reason, old_score, status)
VALUES (@score_app4_cs, 'Đề nghị chấm lại câu 3 phần Cơ sở ngành', 5.50, 'PENDING');

UPDATE score_appeal
SET status = 'RESOLVED_CHANGED', new_score = 6.00, resolved_at = '2026-08-28 03:00:00'
WHERE score_id = @score_app4_cs;

-- Xếp hạng (rank_order do bước xếp hạng gán; trigger chỉ cập nhật total_score)
UPDATE application_ranking SET rank_order = 1 WHERE application_id = @app1;
UPDATE application_ranking SET rank_order = 2 WHERE application_id = @app2;
UPDATE application_ranking SET rank_order = 3 WHERE application_id = @app3;
UPDATE application_ranking SET rank_order = 4 WHERE application_id = @app4;

-- Phỏng vấn cho hồ sơ tiến sĩ
INSERT INTO interview_schedule (application_id, committee_id, scheduled_at, location_or_link, status) VALUES
(@app7, @cm2, '2026-12-15 02:00:00', 'https://meet.example.com/seed-interview', 'SCHEDULED');

-- ----------------------------------------------------------------------------
-- 9. XÉT TRÚNG TUYỂN -> QUYẾT ĐỊNH -> XÁC NHẬN -> NHẬP HỌC
--    Mỗi bước dưới đây dùng UPDATE để trigger tự đồng bộ application.admission_status
--    và tự ghi application_status_history. Thứ tự các bước quan trọng, đừng đảo.
-- ----------------------------------------------------------------------------
INSERT INTO admission_benchmark (batch_major_id, benchmark_value, decided_by_staff_id, decided_at)
VALUES (@bm1, 6.50, @st_tri, '2026-08-30 03:00:00');

INSERT INTO waitlist (application_id, rank_order, status) VALUES (@app4, 1, 'WAITING');

-- Kết quả: tạo ở dạng CHƯA công bố (published_at = NULL)
INSERT INTO admission_result (application_id, result, approved_by_staff_id, approved_by_leader_id, approved_at) VALUES
(@app1, 'TRUNG_TUYEN', @st_hao, @st_tri, '2026-08-31 03:00:00'),
(@app2, 'TRUNG_TUYEN', @st_hao, @st_tri, '2026-08-31 03:00:00'),
(@app3, 'TRUNG_TUYEN', @st_hao, @st_tri, '2026-08-31 03:00:00'),
(@app4, 'DU_BI',       @st_hao, @st_tri, '2026-08-31 03:00:00');

-- Công bố -> trigger: HS-0001..0003 = ADMITTED, HS-0004 = WAITLISTED
UPDATE admission_result SET published_at = '2026-09-01 02:00:00'
WHERE application_id IN (@app1, @app2, @app3, @app4);

-- Quyết định trúng tuyển: SIGNED rồi ISSUED
INSERT INTO admission_decision (batch_id, decision_no, decision_date, file_path, status, signed_by_staff_id, signed_at, signature_ref)
VALUES (@batch_ths, 'QĐ-TS-THS-01/2026', '2026-09-02', 'uploads/seed/decisions/QD-TS-THS-01-2026.pdf',
        'SIGNED', @st_tri, '2026-09-02 03:00:00', 'SEED-SIGN-REF-001');

INSERT INTO decision_application (decision_id, application_id)
SELECT d.decision_id, v.app
FROM admission_decision d
JOIN (SELECT @app1 app UNION ALL SELECT @app2 UNION ALL SELECT @app3) v
WHERE d.decision_no = 'QĐ-TS-THS-01/2026';

UPDATE admission_decision SET status = 'ISSUED' WHERE decision_no = 'QĐ-TS-THS-01/2026';
-- LƯU Ý khi test: trigger này ép admission_status = 'ADMITTED' cho mọi hồ sơ TRUNG_TUYEN của quyết định,
-- nên nếu ISSUED SAU KHI thí sinh đã CONFIRMED/ENROLLED thì trạng thái sẽ bị kéo lùi. Seed này ISSUED trước nên không sao.

-- Xác nhận nhập học: tạo chưa xác nhận, rồi HS-0001 & HS-0002 xác nhận -> CONFIRMED. HS-0003 chưa xác nhận.
INSERT INTO enrollment_confirmation (application_id, deadline) VALUES
(@app1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 14 DAY)),
(@app2, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 14 DAY)),
(@app3, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 14 DAY));

UPDATE enrollment_confirmation SET status = 'DA_XAC_NHAN', confirmed_at = '2026-09-05 03:00:00'
WHERE application_id IN (@app1, @app2);

-- Nộp bản chính: HS-0001 đã xác minh, HS-0002 chưa
INSERT INTO original_document_submission (application_id, submitted_at, verified_by_staff_id, verified_at, status) VALUES
(@app1, '2026-09-10 03:00:00', @st_hao, '2026-09-10 04:00:00', 'VERIFIED'),
(@app2, NULL, NULL, NULL, 'PENDING');

-- Hoàn tất nhập học HS-0001 -> trigger: ENROLLED
INSERT INTO enrollment_completion (application_id, completed_by_staff_id, transferred_to_training, transfer_ref)
VALUES (@app1, @st_hao, 1, 'DT-SEED-0001');

UPDATE enrollment_completion SET completed_at = '2026-09-12 03:00:00' WHERE application_id = @app1;

-- ----------------------------------------------------------------------------
-- 10. THÔNG BÁO & NHẬT KÝ
-- ----------------------------------------------------------------------------
INSERT INTO announcement (batch_id, title, content, status, published_at, created_by_staff_id) VALUES
(@batch_ths, 'Kết quả xét tuyển thạc sĩ đợt 1 năm 2026',
 'Danh sách thí sinh trúng tuyển và dự bị đã được công bố trên hệ thống.', 'PUBLISHED', '2026-09-01 02:00:00', @st_hao),
(@batch_ts,  'Thông báo tuyển sinh tiến sĩ đợt 1 năm 2026',
 'Nhận hồ sơ từ 01/09/2026 đến 30/11/2026.', 'PUBLISHED', '2026-08-25 02:00:00', @st_hao),
(NULL, 'Thông báo bảo trì hệ thống (bản nháp)',
 'Hệ thống tạm ngưng để bảo trì vào cuối tuần.', 'DRAFT', NULL, @st_minh);

INSERT INTO notification (recipient_type, recipient_id, channel, content, status, sent_at)
SELECT 'CANDIDATE', c.candidate_id, v.ch, v.ct, v.st, v.sent
FROM candidate c
JOIN (
    SELECT '079000000001' idn, 'EMAIL' ch, 'Chúc mừng bạn đã trúng tuyển thạc sĩ đợt 1/2026' ct, 'SENT' st, TIMESTAMP '2026-09-01 02:05:00' sent
    UNION ALL SELECT '079000000004', 'EMAIL', 'Bạn đang trong danh sách dự bị', 'SENT', TIMESTAMP '2026-09-01 02:05:00'
    UNION ALL SELECT '079000000005', 'SYSTEM', 'Hồ sơ của bạn cần bổ sung bảng điểm', 'PENDING', NULL
    UNION ALL SELECT '079000000006', 'SMS', 'Nhắc thanh toán lệ phí xét tuyển', 'FAILED', NULL
) v ON v.idn = c.id_number;

INSERT INTO audit_log (actor_type, actor_id, action, entity_table, entity_id, detail) VALUES
('STAFF',  @st_minh, 'LOGIN_GOOGLE',       NULL,          NULL,  'Đăng nhập thành công bằng Google'),
('STAFF',  @st_hao,  'REVIEW_APPLICATION', 'application', @app5, 'Yêu cầu bổ sung bảng điểm'),
('SYSTEM', NULL,     'AUTO_RANKING',       'application_ranking', NULL, 'Tính lại tổng điểm sau phúc khảo');

-- ============================================================================
-- KIỂM TRA NHANH SAU KHI NẠP (kết quả mong đợi ghi bên cạnh)
-- ============================================================================
SELECT application_code, review_status, admission_status
FROM application ORDER BY application_code;
-- 0001 APPROVED ENROLLED | 0002 APPROVED CONFIRMED | 0003 APPROVED ADMITTED | 0004 APPROVED WAITLISTED
-- 0005 NEEDS_SUPPLEMENT NONE | 0006 UNDER_REVIEW NONE | 0007 SUBMITTED NONE

SELECT a.application_code, r.total_score, r.rank_order
FROM application_ranking r JOIN application a ON a.application_id = r.application_id
ORDER BY r.rank_order;
-- 8.30 / 7.30 / 6.80 / 6.20 (HS-0004 là 6.20 chứ không phải 5.90 -> chứng tỏ trigger phúc khảo chạy đúng)

SELECT COUNT(*) AS so_dong_lich_su_trang_thai FROM application_status_history;
-- 7 dòng do trigger tự ghi (HS-0001: 3, HS-0002: 2, HS-0003: 1, HS-0004: 1)
