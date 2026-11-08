-- ============================================================================
-- Migration v14 — bộ đếm bảo mật lưu trong CSDL
-- Trước đây số lần nhập sai mã OTP và giới hạn số lần gọi API đăng nhập/đăng ký theo IP
-- chỉ nằm trong bộ nhớ của backend: máy chủ ngủ / khởi động lại (Render bản miễn phí) là mất.
-- Bảng này giữ các bộ đếm đó. Chỉ THÊM bảng mới, không sửa hay xóa bảng cũ. Chạy lại nhiều lần vẫn an toàn.
-- ============================================================================
SET NAMES utf8mb4;
USE admission_db;

CREATE TABLE IF NOT EXISTS security_counter (
    counter_key VARCHAR(191) NOT NULL COMMENT 'otp:<otp_id> hoặc rl:<ip>|<đường dẫn>',
    hits        INT UNSIGNED NOT NULL DEFAULT 0,
    reset_at    DATETIME NOT NULL COMMENT 'Hết thời hạn đếm (UTC)',
    PRIMARY KEY (counter_key),
    KEY idx_security_counter_reset (reset_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Bộ đếm nhập sai OTP và giới hạn số lần gọi API xác thực';
