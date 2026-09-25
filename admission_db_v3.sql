-- ============================================================================
-- CƠ SỞ DỮ LIỆU: admission_db (v3 — đã áp dụng migration_v3_GD3.sql)
-- HỆ THỐNG QUẢN LÝ TUYỂN SINH SAU ĐẠI HỌC — PHÂN HỆ 1: QUẢN LÝ TUYỂN SINH
-- Nguồn: Đặc tả Use Case Phân hệ Tuyển sinh (bản mới) + Biên bản rà soát thiết kế v1
-- Yêu cầu môi trường: MariaDB >= 10.2.7 (bắt buộc để ràng buộc CHECK được
--                     thực sự kiểm tra, không chỉ được parse).
-- Quy ước: snake_case, khóa chính <ten_bang>_id BIGINT UNSIGNED AUTO_INCREMENT,
--          tách khóa chính nội bộ và mã nghiệp vụ (*_code), tiền tệ DECIMAL(15,2),
--          thời gian lưu UTC (tầng ứng dụng quy đổi UTC+7 khi hiển thị),
--          trạng thái kiểm soát bằng CHECK (status IN (...)),
--          "người thực hiện" luôn là FK tới staff_account, không lưu chữ tự do.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS admission_db
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE admission_db;

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- MIỀN 1 — DANH MỤC & CẤU HÌNH ĐỢT TUYỂN SINH (Nhóm A: UC-CB-01..06)
-- ============================================================================

CREATE TABLE admission_batch (
    batch_id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    batch_code              VARCHAR(30)  NOT NULL UNIQUE,
    batch_name              VARCHAR(255) NOT NULL,
    degree_level            VARCHAR(10)  NOT NULL CHECK (degree_level IN ('THAC_SI','TIEN_SI')),
    registration_start_at   DATETIME     NOT NULL,
    registration_end_at     DATETIME     NOT NULL,
    exam_start_at           DATETIME     NULL,
    exam_end_at             DATETIME     NULL,
    legal_basis             VARCHAR(100) NULL COMMENT 'VD: Thông tư 53/2026/TT-BGDĐT',
    status                  VARCHAR(20)  NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','OPEN','CLOSED','IN_REVIEW','COMPLETED','CANCELLED')),
    deleted_at              DATETIME     NULL COMMENT 'Soft delete',
    created_at              DATETIME     NOT NULL DEFAULT UTC_TIMESTAMP(),
    -- LƯU Ý: không dùng "ON UPDATE UTC_TIMESTAMP()" ở đây vì MariaDB chỉ chấp
    -- nhận họ CURRENT_TIMESTAMP cho mệnh đề ON UPDATE tự động (lỗi cú pháp nếu
    -- dùng hàm khác) — auto-update sang giờ UTC được xử lý bằng trigger
    -- trg_admission_batch_updated_at ở cuối file, để không phụ thuộc time_zone
    -- của server/session.
    updated_at              DATETIME     NOT NULL DEFAULT UTC_TIMESTAMP(),
    CHECK (registration_end_at > registration_start_at),
    CHECK (exam_start_at IS NULL OR exam_end_at IS NULL OR exam_end_at > exam_start_at)
) ENGINE=InnoDB;

CREATE TABLE admission_major (
    major_id       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    major_code     VARCHAR(20)  NOT NULL UNIQUE,
    major_name     VARCHAR(255) NOT NULL,
    degree_level   VARCHAR(10)  NOT NULL CHECK (degree_level IN ('THAC_SI','TIEN_SI')),
    faculty_name   VARCHAR(255) NULL,
    status         VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
    deleted_at     DATETIME NULL COMMENT 'Soft delete'
) ENGINE=InnoDB;

-- Chỉ tiêu & cấu hình ngành theo từng đợt (UC-CB-02)
CREATE TABLE admission_batch_major (
    batch_major_id   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    batch_id         BIGINT UNSIGNED NOT NULL,
    major_id         BIGINT UNSIGNED NOT NULL,
    quota            INT NOT NULL CHECK (quota > 0),
    benchmark_score  DECIMAL(4,2) NULL CHECK (benchmark_score IS NULL OR (benchmark_score BETWEEN 0.00 AND 10.00)),
    status           VARCHAR(20) NOT NULL DEFAULT 'CONFIGURING'
        CHECK (status IN ('CONFIGURING','APPROVED','OPEN','CLOSED')),
    UNIQUE KEY uq_batch_major (batch_id, major_id),
    CONSTRAINT fk_bm_batch FOREIGN KEY (batch_id) REFERENCES admission_batch(batch_id),
    CONSTRAINT fk_bm_major FOREIGN KEY (major_id) REFERENCES admission_major(major_id)
) ENGINE=InnoDB;

-- Điều kiện xét tuyển đầu vào theo Điều 6 TT53 (UC-CB-03)
CREATE TABLE admission_condition (
    condition_id       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    batch_major_id     BIGINT UNSIGNED NOT NULL,
    condition_code     VARCHAR(30)  NOT NULL,
    description        TEXT         NOT NULL,
    min_gpa            DECIMAL(3,2) NULL,
    required_certificate VARCHAR(255) NULL,
    is_mandatory       TINYINT(1)   NOT NULL DEFAULT 1,
    CONSTRAINT fk_cond_bm FOREIGN KEY (batch_major_id) REFERENCES admission_batch_major(batch_major_id)
) ENGINE=InnoDB;

-- Hội đồng tuyển sinh / hội đồng thi (UC-CB-04)
CREATE TABLE admission_committee (
    committee_id     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    batch_major_id   BIGINT UNSIGNED NULL,
    committee_name   VARCHAR(255) NOT NULL,
    decision_no      VARCHAR(50)  NULL,
    formed_at        DATE NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISSOLVED')),
    CONSTRAINT fk_committee_bm FOREIGN KEY (batch_major_id) REFERENCES admission_batch_major(batch_major_id)
) ENGINE=InnoDB;

