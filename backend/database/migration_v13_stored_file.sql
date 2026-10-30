-- ============================================================================
-- Migration v13 — lưu nội dung tệp minh chứng ngay trong CSDL (tùy chọn)
-- Dùng khi chạy backend trên máy chủ không có ổ đĩa lâu dài (VD Render bản miễn phí):
-- đặt UPLOAD_STORAGE=db thì tệp tải lên được ghi vào bảng này thay vì thư mục uploads.
-- Chỉ THÊM bảng mới, không sửa hay xóa bảng cũ. Chạy lại nhiều lần vẫn an toàn.
-- ============================================================================
SET NAMES utf8mb4;
USE admission_db;

CREATE TABLE IF NOT EXISTS stored_file (
    file_path  VARCHAR(255) NOT NULL COMMENT 'Trùng application_document.file_path',
    content    LONGBLOB NOT NULL COMMENT 'Nội dung tệp (PDF/JPG/PNG, tối đa 5MB)',
    size_bytes INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (file_path)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Nội dung tệp minh chứng khi UPLOAD_STORAGE=db';
