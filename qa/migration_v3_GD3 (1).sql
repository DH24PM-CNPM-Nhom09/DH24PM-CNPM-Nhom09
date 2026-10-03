-- ============================================================================
-- MIGRATION v3 — Phân hệ Tuyển sinh — Áp dụng quyết định chốt GĐ3
-- Người thực hiện : Lâm Hoài An (QA / Security & Data Specialist)
-- Áp dụng trên    : admission_db (v2 -> v3)
-- Tham chiếu      : Biên bản chốt vấn đề CSDL/GĐ3 (6 hàng, xem ERD_PhanHe_TuyenSinh_GD3.md)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Hàng 1: password_hash giữ lại làm phương án dự phòng (Google Login là chính)
-- -> Đổi NOT NULL thành NULL vì tài khoản đăng ký qua Google sẽ không có mật khẩu.
-- ----------------------------------------------------------------------------
ALTER TABLE staff_account
    MODIFY COLUMN password_hash VARCHAR(255) NULL
    COMMENT 'Dự phòng: NULL nếu tài khoản chỉ đăng nhập bằng Google';

ALTER TABLE candidate_account
    MODIFY COLUMN password_hash VARCHAR(255) NULL
    COMMENT 'Dự phòng: NULL nếu tài khoản chỉ đăng nhập bằng Google';

-- ----------------------------------------------------------------------------
-- Hàng 5: bổ sung index phục vụ truy vấn audit_log theo thời gian
-- ----------------------------------------------------------------------------
CREATE INDEX idx_audit_created_at ON audit_log(created_at);

-- ----------------------------------------------------------------------------
-- Hàng 2, 4, 6: KHÔNG đổi schema — chỉ chốt bằng tài liệu, ghi lại đây để
-- người đọc migration sau này hiểu vì sao không có lệnh SQL tương ứng.
-- ----------------------------------------------------------------------------
-- Hàng 2 (notification.recipient_id / audit_log.actor_id polymorphic):
--   Giữ nguyên thiết kế polymorphic. Toàn vẹn dữ liệu đảm bảo ở tầng ứng dụng
--   (Prisma middleware / service layer), không thêm FK/trigger.
--
-- Hàng 4 (bảng permission chi tiết):
--   Không thêm bảng vào schema. RBAC dừng ở mức Role (staff_role/role);
--   quyền chi tiết theo role_code kiểm soát bằng middleware/guard ở code,
--   mô tả bằng ma trận phân quyền dạng tài liệu (không phải bảng DB).
--
-- Hàng 6 (application_payment.transaction_code UNIQUE cho phép nhiều NULL):
--   Giữ nguyên — đúng hành vi chuẩn MariaDB/MySQL. Chỉ ghi chú trong Test Case
--   của DDD để QA không báo nhầm là lỗi.

-- ----------------------------------------------------------------------------
-- Hàng 3: sửa số liệu trigger trong tài liệu (không phải lệnh SQL)
-- ----------------------------------------------------------------------------
-- Dòng comment cuối file admission_db.sql hiện ghi:
--   "Tổng cộng 40 bảng trên 10 miền nghiệp vụ + 1 procedure + 12 trigger ... (v2)"
-- Cần sửa lại thành:
--   "Tổng cộng 40 bảng trên 10 miền nghiệp vụ + 1 procedure + 11 trigger
--    đồng bộ/ràng buộc liên bảng (CSDL: admission_db, v3)"

-- ============================================================================
-- HẾT MIGRATION v3 — 2 ALTER TABLE + 1 CREATE INDEX được áp dụng thực tế.
-- Không có trigger/logic nào khác tham chiếu password_hash nên đổi NULL an toàn.
-- ============================================================================