CREATE TABLE committee_member (
    member_id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    committee_id       BIGINT UNSIGNED NOT NULL,
    full_name          VARCHAR(255) NOT NULL,
    lecturer_code      VARCHAR(30)  NULL,
    role_in_committee  VARCHAR(20)  NOT NULL CHECK (role_in_committee IN ('CHU_TICH','THU_KY','UY_VIEN')),
    CONSTRAINT fk_member_committee FOREIGN KEY (committee_id) REFERENCES admission_committee(committee_id)
) ENGINE=InnoDB;

-- Môn thi / hình thức xét tuyển (UC-CB-05)
CREATE TABLE exam_subject (
    subject_id      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    batch_major_id  BIGINT UNSIGNED NOT NULL,
    subject_name    VARCHAR(255) NOT NULL,
    exam_format     VARCHAR(20)  NOT NULL CHECK (exam_format IN ('THI_VIET','PHONG_VAN','XET_HO_SO')),
    weight          DECIMAL(4,2) NOT NULL DEFAULT 1.00 CHECK (weight > 0),
    max_score       DECIMAL(4,2) NOT NULL DEFAULT 10.00 CHECK (max_score > 0),
    CONSTRAINT fk_subject_bm FOREIGN KEY (batch_major_id) REFERENCES admission_batch_major(batch_major_id)
) ENGINE=InnoDB;

-- ============================================================================
-- MIỀN 2 — NGƯỜI DÙNG NỘI BỘ, PHÂN QUYỀN & CẤU HÌNH HỆ THỐNG (dùng chung)
-- ============================================================================

CREATE TABLE staff_account (
    staff_account_id  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    staff_code        VARCHAR(30)  NOT NULL UNIQUE,
    full_name         VARCHAR(255) NOT NULL,
    email             VARCHAR(255) NOT NULL UNIQUE,
    password_hash     VARCHAR(255) NULL COMMENT 'Du phong: NULL neu tai khoan chi dang nhap bang Google',
    status            VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','LOCKED','DISABLED')),
    deleted_at        DATETIME NULL COMMENT 'Soft delete'
) ENGINE=InnoDB;

