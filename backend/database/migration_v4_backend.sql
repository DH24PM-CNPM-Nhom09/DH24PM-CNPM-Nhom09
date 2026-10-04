-- ============================================================================
-- MIGRATION v4 — Bổ sung phục vụ Backend (GĐ3 → GĐ4)
-- Áp dụng trên : admission_db v3 (chạy SAU admission_db_v3.sql)
-- Nguyên tắc   : CHỈ THÊM (bảng, cột, khóa ngoại, chỉ mục, dữ liệu danh mục).
--                Không xóa, không đổi kiểu, không sửa trigger/procedure có sẵn.
--                Chạy lại nhiều lần không lỗi (IF NOT EXISTS / ON DUPLICATE KEY).
-- Kiểm thử     : MariaDB 10.4.32 (đúng bản đi kèm XAMPP 8.x).
-- ============================================================================

USE admission_db;

-- Bắt buộc: dữ liệu tiếng Việt bên dưới phải được gửi lên dạng UTF-8
SET NAMES utf8mb4;

-- ----------------------------------------------------------------------------
-- 1) Học vấn kê khai khi nộp hồ sơ (UC-DK-02)
--    v3 có admission_condition.min_gpa nhưng không có nơi lưu GPA/trường tốt
--    nghiệp của thí sinh -> không đối chiếu được điều kiện đầu vào.
--    Lưu theo TỪNG HỒ SƠ (ảnh chụp tại thời điểm nộp), không theo thí sinh.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS application_education (
    education_id      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id    BIGINT UNSIGNED NOT NULL UNIQUE,
    degree_level      VARCHAR(10)  NOT NULL CHECK (degree_level IN ('DAI_HOC','THAC_SI')),
    institution_name  VARCHAR(255) NOT NULL,
    major_name        VARCHAR(255) NOT NULL,
    graduation_year   SMALLINT     NOT NULL CHECK (graduation_year BETWEEN 1950 AND 2100),
    gpa               DECIMAL(4,2) NULL,
    gpa_scale         DECIMAL(4,2) NOT NULL DEFAULT 4.00 CHECK (gpa_scale IN (4.00, 10.00)),
    CHECK (gpa IS NULL OR (gpa >= 0 AND gpa <= gpa_scale)),
    CONSTRAINT fk_edu_application FOREIGN KEY (application_id) REFERENCES application(application_id)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 2) Cán bộ phụ trách thẩm định hồ sơ (người bấm "Tiếp nhận")
-- ----------------------------------------------------------------------------
ALTER TABLE application
    ADD COLUMN IF NOT EXISTS assigned_staff_id BIGINT UNSIGNED NULL
        COMMENT 'Cán bộ phụ trách thẩm định (v4)' AFTER admission_status;
ALTER TABLE application
    ADD CONSTRAINT fk_app_assigned_staff FOREIGN KEY IF NOT EXISTS (assigned_staff_id) REFERENCES staff_account(staff_account_id);

-- ----------------------------------------------------------------------------
-- 3) Kết quả kiểm tra từng minh chứng: lý do, ai kiểm, lúc nào
-- ----------------------------------------------------------------------------
ALTER TABLE application_document
    ADD COLUMN IF NOT EXISTS verify_note VARCHAR(500) NULL COMMENT 'Lý do khi INVALID (v4)' AFTER verify_status,
    ADD COLUMN IF NOT EXISTS verified_by_staff_id BIGINT UNSIGNED NULL AFTER verify_note,
    ADD COLUMN IF NOT EXISTS verified_at DATETIME NULL AFTER verified_by_staff_id;
ALTER TABLE application_document
    ADD CONSTRAINT fk_doc_verified_staff FOREIGN KEY IF NOT EXISTS (verified_by_staff_id) REFERENCES staff_account(staff_account_id);

-- ----------------------------------------------------------------------------
-- 4) Lãnh đạo phê duyệt chỉ tiêu / cấu hình ngành theo đợt
-- ----------------------------------------------------------------------------
ALTER TABLE admission_batch_major
    ADD COLUMN IF NOT EXISTS approved_by_staff_id BIGINT UNSIGNED NULL AFTER status,
    ADD COLUMN IF NOT EXISTS approved_at DATETIME NULL AFTER approved_by_staff_id;
ALTER TABLE admission_batch_major
    ADD CONSTRAINT fk_bm_approved_staff FOREIGN KEY IF NOT EXISTS (approved_by_staff_id) REFERENCES staff_account(staff_account_id);

-- ----------------------------------------------------------------------------
-- 5) Phúc khảo: thời điểm gửi, người xử lý, nội dung kết luận
-- ----------------------------------------------------------------------------
ALTER TABLE score_appeal
    ADD COLUMN IF NOT EXISTS created_at DATETIME NOT NULL DEFAULT UTC_TIMESTAMP() AFTER status,
    ADD COLUMN IF NOT EXISTS resolved_by_staff_id BIGINT UNSIGNED NULL AFTER resolved_at,
    ADD COLUMN IF NOT EXISTS resolution_note TEXT NULL AFTER resolved_by_staff_id;
ALTER TABLE score_appeal
    ADD CONSTRAINT fk_appeal_staff FOREIGN KEY IF NOT EXISTS (resolved_by_staff_id) REFERENCES staff_account(staff_account_id);

-- 5b) Yêu cầu bổ sung: thời điểm tạo (để tính thời gian chờ, sắp xếp)
ALTER TABLE supplement_request
    ADD COLUMN IF NOT EXISTS created_at DATETIME NOT NULL DEFAULT UTC_TIMESTAMP() AFTER status;

