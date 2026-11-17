-- ============================================================================
-- Migration v16 — minh chứng chuyển khoản lệ phí
-- Thí sinh chuyển khoản theo mã VietQR rồi tải ảnh chụp giao dịch thành công (biên lai điện tử)
-- để cán bộ đối chiếu nhanh trước khi bấm "Xác nhận đã nộp lệ phí".
-- Chỉ THÊM bảng mới, không sửa hay xóa bảng cũ. Chạy lại nhiều lần vẫn an toàn.
-- ============================================================================
SET NAMES utf8mb4;
USE admission_db;

CREATE TABLE IF NOT EXISTS payment_proof (
    proof_id       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    payment_id     BIGINT UNSIGNED NOT NULL,
    application_id BIGINT UNSIGNED NOT NULL,
    file_path      VARCHAR(255) NOT NULL COMMENT 'Khóa tệp (đĩa hoặc bảng stored_file)',
    file_name      VARCHAR(255) NOT NULL,
    file_size_kb   INT UNSIGNED NOT NULL,
    note           VARCHAR(500) NULL COMMENT 'Ghi chú của thí sinh: ngân hàng, giờ chuyển...',
    uploaded_at    DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
    PRIMARY KEY (proof_id),
    KEY idx_payment_proof_payment (payment_id),
    KEY idx_payment_proof_application (application_id),
    CONSTRAINT fk_proof_payment FOREIGN KEY (payment_id) REFERENCES application_payment (payment_id),
    CONSTRAINT fk_proof_application FOREIGN KEY (application_id) REFERENCES application (application_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Ảnh / PDF chứng minh đã chuyển khoản lệ phí do thí sinh tải lên';