CREATE TABLE role (
    role_id    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role_code  VARCHAR(30)  NOT NULL UNIQUE COMMENT 'VD: CAN_BO_TUYEN_SINH, HOI_DONG, LANH_DAO_KHOA, ADMIN',
    role_name  VARCHAR(100) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE staff_role (
    staff_role_id     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    staff_account_id  BIGINT UNSIGNED NOT NULL,
    role_id           BIGINT UNSIGNED NOT NULL,
    UNIQUE KEY uq_staff_role (staff_account_id, role_id),
    CONSTRAINT fk_sr_staff FOREIGN KEY (staff_account_id) REFERENCES staff_account(staff_account_id),
    CONSTRAINT fk_sr_role FOREIGN KEY (role_id) REFERENCES role(role_id)
) ENGINE=InnoDB;

-- Cấu hình hệ thống dùng chung: hạn OTP, dung lượng file tối đa, điểm ưu tiên...
CREATE TABLE system_config (
    config_key    VARCHAR(100) PRIMARY KEY,
    config_value  VARCHAR(500) NOT NULL,
    description   VARCHAR(255) NULL,
    -- Xem lưu ý ở admission_batch.updated_at — auto-update giờ UTC nằm ở
    -- trigger trg_system_config_updated_at cuối file, không dùng ON UPDATE.
    updated_at    DATETIME NOT NULL DEFAULT UTC_TIMESTAMP()
) ENGINE=InnoDB;

-- ============================================================================
-- MIỀN 3 — TÀI KHOẢN & HỒ SƠ CÁ NHÂN THÍ SINH (Nhóm dùng chung + UC-DK-01)
-- ============================================================================

CREATE TABLE candidate_account (
    account_id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username             VARCHAR(100) NOT NULL UNIQUE,
    email                VARCHAR(255) NULL UNIQUE,
    phone_number         VARCHAR(20)  NULL UNIQUE,
    password_hash        VARCHAR(255) NULL COMMENT 'Du phong: NULL neu tai khoan chi dang nhap bang Google',
    status               VARCHAR(20)  NOT NULL DEFAULT 'PENDING_VERIFY'
        CHECK (status IN ('PENDING_VERIFY','ACTIVE','LOCKED')),
    failed_login_count   INT NOT NULL DEFAULT 0,
    locked_until         DATETIME NULL COMMENT 'Tự mở khóa sau thời điểm này',
    deleted_at           DATETIME NULL COMMENT 'Soft delete',
    created_at           DATETIME NOT NULL DEFAULT UTC_TIMESTAMP()
) ENGINE=InnoDB;

-- Xác thực OTP dùng chung (UC-CC-02): đăng ký, quên mật khẩu, thao tác nhạy cảm
CREATE TABLE otp_verification (
    otp_id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    account_id     BIGINT UNSIGNED NOT NULL,
    purpose        VARCHAR(30) NOT NULL CHECK (purpose IN ('REGISTER','RESET_PASSWORD','SENSITIVE_ACTION')),
    otp_code_hash  VARCHAR(255) NOT NULL,
    sent_count     INT NOT NULL DEFAULT 1,
    expires_at     DATETIME NOT NULL,
    verified_at    DATETIME NULL,
    CONSTRAINT fk_otp_account FOREIGN KEY (account_id) REFERENCES candidate_account(account_id)
) ENGINE=InnoDB;

CREATE TABLE candidate (
    candidate_id   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    account_id     BIGINT UNSIGNED NOT NULL UNIQUE,
    full_name      VARCHAR(255) NOT NULL,
    dob            DATE NOT NULL,
    gender         VARCHAR(10) NULL CHECK (gender IN ('NAM','NU','KHAC')),
    id_number      VARCHAR(20) NULL UNIQUE COMMENT 'CCCD/CMND',
    address        TEXT NULL,
    nationality    VARCHAR(50) NOT NULL DEFAULT 'Việt Nam',
    deleted_at     DATETIME NULL COMMENT 'Soft delete',
    CONSTRAINT fk_candidate_account FOREIGN KEY (account_id) REFERENCES candidate_account(account_id)
) ENGINE=InnoDB;

-- ============================================================================
-- MIỀN 4 — HỒ SƠ XÉT TUYỂN, MINH CHỨNG, LỆ PHÍ & HƯỚNG DẪN NCS (Nhóm B)
-- ============================================================================

-- Hồ sơ xét tuyển. Trạng thái tách làm 2 trục độc lập (thẩm định / kết quả xét
-- tuyển) thay vì gộp 11 giá trị vào một cột như bản v1, cho dễ bảo trì và để
-- các trigger đồng bộ (Mục "TRIGGERS" cuối file) có điểm cập nhật rõ ràng.
CREATE TABLE application (
    application_id    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_code  VARCHAR(30) NOT NULL UNIQUE,
    candidate_id      BIGINT UNSIGNED NOT NULL,
    batch_major_id    BIGINT UNSIGNED NOT NULL COMMENT 'Nguyện vọng ngành trong đợt',
    review_status     VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (review_status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','NEEDS_SUPPLEMENT','APPROVED','REJECTED')),
    admission_status  VARCHAR(20) NOT NULL DEFAULT 'NONE'
        CHECK (admission_status IN ('NONE','WAITLISTED','ADMITTED','CONFIRMED','ENROLLED')),
    is_cancelled      TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Thí sinh chủ động rút hồ sơ',
    active_slot       BIGINT UNSIGNED
        GENERATED ALWAYS AS (CASE WHEN is_cancelled = 1 THEN NULL ELSE batch_major_id END) VIRTUAL,
    submitted_at      DATETIME NULL,
    deleted_at        DATETIME NULL COMMENT 'Soft delete',
    created_at        DATETIME NOT NULL DEFAULT UTC_TIMESTAMP(),
    -- Cho phép nộp lại: chỉ ràng buộc duy nhất trên các hồ sơ CHƯA bị rút
    -- (active_slot = NULL khi is_cancelled = 1, và NULL không xung đột UNIQUE).
    UNIQUE KEY uq_candidate_active_slot (candidate_id, active_slot),
    CONSTRAINT fk_app_candidate FOREIGN KEY (candidate_id) REFERENCES candidate(candidate_id),
    CONSTRAINT fk_app_bm FOREIGN KEY (batch_major_id) REFERENCES admission_batch_major(batch_major_id)
) ENGINE=InnoDB;

-- Minh chứng: văn bằng / bảng điểm / chứng chỉ ngoại ngữ / đề cương... (UC-DK-03, UC-DK-04)
-- Giới hạn 5MB/tệp theo đúng SRS (trước là 50MB); giới hạn 30MB/hồ sơ được
-- kiểm soát thêm bằng trigger trg_document_size_limit ở cuối file.
CREATE TABLE application_document (
    document_id     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id  BIGINT UNSIGNED NOT NULL,
    document_type   VARCHAR(30) NOT NULL
        CHECK (document_type IN ('VAN_BANG','BANG_DIEM','CHUNG_CHI_NGOAI_NGU','DE_CUONG_NCS',
                                  'THU_GIOI_THIEU','CONG_BO_KHOA_HOC','KHAC')),
    file_name       VARCHAR(255) NOT NULL,
    file_path       VARCHAR(500) NOT NULL COMMENT 'Đường dẫn lưu trữ (server nội bộ / object storage)',
    file_hash       CHAR(64) NOT NULL COMMENT 'SHA-256 để bảo vệ tính toàn vẹn tệp',
    file_size_kb    INT NOT NULL CHECK (file_size_kb > 0 AND file_size_kb <= 5120),
    verify_status   VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (verify_status IN ('PENDING','VALID','INVALID')),
    uploaded_at     DATETIME NOT NULL DEFAULT UTC_TIMESTAMP(),
    CONSTRAINT fk_doc_application FOREIGN KEY (application_id) REFERENCES application(application_id)
) ENGINE=InnoDB;

-- Danh mục giảng viên — dùng làm GVHD dự kiến cho NCS (mới, khắc phục việc
-- trước đây chỉ lưu tên chữ expected_supervisor_name không quản lý được trạng thái)
CREATE TABLE lecturer (
    lecturer_id    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    lecturer_code  VARCHAR(30)  NOT NULL UNIQUE,
    full_name      VARCHAR(255) NOT NULL,
    email          VARCHAR(255) NULL UNIQUE,
    faculty_name   VARCHAR(255) NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
    deleted_at     DATETIME NULL COMMENT 'Soft delete'
) ENGINE=InnoDB;

-- Đề cương nghiên cứu — chỉ áp dụng bậc Tiến sĩ (UC-DK-04)
CREATE TABLE research_proposal (
    proposal_id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id          BIGINT UNSIGNED NOT NULL UNIQUE,
    document_id             BIGINT UNSIGNED NOT NULL,
    research_topic          VARCHAR(500) NOT NULL,
    research_field          VARCHAR(255) NULL,
    preferred_lecturer_id   BIGINT UNSIGNED NULL COMMENT 'GVHD mong muốn, tham chiếu danh mục lecturer',
    CONSTRAINT fk_proposal_application FOREIGN KEY (application_id) REFERENCES application(application_id),
    CONSTRAINT fk_proposal_document FOREIGN KEY (document_id) REFERENCES application_document(document_id),
    CONSTRAINT fk_proposal_lecturer FOREIGN KEY (preferred_lecturer_id) REFERENCES lecturer(lecturer_id)
) ENGINE=InnoDB;

-- Yêu cầu & xác nhận hướng dẫn NCS (mới — khắc phục thiếu quy trình Đồng ý/Từ chối)
CREATE TABLE supervisor_request (
    request_id      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    proposal_id     BIGINT UNSIGNED NOT NULL,
    lecturer_id     BIGINT UNSIGNED NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACCEPTED','REJECTED')),
    requested_at    DATETIME NOT NULL DEFAULT UTC_TIMESTAMP(),
    responded_at    DATETIME NULL,
    response_note   TEXT NULL,
    CONSTRAINT fk_sup_req_proposal FOREIGN KEY (proposal_id) REFERENCES research_proposal(proposal_id),
    CONSTRAINT fk_sup_req_lecturer FOREIGN KEY (lecturer_id) REFERENCES lecturer(lecturer_id)
) ENGINE=InnoDB;

-- Thanh toán lệ phí xét tuyển (UC-DK-05)
CREATE TABLE application_payment (
    payment_id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id    BIGINT UNSIGNED NOT NULL,
    amount            DECIMAL(15,2) NOT NULL CHECK (amount >= 0.00),
    payment_method    VARCHAR(30) NOT NULL CHECK (payment_method IN ('BANK_TRANSFER','MOMO','VNPAY','KHAC')),
    transaction_code  VARCHAR(100) NULL UNIQUE,
    gateway_status    VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (gateway_status IN ('PENDING','SUCCESS','FAILED','REFUNDED','CANCELLED','EXPIRED')),
    receipt_no        VARCHAR(50) NULL,
    paid_at           DATETIME NULL,
    CONSTRAINT fk_payment_application FOREIGN KEY (application_id) REFERENCES application(application_id)
) ENGINE=InnoDB;

-- ============================================================================
-- MIỀN 5 — THẨM ĐỊNH & LỊCH SỬ TRẠNG THÁI HỒ SƠ (Nhóm C: UC-TD-01..04)
-- ============================================================================

CREATE TABLE application_review (
    review_id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id    BIGINT UNSIGNED NOT NULL,
    reviewer_staff_id BIGINT UNSIGNED NULL,
    review_type       VARCHAR(20) NOT NULL CHECK (review_type IN ('AUTO_CHECK','MANUAL_REVIEW')),
    review_result     VARCHAR(20) NOT NULL CHECK (review_result IN ('PASS','FAIL','NEEDS_SUPPLEMENT')),
    note              TEXT NULL,
    reviewed_at       DATETIME NOT NULL DEFAULT UTC_TIMESTAMP(),
    CONSTRAINT fk_review_application FOREIGN KEY (application_id) REFERENCES application(application_id),
    CONSTRAINT fk_review_staff FOREIGN KEY (reviewer_staff_id) REFERENCES staff_account(staff_account_id)
) ENGINE=InnoDB;

-- Yêu cầu bổ sung hồ sơ (UC-TD-02)
CREATE TABLE supplement_request (
    request_id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id        BIGINT UNSIGNED NOT NULL,
    requested_by_staff_id BIGINT UNSIGNED NULL,
    content               TEXT NOT NULL,
    deadline              DATETIME NOT NULL,
    status                VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','RESOLVED','EXPIRED')),
    responded_at          DATETIME NULL,
    CONSTRAINT fk_supplement_application FOREIGN KEY (application_id) REFERENCES application(application_id),
    CONSTRAINT fk_supplement_staff FOREIGN KEY (requested_by_staff_id) REFERENCES staff_account(staff_account_id)
) ENGINE=InnoDB;

-- Lịch sử thay đổi trạng thái hồ sơ — tách riêng khỏi audit_log để dễ truy vết
-- pháp lý (khác với audit_log dạng nhật ký tự do dùng cho mọi thao tác khác)
CREATE TABLE application_status_history (
    history_id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id         BIGINT UNSIGNED NOT NULL,
    old_status              VARCHAR(150) NULL,
    new_status               VARCHAR(150) NOT NULL,
    changed_by_type        VARCHAR(20) NOT NULL CHECK (changed_by_type IN ('STAFF','SYSTEM','CANDIDATE')),
    changed_by_staff_id    BIGINT UNSIGNED NULL,
    reason                 VARCHAR(500) NULL,
    changed_at             DATETIME NOT NULL DEFAULT UTC_TIMESTAMP(),
    CONSTRAINT fk_ash_application FOREIGN KEY (application_id) REFERENCES application(application_id),
    CONSTRAINT fk_ash_staff FOREIGN KEY (changed_by_staff_id) REFERENCES staff_account(staff_account_id)
) ENGINE=InnoDB;

-- ============================================================================
-- MIỀN 6 — TỔ CHỨC XÉT TUYỂN / THI (Nhóm D: UC-XT-01..04)
-- ============================================================================

CREATE TABLE exam_room (
    room_id     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    batch_id    BIGINT UNSIGNED NOT NULL,
    room_code   VARCHAR(20) NOT NULL,
    location    VARCHAR(255) NULL,
    capacity    INT NOT NULL CHECK (capacity > 0),
    UNIQUE KEY uq_batch_room (batch_id, room_code),
    CONSTRAINT fk_room_batch FOREIGN KEY (batch_id) REFERENCES admission_batch(batch_id)
) ENGINE=InnoDB;

-- Số báo danh & phòng thi (UC-XT-01)
CREATE TABLE exam_assignment (
    assignment_id   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id  BIGINT UNSIGNED NOT NULL UNIQUE,
    room_id         BIGINT UNSIGNED NOT NULL,
    sbd_code        VARCHAR(30) NOT NULL UNIQUE COMMENT 'Số báo danh',
    seat_no         VARCHAR(10) NULL,
    CONSTRAINT fk_assignment_application FOREIGN KEY (application_id) REFERENCES application(application_id),
    CONSTRAINT fk_assignment_room FOREIGN KEY (room_id) REFERENCES exam_room(room_id)
) ENGINE=InnoDB;

-- Lịch phỏng vấn (UC-XT-02)
CREATE TABLE interview_schedule (
    schedule_id       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id    BIGINT UNSIGNED NOT NULL,
    committee_id      BIGINT UNSIGNED NOT NULL,
    scheduled_at      DATETIME NOT NULL,
    location_or_link  VARCHAR(500) NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED'
        CHECK (status IN ('SCHEDULED','COMPLETED','CANCELLED')),
    CONSTRAINT fk_schedule_application FOREIGN KEY (application_id) REFERENCES application(application_id),
    CONSTRAINT fk_schedule_committee FOREIGN KEY (committee_id) REFERENCES admission_committee(committee_id)
) ENGINE=InnoDB;

-- Điểm thi / phỏng vấn (UC-XT-03)
CREATE TABLE exam_score (
    score_id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id    BIGINT UNSIGNED NOT NULL,
    subject_id        BIGINT UNSIGNED NOT NULL,
    score             DECIMAL(4,2) NOT NULL CHECK (score BETWEEN 0.00 AND 10.00),
    grader_staff_id   BIGINT UNSIGNED NULL,
    note              TEXT NULL,
    graded_at         DATETIME NOT NULL DEFAULT UTC_TIMESTAMP(),
    UNIQUE KEY uq_application_subject (application_id, subject_id),
    CONSTRAINT fk_score_application FOREIGN KEY (application_id) REFERENCES application(application_id),
    CONSTRAINT fk_score_subject FOREIGN KEY (subject_id) REFERENCES exam_subject(subject_id),
    CONSTRAINT fk_score_staff FOREIGN KEY (grader_staff_id) REFERENCES staff_account(staff_account_id)
) ENGINE=InnoDB;

-- Phúc khảo (UC-XT-04)
CREATE TABLE score_appeal (
    appeal_id    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    score_id     BIGINT UNSIGNED NOT NULL,
    reason       TEXT NOT NULL,
    old_score    DECIMAL(4,2) NOT NULL CHECK (old_score BETWEEN 0.00 AND 10.00),
    new_score    DECIMAL(4,2) NULL CHECK (new_score IS NULL OR new_score BETWEEN 0.00 AND 10.00),
    status       VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','RESOLVED_CHANGED','RESOLVED_UNCHANGED')),
    resolved_at  DATETIME NULL,
    CONSTRAINT fk_appeal_score FOREIGN KEY (score_id) REFERENCES exam_score(score_id)
) ENGINE=InnoDB;

-- ============================================================================
-- MIỀN 7 — XÉT TRÚNG TUYỂN (Nhóm E: UC-TT-01..05)
-- ============================================================================

-- Điểm chuẩn chốt theo ngành/đợt (UC-TT-01)
CREATE TABLE admission_benchmark (
    benchmark_id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    batch_major_id       BIGINT UNSIGNED NOT NULL UNIQUE,
    benchmark_value      DECIMAL(4,2) NOT NULL CHECK (benchmark_value BETWEEN 0.00 AND 10.00),
    decided_by_staff_id  BIGINT UNSIGNED NULL,
    decided_at           DATETIME NOT NULL DEFAULT UTC_TIMESTAMP(),
    CONSTRAINT fk_benchmark_bm FOREIGN KEY (batch_major_id) REFERENCES admission_batch_major(batch_major_id),
    CONSTRAINT fk_benchmark_staff FOREIGN KEY (decided_by_staff_id) REFERENCES staff_account(staff_account_id)
) ENGINE=InnoDB;

-- Xếp hạng thí sinh theo điểm (UC-TT-02) — total_score được trigger tự tính lại
-- mỗi khi exam_score thay đổi (kể cả do phúc khảo), xem Mục TRIGGERS cuối file.
CREATE TABLE application_ranking (
    ranking_id      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id  BIGINT UNSIGNED NOT NULL UNIQUE,
    total_score     DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    rank_order      INT NOT NULL CHECK (rank_order > 0),
    CONSTRAINT fk_ranking_application FOREIGN KEY (application_id) REFERENCES application(application_id)
) ENGINE=InnoDB;

-- Danh sách dự bị (UC-TT-03)
CREATE TABLE waitlist (
    waitlist_id     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id  BIGINT UNSIGNED NOT NULL UNIQUE,
    rank_order      INT NOT NULL CHECK (rank_order > 0),
    status          VARCHAR(20) NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING','PROMOTED','EXPIRED')),
    CONSTRAINT fk_waitlist_application FOREIGN KEY (application_id) REFERENCES application(application_id)
) ENGINE=InnoDB;

-- Kết quả xét tuyển sau duyệt & công bố (UC-TT-04, UC-TT-05) — khi published_at
-- được set, trigger tự đồng bộ sang application.admission_status.
CREATE TABLE admission_result (
    result_id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id        BIGINT UNSIGNED NOT NULL UNIQUE,
    result                VARCHAR(20) NOT NULL CHECK (result IN ('TRUNG_TUYEN','DU_BI','KHONG_TRUNG_TUYEN')),
    approved_by_staff_id  BIGINT UNSIGNED NULL,
    approved_by_leader_id BIGINT UNSIGNED NULL,
    approved_at           DATETIME NULL,
    published_at          DATETIME NULL,
    CONSTRAINT fk_result_application FOREIGN KEY (application_id) REFERENCES application(application_id),
    CONSTRAINT fk_result_staff FOREIGN KEY (approved_by_staff_id) REFERENCES staff_account(staff_account_id),
    CONSTRAINT fk_result_leader FOREIGN KEY (approved_by_leader_id) REFERENCES staff_account(staff_account_id)
) ENGINE=InnoDB;

-- ============================================================================
-- MIỀN 8 — RA QUYẾT ĐỊNH & NHẬP HỌC (Nhóm F: UC-QD-01..05)
-- ============================================================================

CREATE TABLE admission_decision (
    decision_id       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    batch_id          BIGINT UNSIGNED NOT NULL,
    decision_no       VARCHAR(50) NULL UNIQUE,
    decision_date     DATE NULL,
    file_path         VARCHAR(500) NULL COMMENT 'Đường dẫn văn bản quyết định (đã ký hoặc chờ ký)',
    status            VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','PENDING_SIGN','SIGNED','FAILED_SIGN','ISSUED')),
    signed_by_staff_id BIGINT UNSIGNED NULL,
    signed_at         DATETIME NULL,
    signature_ref     VARCHAR(255) NULL COMMENT 'Mã tham chiếu chữ ký số',
    CONSTRAINT fk_decision_batch FOREIGN KEY (batch_id) REFERENCES admission_batch(batch_id),
    CONSTRAINT fk_decision_staff FOREIGN KEY (signed_by_staff_id) REFERENCES staff_account(staff_account_id)
) ENGINE=InnoDB;

-- Danh sách thí sinh trong từng quyết định (N-N). Một quyết định vẫn có thể chỉ
-- áp dụng cho một số ngành cụ thể của đợt — quan hệ này xử lý được nhờ liên kết
-- gián tiếp qua application (không cần đổi khóa ngoại của admission_decision).
CREATE TABLE decision_application (
    detail_id       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    decision_id     BIGINT UNSIGNED NOT NULL,
    application_id  BIGINT UNSIGNED NOT NULL,
    UNIQUE KEY uq_decision_application (decision_id, application_id),
    CONSTRAINT fk_da_decision FOREIGN KEY (decision_id) REFERENCES admission_decision(decision_id),
    CONSTRAINT fk_da_application FOREIGN KEY (application_id) REFERENCES application(application_id)
) ENGINE=InnoDB;

-- Xác nhận nhập học online (UC-QD-03)
CREATE TABLE enrollment_confirmation (
    confirmation_id  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id   BIGINT UNSIGNED NOT NULL UNIQUE,
    deadline         DATETIME NOT NULL,
    confirmed_at     DATETIME NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'CHUA_XAC_NHAN'
        CHECK (status IN ('CHUA_XAC_NHAN','DA_XAC_NHAN','TU_CHOI_QUA_HAN')),
    CONSTRAINT fk_confirmation_application FOREIGN KEY (application_id) REFERENCES application(application_id)
) ENGINE=InnoDB;

-- Nộp bản chính hồ sơ khi nhập học (UC-QD-04)
CREATE TABLE original_document_submission (
    submission_id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id        BIGINT UNSIGNED NOT NULL UNIQUE,
    submitted_at          DATETIME NULL,
    verified_by_staff_id  BIGINT UNSIGNED NULL,
    verified_at           DATETIME NULL,
    status                VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','VERIFIED','MISSING')),
    CONSTRAINT fk_submission_application FOREIGN KEY (application_id) REFERENCES application(application_id),
    CONSTRAINT fk_submission_staff FOREIGN KEY (verified_by_staff_id) REFERENCES staff_account(staff_account_id)
) ENGINE=InnoDB;

-- Hoàn tất nhập học & chuyển giao sang Phân hệ Đào tạo (UC-QD-05)
CREATE TABLE enrollment_completion (
    completion_id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id           BIGINT UNSIGNED NOT NULL UNIQUE,
    completed_by_staff_id    BIGINT UNSIGNED NULL,
    completed_at             DATETIME NULL,
    transferred_to_training  TINYINT(1) NOT NULL DEFAULT 0,
    transfer_ref             VARCHAR(100) NULL COMMENT 'Mã hồ sơ bên Phân hệ Đào tạo sau khi chuyển giao',
    CONSTRAINT fk_completion_application FOREIGN KEY (application_id) REFERENCES application(application_id),
    CONSTRAINT fk_completion_staff FOREIGN KEY (completed_by_staff_id) REFERENCES staff_account(staff_account_id)
) ENGINE=InnoDB;

-- ============================================================================
-- MIỀN 9 — THÔNG BÁO & CÔNG BỐ
-- ============================================================================

-- Công bố tuyển sinh chính thức (mới — trước đây chưa có nơi lưu nội dung công bố)
CREATE TABLE announcement (
    announcement_id      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    batch_id             BIGINT UNSIGNED NULL COMMENT 'NULL = thông báo chung toàn hệ thống',
    title                VARCHAR(255) NOT NULL,
    content              TEXT NOT NULL,
    status               VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
    published_at         DATETIME NULL,
    created_by_staff_id  BIGINT UNSIGNED NULL,
    created_at           DATETIME NOT NULL DEFAULT UTC_TIMESTAMP(),
    CONSTRAINT fk_announcement_batch FOREIGN KEY (batch_id) REFERENCES admission_batch(batch_id),
    CONSTRAINT fk_announcement_staff FOREIGN KEY (created_by_staff_id) REFERENCES staff_account(staff_account_id)
) ENGINE=InnoDB;

-- Thông báo vận hành gửi tới từng cá nhân (UC-CC-03)
CREATE TABLE notification (
    notification_id  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    recipient_type   VARCHAR(20) NOT NULL CHECK (recipient_type IN ('CANDIDATE','STAFF')),
    recipient_id     BIGINT UNSIGNED NOT NULL,
    channel          VARCHAR(20) NOT NULL CHECK (channel IN ('EMAIL','SMS','SYSTEM')),
    content          TEXT NOT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENT','FAILED')),
    sent_at          DATETIME NULL
) ENGINE=InnoDB;

-- ============================================================================
-- MIỀN 10 — NHẬT KÝ HỆ THỐNG (UC-CC-01)
-- ============================================================================

CREATE TABLE audit_log (
    log_id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    actor_type    VARCHAR(20)  NOT NULL CHECK (actor_type IN ('CANDIDATE','STAFF','SYSTEM')),
    actor_id      BIGINT UNSIGNED NULL,
    action        VARCHAR(100) NOT NULL,
    entity_table  VARCHAR(100) NULL,
    entity_id     BIGINT UNSIGNED NULL,
    detail        TEXT NULL,
    created_at    DATETIME NOT NULL DEFAULT UTC_TIMESTAMP()
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- CHỈ MỤC BỔ SUNG PHỤC VỤ TRUY VẤN THƯỜNG DÙNG
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_application_review_status ON application(review_status);
CREATE INDEX IF NOT EXISTS idx_application_admission_status ON application(admission_status);
CREATE INDEX IF NOT EXISTS idx_application_batch_major ON application(batch_major_id);
CREATE INDEX IF NOT EXISTS idx_payment_status ON application_payment(gateway_status);
CREATE INDEX IF NOT EXISTS idx_review_application ON application_review(application_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_table, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_notification_recipient ON notification(recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_verification(expires_at);
CREATE INDEX IF NOT EXISTS idx_status_history_application ON application_status_history(application_id);

-- ============================================================================
-- STORED PROCEDURE DÙNG CHUNG CHO TRIGGER
-- ============================================================================

DELIMITER $$

CREATE PROCEDURE sp_recalc_application_total_score(IN p_application_id BIGINT UNSIGNED)
BEGIN
    -- SỬA LỖI: bản cũ chỉ UPDATE, nên nếu chưa có dòng application_ranking cho
    -- hồ sơ này (trường hợp thường gặp: điểm được nhập trước khi ai đó tạo
    -- dòng xếp hạng), UPDATE khớp 0 dòng -> total_score coi như "mất", và mãi
    -- treo ở giá trị mặc định cho tới khi có phúc khảo sau này. Dùng
    -- INSERT ... ON DUPLICATE KEY UPDATE để luôn tự tạo dòng nếu chưa có.
    -- rank_order = 1 chỉ là giá trị khởi tạo tạm (do cột có CHECK > 0, không
    -- nhận NULL/0); giá trị thật do bước "Xếp hạng thí sinh" (UC-TT-02) gán
    -- lại khi so sánh toàn bộ ứng viên cùng batch_major, không bị trigger này
    -- ghi đè vì mệnh đề ON DUPLICATE KEY UPDATE bên dưới chỉ đụng total_score.
    INSERT INTO application_ranking (application_id, total_score, rank_order)
    VALUES (
        p_application_id,
        (SELECT COALESCE(SUM(es.score * s.weight), 0)
         FROM exam_score es
         JOIN exam_subject s ON s.subject_id = es.subject_id
         WHERE es.application_id = p_application_id),
        1
    )
    ON DUPLICATE KEY UPDATE
        total_score = VALUES(total_score);
END$$

DELIMITER ;

-- ============================================================================
-- TRIGGERS — ràng buộc liên bảng & đồng bộ trạng thái mà CHECK constraint
-- (chỉ kiểm tra trong phạm vi 1 dòng) không thể xử lý được.
-- ============================================================================

-- 1) Bậc đào tạo của ngành phải khớp với bậc đào tạo của đợt tuyển sinh
DELIMITER $$

CREATE TRIGGER trg_batch_major_degree_check_ins
BEFORE INSERT ON admission_batch_major
FOR EACH ROW
BEGIN
    DECLARE v_batch_level VARCHAR(10);
    DECLARE v_major_level VARCHAR(10);
    SELECT degree_level INTO v_batch_level FROM admission_batch WHERE batch_id = NEW.batch_id;
    SELECT degree_level INTO v_major_level FROM admission_major WHERE major_id = NEW.major_id;
    IF v_batch_level IS NULL OR v_major_level IS NULL OR v_batch_level <> v_major_level THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Bậc đào tạo của ngành không khớp với bậc đào tạo của đợt tuyển sinh.';
    END IF;
END$$

CREATE TRIGGER trg_batch_major_degree_check_upd
BEFORE UPDATE ON admission_batch_major
FOR EACH ROW
BEGIN
    DECLARE v_batch_level VARCHAR(10);
    DECLARE v_major_level VARCHAR(10);
    SELECT degree_level INTO v_batch_level FROM admission_batch WHERE batch_id = NEW.batch_id;
    SELECT degree_level INTO v_major_level FROM admission_major WHERE major_id = NEW.major_id;
    IF v_batch_level IS NULL OR v_major_level IS NULL OR v_batch_level <> v_major_level THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Bậc đào tạo của ngành không khớp với bậc đào tạo của đợt tuyển sinh.';
    END IF;
END$$

DELIMITER ;

-- 2) Giới hạn tổng dung lượng minh chứng của một hồ sơ <= 30MB (SRS)
DELIMITER $$

CREATE TRIGGER trg_document_size_limit
BEFORE INSERT ON application_document
FOR EACH ROW
BEGIN
    DECLARE v_total INT;
    SELECT COALESCE(SUM(file_size_kb), 0) INTO v_total
    FROM application_document
    WHERE application_id = NEW.application_id;
    IF (v_total + NEW.file_size_kb) > 30720 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Tổng dung lượng minh chứng của một hồ sơ vượt quá 30MB theo quy định.';
    END IF;
END$$

DELIMITER ;

-- 3) Phúc khảo được duyệt đổi điểm -> cập nhật lại exam_score (rồi tự kéo theo
--    trigger #4 để tính lại total_score, khắc phục việc total_score không tự
--    đồng bộ sau phúc khảo)
DELIMITER $$

CREATE TRIGGER trg_score_appeal_after_update
AFTER UPDATE ON score_appeal
FOR EACH ROW
BEGIN
    IF NEW.status = 'RESOLVED_CHANGED' AND OLD.status <> 'RESOLVED_CHANGED' AND NEW.new_score IS NOT NULL THEN
        UPDATE exam_score SET score = NEW.new_score WHERE score_id = NEW.score_id;
    END IF;
END$$

DELIMITER ;

-- 4) Mỗi khi điểm thi được nhập/sửa -> tính lại total_score theo trọng số môn
DELIMITER $$

CREATE TRIGGER trg_exam_score_after_insert
AFTER INSERT ON exam_score
FOR EACH ROW
BEGIN
    CALL sp_recalc_application_total_score(NEW.application_id);
END$$

CREATE TRIGGER trg_exam_score_after_update
AFTER UPDATE ON exam_score
FOR EACH ROW
BEGIN
    CALL sp_recalc_application_total_score(NEW.application_id);
END$$

DELIMITER ;

-- 5) Đồng bộ trạng thái xét tuyển từ admission_result sang application (điểm
--    tập trung duy nhất application.admission_status thay vì rải rác 4 bảng)
DELIMITER $$

