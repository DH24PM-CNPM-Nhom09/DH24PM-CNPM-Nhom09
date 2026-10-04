-- ============================================================================
-- MIGRATION v10 — Xét tuyển, công bố kết quả, quyết định trúng tuyển, nhập học
-- (M5 tiểu ban / lịch phỏng vấn / điểm, M6 điểm chuẩn / xếp hạng, M7 quyết định).
-- Các bảng nghiệp vụ chính (admission_committee, interview_schedule, exam_score,
-- admission_result, waitlist, admission_decision, enrollment_confirmation...) ĐÃ CÓ
-- trong admission_db_v3. File này chỉ THÊM 4 cột, 1 bảng đơn phúc khảo và cấu hình.
-- Chạy SAU migration_v9_english_test.sql. Chạy lại nhiều lần vẫn an toàn.
-- (npm run db:update tự chạy file này.) Không xóa, không sửa dữ liệu cũ.
-- ============================================================================
SET NAMES utf8mb4;
USE admission_db;

-- Mốc công bố điểm và hạn phúc khảo của từng ngành trong đợt
ALTER TABLE admission_batch_major
    ADD COLUMN IF NOT EXISTS scores_published_at DATETIME NULL COMMENT 'Lúc công bố điểm cho thí sinh (UTC), sau mốc này không sửa điểm trực tiếp',
    ADD COLUMN IF NOT EXISTS appeal_deadline     DATETIME NULL COMMENT 'Hạn nộp đơn phúc khảo (UTC)',
    ADD COLUMN IF NOT EXISTS result_return_note  VARCHAR(500) NULL COMMENT 'Lý do lãnh đạo trả lại kết quả xét tuyển';

-- Lý do lãnh đạo trả lại dự thảo quyết định trúng tuyển (trạng thái FAILED_SIGN)
ALTER TABLE admission_decision
    ADD COLUMN IF NOT EXISTS return_note VARCHAR(500) NULL COMMENT 'Lý do trả lại khi chưa ký';

-- Đơn phúc khảo của thí sinh (một hồ sơ một đơn, gồm một hoặc nhiều điểm thành phần
-- trong score_appeal). Lệ phí tính theo hồ sơ (cấu hình FEE_APPEAL).
CREATE TABLE IF NOT EXISTS appeal_request (
    request_id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id         BIGINT UNSIGNED NOT NULL,
    reason                 TEXT NOT NULL,
    fee_amount             DECIMAL(15,2) NOT NULL CHECK (fee_amount >= 0),
    status                 VARCHAR(20) NOT NULL DEFAULT 'CHO_NOP_PHI' CHECK (status IN ('CHO_NOP_PHI','DA_NOP_PHI','DONG')),
    created_at             DATETIME NOT NULL DEFAULT UTC_TIMESTAMP(),
    paid_at                DATETIME NULL,
    receipt_no             VARCHAR(50) NULL,
    confirmed_by_staff_id  BIGINT UNSIGNED NULL,
    UNIQUE KEY uq_appeal_request_application (application_id),
    CONSTRAINT fk_appeal_request_application FOREIGN KEY (application_id) REFERENCES application(application_id),
    CONSTRAINT fk_appeal_request_staff FOREIGN KEY (confirmed_by_staff_id) REFERENCES staff_account(staff_account_id)
) ENGINE=InnoDB;

INSERT IGNORE INTO system_config (config_key, config_value, description) VALUES
    ('APPEAL_WINDOW_DAYS',   '7',  'Số ngày thí sinh được nộp đơn phúc khảo kể từ khi công bố điểm'),
    ('ENROLL_CONFIRM_DAYS',  '15', 'Số ngày thí sinh trúng tuyển phải xác nhận nhập học kể từ khi ký quyết định'),
    ('INTERVIEW_MINUTES',    '20', 'Thời lượng mặc định mỗi lượt phỏng vấn / trình bày đề cương (phút)');
