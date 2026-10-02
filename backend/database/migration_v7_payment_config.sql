-- ============================================================================
-- MIGRATION v7 — Cấu hình lệ phí xét tuyển & tài khoản nhận chuyển khoản
-- Chạy SAU migration_v6_staff_security.sql. CHỈ THÊM dòng cấu hình, không xóa gì.
-- Chạy lại nhiều lần vẫn an toàn: giá trị đã chỉnh trên trang quản trị được giữ nguyên.
-- Thông tin tài khoản ngân hàng để trống: cán bộ tuyển sinh điền ở trang
-- "Lệ phí & thanh toán" (/admin/payment-settings) theo tài khoản thật của Trường.
-- (npm run db:update tự chạy file này.)
-- ============================================================================
SET NAMES utf8mb4;
USE admission_db;

INSERT INTO system_config (config_key, config_value, description) VALUES
    ('APPLICATION_FEE_THAC_SI', '600000',  'Lệ phí xét tuyển thạc sĩ (đồng)'),
    ('APPLICATION_FEE_TIEN_SI', '1000000', 'Lệ phí xét tuyển tiến sĩ (đồng)'),
    ('PAYMENT_BANK_NAME',       '',        'Ngân hàng nhận lệ phí'),
    ('PAYMENT_ACCOUNT_NO',      '',        'Số tài khoản nhận lệ phí'),
    ('PAYMENT_ACCOUNT_NAME',    '',        'Tên chủ tài khoản nhận lệ phí')
ON DUPLICATE KEY UPDATE description = VALUES(description);