CREATE TRIGGER trg_sync_admission_result_after_update
AFTER UPDATE ON admission_result
FOR EACH ROW
BEGIN
    IF NEW.published_at IS NOT NULL AND (OLD.published_at IS NULL OR OLD.result <> NEW.result) THEN
        UPDATE application
        SET admission_status = CASE NEW.result
                                    WHEN 'TRUNG_TUYEN' THEN 'ADMITTED'
                                    WHEN 'DU_BI' THEN 'WAITLISTED'
                                    ELSE 'NONE'
                                END
        WHERE application_id = NEW.application_id;
    END IF;
END$$

DELIMITER ;

-- 6) Đồng bộ khi thí sinh xác nhận/từ chối nhập học
DELIMITER $$

CREATE TRIGGER trg_sync_enrollment_confirmation_after_update
AFTER UPDATE ON enrollment_confirmation
FOR EACH ROW
BEGIN
    IF NEW.status = 'DA_XAC_NHAN' AND OLD.status <> 'DA_XAC_NHAN' THEN
        UPDATE application SET admission_status = 'CONFIRMED' WHERE application_id = NEW.application_id;
    ELSEIF NEW.status = 'TU_CHOI_QUA_HAN' AND OLD.status <> 'TU_CHOI_QUA_HAN' THEN
        UPDATE application SET is_cancelled = 1 WHERE application_id = NEW.application_id;
    END IF;