-- ----------------------------------------------------------------------------
-- 6) Khiếu nại chung của thí sinh (màn "Khiếu nại / Phúc khảo" phía thí sinh).
--    Phúc khảo ĐIỂM vẫn đi qua score_appeal (gắn với 1 điểm cụ thể); bảng này
--    nhận các khiếu nại không gắn điểm: kết quả xét tuyển, xử lý hồ sơ, khác.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS complaint (
    complaint_id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    candidate_id         BIGINT UNSIGNED NOT NULL,
    application_id       BIGINT UNSIGNED NULL,
    complaint_type       VARCHAR(30) NOT NULL
        CHECK (complaint_type IN ('PHUC_KHAO_DIEM','KHIEU_NAI_KET_QUA','KHIEU_NAI_HO_SO','KHAC')),
    content              TEXT NOT NULL,
    status               VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','IN_PROGRESS','RESOLVED','REJECTED')),
    response             TEXT NULL,
    handled_by_staff_id  BIGINT UNSIGNED NULL,
    created_at           DATETIME NOT NULL DEFAULT UTC_TIMESTAMP(),
    resolved_at          DATETIME NULL,
    CONSTRAINT fk_complaint_candidate FOREIGN KEY (candidate_id) REFERENCES candidate(candidate_id),
    CONSTRAINT fk_complaint_application FOREIGN KEY (application_id) REFERENCES application(application_id),
    CONSTRAINT fk_complaint_staff FOREIGN KEY (handled_by_staff_id) REFERENCES staff_account(staff_account_id)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 7) Thông báo: tiêu đề, thời điểm tạo, đã đọc (hộp thông báo của thí sinh)
-- ----------------------------------------------------------------------------
ALTER TABLE notification
    ADD COLUMN IF NOT EXISTS title VARCHAR(255) NULL AFTER channel,
    ADD COLUMN IF NOT EXISTS created_at DATETIME NOT NULL DEFAULT UTC_TIMESTAMP() AFTER sent_at,
    ADD COLUMN IF NOT EXISTS read_at DATETIME NULL AFTER created_at;

-- ----------------------------------------------------------------------------
-- 8) Chỉ mục cho các truy vấn mới
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_application_assigned ON application(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_application_submitted_at ON application(submitted_at);
CREATE INDEX IF NOT EXISTS idx_complaint_candidate ON complaint(candidate_id);
CREATE INDEX IF NOT EXISTS idx_complaint_status ON complaint(status);
CREATE INDEX IF NOT EXISTS idx_appeal_status ON score_appeal(status);
CREATE INDEX IF NOT EXISTS idx_notification_created ON notification(created_at);

-- ----------------------------------------------------------------------------
-- 9) Dữ liệu danh mục bắt buộc
--    v3 không có dòng role nào -> không phân quyền được. Mã vai trò khớp đúng
--    comment của bảng role và ma trận quyền trong code (permissions.ts).
--    Tài khoản cán bộ đầu tiên do backend tạo (npm run db:seed) để mật khẩu
--    được băm bằng bcrypt, không để mật khẩu dạng chữ trong file SQL.
-- ----------------------------------------------------------------------------
INSERT INTO role (role_code, role_name) VALUES
    ('CAN_BO_TUYEN_SINH', 'Cán bộ tuyển sinh'),
    ('HOI_DONG',          'Hội đồng tuyển sinh'),
    ('LANH_DAO_KHOA',     'Lãnh đạo khoa/viện'),
    ('ADMIN',             'Quản trị hệ thống')
ON DUPLICATE KEY UPDATE role_name = VALUES(role_name);

INSERT INTO system_config (config_key, config_value, description) VALUES
    ('OTP_EXPIRE_MINUTES',       '5',     'Thời hạn hiệu lực của mã OTP (phút)'),
    ('OTP_MAX_RESEND',           '5',     'Số lần gửi lại OTP tối đa cho một mục đích'),
    ('MAX_FILE_KB',              '5120',  'Dung lượng tối đa 1 tệp minh chứng (KB)'),
    ('MAX_APPLICATION_FILES_KB', '30720', 'Tổng dung lượng minh chứng tối đa 1 hồ sơ (KB)'),
    ('LOGIN_MAX_FAILED',         '5',     'Số lần đăng nhập sai trước khi khóa tạm'),
    ('LOGIN_LOCK_MINUTES',       '15',    'Thời gian khóa tạm sau khi đăng nhập sai quá số lần'),
    ('SUPPLEMENT_DEFAULT_DAYS',  '7',     'Số ngày mặc định cho hạn bổ sung hồ sơ')
ON DUPLICATE KEY UPDATE description = VALUES(description);  -- giữ nguyên config_value đã chỉnh

-- ----------------------------------------------------------------------------
-- GHI CHÚ cho trigger #9 (trg_application_status_history_after_update) của v3:
-- trigger này tự ghi 1 dòng lịch sử với changed_by_type = 'SYSTEM' mỗi khi
-- trạng thái hồ sơ đổi. Backend KHÔNG ghi thêm dòng thứ hai; thay vào đó, trong
-- CÙNG transaction, backend cập nhật chính dòng vừa được trigger tạo để điền
-- changed_by_type / changed_by_staff_id / reason. Nhờ vậy không cần sửa trigger,
-- và các thay đổi cascade từ trigger #5-#8 vẫn được ghi là 'SYSTEM' như cũ.
-- ============================================================================
-- HẾT MIGRATION v4 — 2 bảng mới, 13 cột mới, 5 khóa ngoại, 6 chỉ mục,
-- 4 vai trò + 7 cấu hình mặc định.
-- ============================================================================
