-- ============================================================================
-- MIGRATION v9 — Thi đánh giá năng lực tiếng Anh (mục 6.4, 7 thông báo tuyển sinh)
-- Chỉ dành cho thí sinh chọn "đăng ký dự thi" (application.language_option = 'TEST').
-- Chạy SAU migration_v8_real_notice.sql. CHỈ TẠO BẢNG MỚI, không đụng dữ liệu cũ.
-- Chạy lại nhiều lần vẫn an toàn. (npm run db:update tự chạy file này.)
-- ============================================================================
SET NAMES utf8mb4;
USE admission_db;

-- Buổi thi (một đợt tuyển sinh có thể có nhiều buổi / phòng)
CREATE TABLE IF NOT EXISTS english_test_session (
    session_id    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    batch_id      BIGINT UNSIGNED NOT NULL,
    session_code  VARCHAR(30)  NOT NULL COMMENT 'Mã phòng thi, ví dụ TA-01',
    test_at       DATETIME     NOT NULL COMMENT 'Giờ bắt đầu (UTC)',
    room          VARCHAR(100) NOT NULL,
    location      VARCHAR(255) NULL,
    capacity      INT          NOT NULL CHECK (capacity > 0 AND capacity <= 500),
    note          VARCHAR(500) NULL,
    status        VARCHAR(20)  NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED','COMPLETED','CANCELLED')),
    created_at    DATETIME     NOT NULL DEFAULT UTC_TIMESTAMP(),
    UNIQUE KEY uq_test_session_code (batch_id, session_code),
    CONSTRAINT fk_test_session_batch FOREIGN KEY (batch_id) REFERENCES admission_batch(batch_id)
) ENGINE=InnoDB;

-- Thí sinh được xếp vào buổi thi: số báo danh, số ghế, kết quả
CREATE TABLE IF NOT EXISTS english_test_registration (
    registration_id    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id     BIGINT UNSIGNED NOT NULL UNIQUE,
    session_id         BIGINT UNSIGNED NOT NULL,
    candidate_number   VARCHAR(30)  NOT NULL UNIQUE COMMENT 'Số báo danh',
    seat_no            INT          NOT NULL,
    result             VARCHAR(20)  NOT NULL DEFAULT 'PENDING' CHECK (result IN ('PENDING','PASSED','FAILED','ABSENT')),
    score              DECIMAL(5,2) NULL,
    note               VARCHAR(500) NULL,
    graded_by_staff_id BIGINT UNSIGNED NULL,
    graded_at          DATETIME     NULL,
    assigned_at        DATETIME     NOT NULL DEFAULT UTC_TIMESTAMP(),
    CONSTRAINT fk_test_reg_application FOREIGN KEY (application_id) REFERENCES application(application_id),
    CONSTRAINT fk_test_reg_session FOREIGN KEY (session_id) REFERENCES english_test_session(session_id),
    CONSTRAINT fk_test_reg_staff FOREIGN KEY (graded_by_staff_id) REFERENCES staff_account(staff_account_id)
) ENGINE=InnoDB;