END$$

DELIMITER ;

-- 7) Đồng bộ khi hoàn tất nhập học
DELIMITER $$

CREATE TRIGGER trg_sync_enrollment_completion_after_update
AFTER UPDATE ON enrollment_completion
FOR EACH ROW
BEGIN
    IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
        UPDATE application SET admission_status = 'ENROLLED' WHERE application_id = NEW.application_id;
    END IF;
END$$

DELIMITER ;

-- 8) Khi quyết định trúng tuyển được ban hành (ISSUED) -> đảm bảo mọi hồ sơ
--    TRUNG_TUYEN trong quyết định đó đều ở admission_status = ADMITTED, kể cả
--    khi admission_result chưa được cập nhật thủ công cho từng hồ sơ.
DELIMITER $$

CREATE TRIGGER trg_sync_decision_issued_after_update
AFTER UPDATE ON admission_decision
FOR EACH ROW
BEGIN
    IF NEW.status = 'ISSUED' AND OLD.status <> 'ISSUED' THEN
        UPDATE application a
        JOIN decision_application da ON da.application_id = a.application_id
        JOIN admission_result ar ON ar.application_id = a.application_id
        SET a.admission_status = 'ADMITTED'
        WHERE da.decision_id = NEW.decision_id AND ar.result = 'TRUNG_TUYEN';
    END IF;
END$$

DELIMITER ;

-- 9) Ghi lịch sử mỗi khi trạng thái hồ sơ thay đổi (review_status,
--    admission_status hoặc is_cancelled) — chạy sau CÙNG, bắt được cả thay đổi
--    trực tiếp lẫn thay đổi do các trigger #5-#8 cascade tới.
DELIMITER $$

CREATE TRIGGER trg_application_status_history_after_update
AFTER UPDATE ON application
FOR EACH ROW
BEGIN
    IF NOT (NEW.review_status <=> OLD.review_status
            AND NEW.admission_status <=> OLD.admission_status
            AND NEW.is_cancelled <=> OLD.is_cancelled) THEN
        INSERT INTO application_status_history
            (application_id, old_status, new_status, changed_by_type, changed_at)
        VALUES (
            NEW.application_id,
            CONCAT('review=', OLD.review_status, ';admission=', OLD.admission_status, ';cancelled=', OLD.is_cancelled),
            CONCAT('review=', NEW.review_status, ';admission=', NEW.admission_status, ';cancelled=', NEW.is_cancelled),
            'SYSTEM',
            UTC_TIMESTAMP()
        );
    END IF;
END$$

DELIMITER ;

-- 10) & 11) Thay thế "ON UPDATE UTC_TIMESTAMP()" (sai cú pháp MariaDB — ON
--     UPDATE tự động chỉ nhận họ CURRENT_TIMESTAMP) bằng trigger tự set giờ
--     UTC khi UPDATE, cho 2 bảng có cột updated_at: admission_batch, system_config.
DELIMITER $$

CREATE TRIGGER trg_admission_batch_updated_at
BEFORE UPDATE ON admission_batch
FOR EACH ROW
BEGIN
    SET NEW.updated_at = UTC_TIMESTAMP();
END$$

CREATE TRIGGER trg_system_config_updated_at
BEFORE UPDATE ON system_config
FOR EACH ROW
BEGIN
    SET NEW.updated_at = UTC_TIMESTAMP();
END$$

DELIMITER ;

-- ============================================================================
-- HẾT SCRIPT — Tổng cộng 40 bảng trên 10 miền nghiệp vụ + 1 procedure +
-- 13 trigger đồng bộ/ràng buộc liên bảng (CSDL: admission_db, v3.1 — đã áp
-- dụng migration_v3_GD3.sql + migration_v4_fix_updated_at_and_ranking.sql)
-- ============================================================================
