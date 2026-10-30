-- ============================================================================
-- admission_db cho MySQL 8 (Aiven...) — TỰ SINH từ bản MariaDB đầy đủ v3 -> v13 bằng mariadb_to_mysql.py.
-- Không sửa tay. Backend tự chạy file này khi CSDL còn trống (npm run start:hosted, DB_AUTO_INIT=true).
-- Không có trigger/procedure: các ràng buộc tương ứng đã được làm trong code backend.
-- Chạy với FOREIGN_KEY_CHECKS=0 (bảng tạo theo thứ tự chữ cái). Chạy lại nhiều lần vẫn an toàn.
-- ============================================================================
/*!40101 SET NAMES utf8mb4 */;
CREATE TABLE IF NOT EXISTS `admission_batch` (
  `batch_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `batch_code` varchar(30) NOT NULL,
  `batch_name` varchar(255) NOT NULL,
  `degree_level` varchar(10) NOT NULL CHECK (`degree_level` in ('THAC_SI','TIEN_SI')),
  `registration_start_at` datetime NOT NULL,
  `registration_end_at` datetime NOT NULL,
  `exam_start_at` datetime DEFAULT NULL,
  `exam_end_at` datetime DEFAULT NULL,
  `legal_basis` varchar(100) DEFAULT NULL COMMENT 'VD: Thông tư 53/2026/TT-BGDĐT',
  `status` varchar(20) NOT NULL DEFAULT 'DRAFT' CHECK (`status` in ('DRAFT','OPEN','CLOSED','IN_REVIEW','COMPLETED','CANCELLED')),
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete',
  `created_at` datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
  `updated_at` datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (`batch_id`),
  UNIQUE KEY `batch_code` (`batch_code`),
  CONSTRAINT `admission_batch_ck_1` CHECK (`registration_end_at` > `registration_start_at`),
  CONSTRAINT `admission_batch_ck_2` CHECK (`exam_start_at` is null or `exam_end_at` is null or `exam_end_at` > `exam_start_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admission_batch_major` (
  `batch_major_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `batch_id` bigint(20) unsigned NOT NULL,
  `major_id` bigint(20) unsigned NOT NULL,
  `quota` int(11) NOT NULL CHECK (`quota` > 0),
  `benchmark_score` decimal(4,2) DEFAULT NULL CHECK (`benchmark_score` is null or `benchmark_score` between 0.00 and 10.00),
  `status` varchar(20) NOT NULL DEFAULT 'CONFIGURING' CHECK (`status` in ('CONFIGURING','APPROVED','OPEN','CLOSED')),
  `approved_by_staff_id` bigint(20) unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `scores_published_at` datetime DEFAULT NULL COMMENT 'Lúc công bố điểm cho thí sinh (UTC), sau mốc này không sửa điểm trực tiếp',
  `appeal_deadline` datetime DEFAULT NULL COMMENT 'Hạn nộp đơn phúc khảo (UTC)',
  `result_return_note` varchar(500) DEFAULT NULL COMMENT 'Lý do lãnh đạo trả lại kết quả xét tuyển',
  PRIMARY KEY (`batch_major_id`),
  UNIQUE KEY `uq_batch_major` (`batch_id`,`major_id`),
  KEY `fk_bm_major` (`major_id`),
  KEY `fk_bm_approved_staff` (`approved_by_staff_id`),
  CONSTRAINT `fk_bm_approved_staff` FOREIGN KEY (`approved_by_staff_id`) REFERENCES `staff_account` (`staff_account_id`),
  CONSTRAINT `fk_bm_batch` FOREIGN KEY (`batch_id`) REFERENCES `admission_batch` (`batch_id`),
  CONSTRAINT `fk_bm_major` FOREIGN KEY (`major_id`) REFERENCES `admission_major` (`major_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admission_benchmark` (
  `benchmark_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `batch_major_id` bigint(20) unsigned NOT NULL,
  `benchmark_value` decimal(4,2) NOT NULL CHECK (`benchmark_value` between 0.00 and 10.00),
  `decided_by_staff_id` bigint(20) unsigned DEFAULT NULL,
  `decided_at` datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (`benchmark_id`),
  UNIQUE KEY `batch_major_id` (`batch_major_id`),
  KEY `fk_benchmark_staff` (`decided_by_staff_id`),
  CONSTRAINT `fk_benchmark_bm` FOREIGN KEY (`batch_major_id`) REFERENCES `admission_batch_major` (`batch_major_id`),
  CONSTRAINT `fk_benchmark_staff` FOREIGN KEY (`decided_by_staff_id`) REFERENCES `staff_account` (`staff_account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admission_committee` (
  `committee_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `batch_major_id` bigint(20) unsigned DEFAULT NULL,
  `committee_name` varchar(255) NOT NULL,
  `decision_no` varchar(50) DEFAULT NULL,
  `formed_at` date DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (`status` in ('ACTIVE','DISSOLVED')),
  PRIMARY KEY (`committee_id`),
  KEY `fk_committee_bm` (`batch_major_id`),
  CONSTRAINT `fk_committee_bm` FOREIGN KEY (`batch_major_id`) REFERENCES `admission_batch_major` (`batch_major_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admission_condition` (
  `condition_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `batch_major_id` bigint(20) unsigned NOT NULL,
  `condition_code` varchar(30) NOT NULL,
  `description` text NOT NULL,
  `min_gpa` decimal(3,2) DEFAULT NULL,
  `required_certificate` varchar(255) DEFAULT NULL,
  `is_mandatory` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`condition_id`),
  KEY `fk_cond_bm` (`batch_major_id`),
  CONSTRAINT `fk_cond_bm` FOREIGN KEY (`batch_major_id`) REFERENCES `admission_batch_major` (`batch_major_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admission_decision` (
  `decision_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `batch_id` bigint(20) unsigned NOT NULL,
  `decision_no` varchar(50) DEFAULT NULL,
  `decision_date` date DEFAULT NULL,
  `file_path` varchar(500) DEFAULT NULL COMMENT 'Đường dẫn văn bản quyết định (đã ký hoặc chờ ký)',
  `status` varchar(20) NOT NULL DEFAULT 'DRAFT' CHECK (`status` in ('DRAFT','PENDING_SIGN','SIGNED','FAILED_SIGN','ISSUED')),
  `signed_by_staff_id` bigint(20) unsigned DEFAULT NULL,
  `signed_at` datetime DEFAULT NULL,
  `signature_ref` varchar(255) DEFAULT NULL COMMENT 'Mã tham chiếu chữ ký số',
  `return_note` varchar(500) DEFAULT NULL COMMENT 'Lý do trả lại khi chưa ký',
  PRIMARY KEY (`decision_id`),
  UNIQUE KEY `decision_no` (`decision_no`),
  KEY `fk_decision_batch` (`batch_id`),
  KEY `fk_decision_staff` (`signed_by_staff_id`),
  CONSTRAINT `fk_decision_batch` FOREIGN KEY (`batch_id`) REFERENCES `admission_batch` (`batch_id`),
  CONSTRAINT `fk_decision_staff` FOREIGN KEY (`signed_by_staff_id`) REFERENCES `staff_account` (`staff_account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admission_major` (
  `major_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `major_code` varchar(20) NOT NULL,
  `major_name` varchar(255) NOT NULL,
  `degree_level` varchar(10) NOT NULL CHECK (`degree_level` in ('THAC_SI','TIEN_SI')),
  `faculty_name` varchar(255) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (`status` in ('ACTIVE','INACTIVE')),
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete',
  PRIMARY KEY (`major_id`),
  UNIQUE KEY `major_code` (`major_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admission_result` (
  `result_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `application_id` bigint(20) unsigned NOT NULL,
  `result` varchar(20) NOT NULL CHECK (`result` in ('TRUNG_TUYEN','DU_BI','KHONG_TRUNG_TUYEN')),
  `approved_by_staff_id` bigint(20) unsigned DEFAULT NULL,
  `approved_by_leader_id` bigint(20) unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `published_at` datetime DEFAULT NULL,
  PRIMARY KEY (`result_id`),
  UNIQUE KEY `application_id` (`application_id`),
  KEY `fk_result_staff` (`approved_by_staff_id`),
  KEY `fk_result_leader` (`approved_by_leader_id`),
  CONSTRAINT `fk_result_application` FOREIGN KEY (`application_id`) REFERENCES `application` (`application_id`),
  CONSTRAINT `fk_result_leader` FOREIGN KEY (`approved_by_leader_id`) REFERENCES `staff_account` (`staff_account_id`),
  CONSTRAINT `fk_result_staff` FOREIGN KEY (`approved_by_staff_id`) REFERENCES `staff_account` (`staff_account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `announcement` (
  `announcement_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `batch_id` bigint(20) unsigned DEFAULT NULL COMMENT 'NULL = thông báo chung toàn hệ thống',
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'DRAFT' CHECK (`status` in ('DRAFT','PUBLISHED','ARCHIVED')),
  `published_at` datetime DEFAULT NULL,
  `created_by_staff_id` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
  `category` varchar(20) NOT NULL DEFAULT 'TUYEN_SINH' CHECK (`category` in ('TUYEN_SINH','QUY_DINH','HUONG_DAN','KET_QUA')),
  `is_pinned` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Ghim lên đầu danh sách',
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`announcement_id`),
  KEY `fk_announcement_batch` (`batch_id`),
  KEY `fk_announcement_staff` (`created_by_staff_id`),
  KEY `idx_announcement_status_published` (`status`,`published_at`),
  CONSTRAINT `fk_announcement_batch` FOREIGN KEY (`batch_id`) REFERENCES `admission_batch` (`batch_id`),
  CONSTRAINT `fk_announcement_staff` FOREIGN KEY (`created_by_staff_id`) REFERENCES `staff_account` (`staff_account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `appeal_request` (
  `request_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `application_id` bigint(20) unsigned NOT NULL,
  `reason` text NOT NULL,
  `fee_amount` decimal(15,2) NOT NULL CHECK (`fee_amount` >= 0),
  `status` varchar(20) NOT NULL DEFAULT 'CHO_NOP_PHI' CHECK (`status` in ('CHO_NOP_PHI','DA_NOP_PHI','DONG')),
  `created_at` datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
  `paid_at` datetime DEFAULT NULL,
  `receipt_no` varchar(50) DEFAULT NULL,
  `confirmed_by_staff_id` bigint(20) unsigned DEFAULT NULL,
  PRIMARY KEY (`request_id`),
  UNIQUE KEY `uq_appeal_request_application` (`application_id`),
  KEY `fk_appeal_request_staff` (`confirmed_by_staff_id`),
  CONSTRAINT `fk_appeal_request_application` FOREIGN KEY (`application_id`) REFERENCES `application` (`application_id`),
  CONSTRAINT `fk_appeal_request_staff` FOREIGN KEY (`confirmed_by_staff_id`) REFERENCES `staff_account` (`staff_account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `application` (
  `application_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `application_code` varchar(30) NOT NULL,
  `candidate_id` bigint(20) unsigned NOT NULL,
  `batch_major_id` bigint(20) unsigned NOT NULL COMMENT 'Nguyện vọng ngành trong đợt',
  `review_status` varchar(20) NOT NULL DEFAULT 'DRAFT' CHECK (`review_status` in ('DRAFT','SUBMITTED','UNDER_REVIEW','NEEDS_SUPPLEMENT','APPROVED','REJECTED')),
  `admission_status` varchar(20) NOT NULL DEFAULT 'NONE' CHECK (`admission_status` in ('NONE','WAITLISTED','ADMITTED','CONFIRMED','ENROLLED')),
  `assigned_staff_id` bigint(20) unsigned DEFAULT NULL COMMENT 'Cán bộ phụ trách thẩm định (v4)',
  `is_cancelled` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Thí sinh chủ động rút hồ sơ',
  `active_slot` bigint(20) unsigned GENERATED ALWAYS AS (case when `is_cancelled` = 1 then NULL else `batch_major_id` end) VIRTUAL,
  `submitted_at` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete',
  `created_at` datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
  `language_option` varchar(20) DEFAULT NULL CHECK (`language_option` is null or `language_option` in ('CERTIFICATE','EXEMPT','TEST')),
  `language_note` varchar(500) DEFAULT NULL,
  `declaration_confirmed_at` datetime DEFAULT NULL COMMENT 'Lúc thí sinh cam kết thông tin khai và minh chứng là đúng sự thật (UTC)',
  PRIMARY KEY (`application_id`),
  UNIQUE KEY `application_code` (`application_code`),
  UNIQUE KEY `uq_candidate_active_slot` (`candidate_id`,`active_slot`),
  KEY `idx_application_review_status` (`review_status`),
  KEY `idx_application_admission_status` (`admission_status`),
  KEY `idx_application_batch_major` (`batch_major_id`),
  KEY `idx_application_assigned` (`assigned_staff_id`),
  KEY `idx_application_submitted_at` (`submitted_at`),
  CONSTRAINT `fk_app_assigned_staff` FOREIGN KEY (`assigned_staff_id`) REFERENCES `staff_account` (`staff_account_id`),
  CONSTRAINT `fk_app_bm` FOREIGN KEY (`batch_major_id`) REFERENCES `admission_batch_major` (`batch_major_id`),
  CONSTRAINT `fk_app_candidate` FOREIGN KEY (`candidate_id`) REFERENCES `candidate` (`candidate_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `application_document` (
  `document_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `application_id` bigint(20) unsigned NOT NULL,
  `document_type` varchar(30) NOT NULL CHECK (`document_type` in ('VAN_BANG','BANG_DIEM','CHUNG_CHI_NGOAI_NGU','DE_CUONG_NCS','THU_GIOI_THIEU','CONG_BO_KHOA_HOC','KHAC','DON_DANG_KY','SO_YEU_LY_LICH','LY_LICH_CHUYEN_MON','ANH_THE','CCCD','GIAY_GIOI_THIEU','GIAY_UU_TIEN','CONG_NHAN_VAN_BANG','CHUNG_CHI_AI')),
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL COMMENT 'Đường dẫn lưu trữ (server nội bộ / object storage)',
  `file_hash` char(64) NOT NULL COMMENT 'SHA-256 để bảo vệ tính toàn vẹn tệp',
  `file_size_kb` int(11) NOT NULL CHECK (`file_size_kb` > 0 and `file_size_kb` <= 5120),
  `verify_status` varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (`verify_status` in ('PENDING','VALID','INVALID')),
  `verify_note` varchar(500) DEFAULT NULL COMMENT 'Lý do khi INVALID (v4)',
  `verified_by_staff_id` bigint(20) unsigned DEFAULT NULL,
  `verified_at` datetime DEFAULT NULL,
  `uploaded_at` datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (`document_id`),
  KEY `fk_doc_application` (`application_id`),
  KEY `fk_doc_verified_staff` (`verified_by_staff_id`),
  CONSTRAINT `fk_doc_application` FOREIGN KEY (`application_id`) REFERENCES `application` (`application_id`),
  CONSTRAINT `fk_doc_verified_staff` FOREIGN KEY (`verified_by_staff_id`) REFERENCES `staff_account` (`staff_account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `application_education` (
  `education_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `application_id` bigint(20) unsigned NOT NULL,
  `degree_level` varchar(10) NOT NULL CHECK (`degree_level` in ('DAI_HOC','THAC_SI')),
  `institution_name` varchar(255) NOT NULL,
  `major_name` varchar(255) NOT NULL,
  `graduation_year` smallint(6) NOT NULL CHECK (`graduation_year` between 1950 and 2100),
  `gpa` decimal(4,2) DEFAULT NULL,
  `gpa_scale` decimal(4,2) NOT NULL DEFAULT 4.00 CHECK (`gpa_scale` in (4.00,10.00)),
  PRIMARY KEY (`education_id`),
  UNIQUE KEY `application_id` (`application_id`),
  CONSTRAINT `fk_edu_application` FOREIGN KEY (`application_id`) REFERENCES `application` (`application_id`),
  CONSTRAINT `application_education_ck_1` CHECK (`gpa` is null or `gpa` >= 0 and `gpa` <= `gpa_scale`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `application_payment` (
  `payment_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `application_id` bigint(20) unsigned NOT NULL,
  `amount` decimal(15,2) NOT NULL CHECK (`amount` >= 0.00),
  `payment_method` varchar(30) NOT NULL CHECK (`payment_method` in ('BANK_TRANSFER','MOMO','VNPAY','KHAC')),
  `transaction_code` varchar(100) DEFAULT NULL,
  `gateway_status` varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (`gateway_status` in ('PENDING','SUCCESS','FAILED','REFUNDED','CANCELLED','EXPIRED')),
  `receipt_no` varchar(50) DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `fee_detail` text DEFAULT NULL,
  PRIMARY KEY (`payment_id`),
  UNIQUE KEY `transaction_code` (`transaction_code`),
  KEY `fk_payment_application` (`application_id`),
  KEY `idx_payment_status` (`gateway_status`),
  CONSTRAINT `fk_payment_application` FOREIGN KEY (`application_id`) REFERENCES `application` (`application_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `application_ranking` (
  `ranking_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `application_id` bigint(20) unsigned NOT NULL,
  `total_score` decimal(6,2) NOT NULL DEFAULT 0.00,
  `rank_order` int(11) NOT NULL CHECK (`rank_order` > 0),
  PRIMARY KEY (`ranking_id`),
  UNIQUE KEY `application_id` (`application_id`),
  CONSTRAINT `fk_ranking_application` FOREIGN KEY (`application_id`) REFERENCES `application` (`application_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `application_review` (
  `review_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `application_id` bigint(20) unsigned NOT NULL,
  `reviewer_staff_id` bigint(20) unsigned DEFAULT NULL,
  `review_type` varchar(20) NOT NULL CHECK (`review_type` in ('AUTO_CHECK','MANUAL_REVIEW')),
  `review_result` varchar(20) NOT NULL CHECK (`review_result` in ('PASS','FAIL','NEEDS_SUPPLEMENT')),
  `note` text DEFAULT NULL,
  `reviewed_at` datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (`review_id`),
  KEY `fk_review_staff` (`reviewer_staff_id`),
  KEY `idx_review_application` (`application_id`),
  CONSTRAINT `fk_review_application` FOREIGN KEY (`application_id`) REFERENCES `application` (`application_id`),
  CONSTRAINT `fk_review_staff` FOREIGN KEY (`reviewer_staff_id`) REFERENCES `staff_account` (`staff_account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `application_status_history` (
  `history_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `application_id` bigint(20) unsigned NOT NULL,
  `old_status` varchar(150) DEFAULT NULL,
  `new_status` varchar(150) NOT NULL,
  `changed_by_type` varchar(20) NOT NULL CHECK (`changed_by_type` in ('STAFF','SYSTEM','CANDIDATE')),
  `changed_by_staff_id` bigint(20) unsigned DEFAULT NULL,
  `reason` varchar(500) DEFAULT NULL,
  `changed_at` datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (`history_id`),
  KEY `fk_ash_staff` (`changed_by_staff_id`),
  KEY `idx_status_history_application` (`application_id`),
  CONSTRAINT `fk_ash_application` FOREIGN KEY (`application_id`) REFERENCES `application` (`application_id`),
  CONSTRAINT `fk_ash_staff` FOREIGN KEY (`changed_by_staff_id`) REFERENCES `staff_account` (`staff_account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `audit_log` (
  `log_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `actor_type` varchar(20) NOT NULL CHECK (`actor_type` in ('CANDIDATE','STAFF','SYSTEM')),
  `actor_id` bigint(20) unsigned DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `entity_table` varchar(100) DEFAULT NULL,
  `entity_id` bigint(20) unsigned DEFAULT NULL,
  `detail` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (`log_id`),
  KEY `idx_audit_entity` (`entity_table`,`entity_id`),
  KEY `idx_audit_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `candidate` (
  `candidate_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `account_id` bigint(20) unsigned NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `dob` date NOT NULL,
  `gender` varchar(10) DEFAULT NULL CHECK (`gender` in ('NAM','NU','KHAC')),
  `id_number` varchar(20) DEFAULT NULL COMMENT 'CCCD/CMND',
  `address` text DEFAULT NULL,
  `nationality` varchar(50) NOT NULL DEFAULT 'Việt Nam',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete',
  `id_issue_date` date DEFAULT NULL COMMENT 'Ngày cấp CCCD',
  `id_issue_place` varchar(255) DEFAULT NULL COMMENT 'Nơi cấp CCCD (ghi ở mặt sau thẻ)',
  `birthplace` varchar(255) DEFAULT NULL COMMENT 'Nơi sinh (tỉnh, thành phố)',
  `ethnicity` varchar(50) DEFAULT NULL COMMENT 'Dân tộc',
  `permanent_address` text DEFAULT NULL COMMENT 'Nơi thường trú theo CCCD',
  PRIMARY KEY (`candidate_id`),
  UNIQUE KEY `account_id` (`account_id`),
  UNIQUE KEY `id_number` (`id_number`),
  CONSTRAINT `fk_candidate_account` FOREIGN KEY (`account_id`) REFERENCES `candidate_account` (`account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `candidate_account` (
  `account_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone_number` varchar(20) DEFAULT NULL,
  `password_hash` varchar(255) DEFAULT NULL COMMENT 'Du phong: NULL neu tai khoan chi dang nhap bang Google',
  `status` varchar(20) NOT NULL DEFAULT 'PENDING_VERIFY' CHECK (`status` in ('PENDING_VERIFY','ACTIVE','LOCKED')),
  `failed_login_count` int(11) NOT NULL DEFAULT 0,
  `locked_until` datetime DEFAULT NULL COMMENT 'Tự mở khóa sau thời điểm này',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete',
  `created_at` datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
  `privacy_consent_at` datetime DEFAULT NULL COMMENT 'Lúc thí sinh đồng ý chính sách bảo vệ dữ liệu cá nhân (UTC)',
  PRIMARY KEY (`account_id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `phone_number` (`phone_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `committee_member` (
  `member_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `committee_id` bigint(20) unsigned NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `lecturer_code` varchar(30) DEFAULT NULL,
  `role_in_committee` varchar(20) NOT NULL CHECK (`role_in_committee` in ('CHU_TICH','THU_KY','UY_VIEN')),
  PRIMARY KEY (`member_id`),
  KEY `fk_member_committee` (`committee_id`),
  CONSTRAINT `fk_member_committee` FOREIGN KEY (`committee_id`) REFERENCES `admission_committee` (`committee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `complaint` (
  `complaint_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `candidate_id` bigint(20) unsigned NOT NULL,
  `application_id` bigint(20) unsigned DEFAULT NULL,
  `complaint_type` varchar(30) NOT NULL CHECK (`complaint_type` in ('PHUC_KHAO_DIEM','KHIEU_NAI_KET_QUA','KHIEU_NAI_HO_SO','KHAC')),
  `content` text NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (`status` in ('PENDING','IN_PROGRESS','RESOLVED','REJECTED')),
  `response` text DEFAULT NULL,
  `handled_by_staff_id` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
  `resolved_at` datetime DEFAULT NULL,
  PRIMARY KEY (`complaint_id`),
  KEY `fk_complaint_application` (`application_id`),
  KEY `fk_complaint_staff` (`handled_by_staff_id`),
  KEY `idx_complaint_candidate` (`candidate_id`),
  KEY `idx_complaint_status` (`status`),
  CONSTRAINT `fk_complaint_application` FOREIGN KEY (`application_id`) REFERENCES `application` (`application_id`),
  CONSTRAINT `fk_complaint_candidate` FOREIGN KEY (`candidate_id`) REFERENCES `candidate` (`candidate_id`),
  CONSTRAINT `fk_complaint_staff` FOREIGN KEY (`handled_by_staff_id`) REFERENCES `staff_account` (`staff_account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `decision_application` (
  `detail_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `decision_id` bigint(20) unsigned NOT NULL,
  `application_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`detail_id`),
  UNIQUE KEY `uq_decision_application` (`decision_id`,`application_id`),
  KEY `fk_da_application` (`application_id`),
  CONSTRAINT `fk_da_application` FOREIGN KEY (`application_id`) REFERENCES `application` (`application_id`),
  CONSTRAINT `fk_da_decision` FOREIGN KEY (`decision_id`) REFERENCES `admission_decision` (`decision_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `english_test_registration` (
  `registration_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `application_id` bigint(20) unsigned NOT NULL,
  `session_id` bigint(20) unsigned NOT NULL,
  `candidate_number` varchar(30) NOT NULL COMMENT 'Số báo danh',
  `seat_no` int(11) NOT NULL,
  `result` varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (`result` in ('PENDING','PASSED','FAILED','ABSENT')),
  `score` decimal(5,2) DEFAULT NULL,
  `note` varchar(500) DEFAULT NULL,
  `graded_by_staff_id` bigint(20) unsigned DEFAULT NULL,
  `graded_at` datetime DEFAULT NULL,
  `assigned_at` datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (`registration_id`),
  UNIQUE KEY `application_id` (`application_id`),
  UNIQUE KEY `candidate_number` (`candidate_number`),
  KEY `fk_test_reg_session` (`session_id`),
  KEY `fk_test_reg_staff` (`graded_by_staff_id`),
  CONSTRAINT `fk_test_reg_application` FOREIGN KEY (`application_id`) REFERENCES `application` (`application_id`),
  CONSTRAINT `fk_test_reg_session` FOREIGN KEY (`session_id`) REFERENCES `english_test_session` (`session_id`),
  CONSTRAINT `fk_test_reg_staff` FOREIGN KEY (`graded_by_staff_id`) REFERENCES `staff_account` (`staff_account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `english_test_session` (
  `session_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `batch_id` bigint(20) unsigned NOT NULL,
  `session_code` varchar(30) NOT NULL COMMENT 'Mã phòng thi, ví dụ TA-01',
  `test_at` datetime NOT NULL COMMENT 'Giờ bắt đầu (UTC)',
  `room` varchar(100) NOT NULL,
  `location` varchar(255) DEFAULT NULL,
  `capacity` int(11) NOT NULL CHECK (`capacity` > 0 and `capacity` <= 500),
  `note` varchar(500) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'SCHEDULED' CHECK (`status` in ('SCHEDULED','COMPLETED','CANCELLED')),
  `created_at` datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (`session_id`),
  UNIQUE KEY `uq_test_session_code` (`batch_id`,`session_code`),
  CONSTRAINT `fk_test_session_batch` FOREIGN KEY (`batch_id`) REFERENCES `admission_batch` (`batch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `enrollment_completion` (
  `completion_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `application_id` bigint(20) unsigned NOT NULL,
  `completed_by_staff_id` bigint(20) unsigned DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `transferred_to_training` tinyint(1) NOT NULL DEFAULT 0,
  `transfer_ref` varchar(100) DEFAULT NULL COMMENT 'Mã hồ sơ bên Phân hệ Đào tạo sau khi chuyển giao',
  PRIMARY KEY (`completion_id`),
  UNIQUE KEY `application_id` (`application_id`),
  KEY `fk_completion_staff` (`completed_by_staff_id`),
  CONSTRAINT `fk_completion_application` FOREIGN KEY (`application_id`) REFERENCES `application` (`application_id`),
  CONSTRAINT `fk_completion_staff` FOREIGN KEY (`completed_by_staff_id`) REFERENCES `staff_account` (`staff_account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `enrollment_confirmation` (
  `confirmation_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `application_id` bigint(20) unsigned NOT NULL,
  `deadline` datetime NOT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'CHUA_XAC_NHAN' CHECK (`status` in ('CHUA_XAC_NHAN','DA_XAC_NHAN','TU_CHOI_QUA_HAN')),
  PRIMARY KEY (`confirmation_id`),
  UNIQUE KEY `application_id` (`application_id`),
  CONSTRAINT `fk_confirmation_application` FOREIGN KEY (`application_id`) REFERENCES `application` (`application_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `exam_assignment` (
  `assignment_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `application_id` bigint(20) unsigned NOT NULL,
  `room_id` bigint(20) unsigned NOT NULL,
  `sbd_code` varchar(30) NOT NULL COMMENT 'Số báo danh',
  `seat_no` varchar(10) DEFAULT NULL,
  PRIMARY KEY (`assignment_id`),
  UNIQUE KEY `application_id` (`application_id`),
  UNIQUE KEY `sbd_code` (`sbd_code`),
  KEY `fk_assignment_room` (`room_id`),
  CONSTRAINT `fk_assignment_application` FOREIGN KEY (`application_id`) REFERENCES `application` (`application_id`),
  CONSTRAINT `fk_assignment_room` FOREIGN KEY (`room_id`) REFERENCES `exam_room` (`room_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `exam_room` (
  `room_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `batch_id` bigint(20) unsigned NOT NULL,
  `room_code` varchar(20) NOT NULL,
  `location` varchar(255) DEFAULT NULL,
  `capacity` int(11) NOT NULL CHECK (`capacity` > 0),
  PRIMARY KEY (`room_id`),
  UNIQUE KEY `uq_batch_room` (`batch_id`,`room_code`),
  CONSTRAINT `fk_room_batch` FOREIGN KEY (`batch_id`) REFERENCES `admission_batch` (`batch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `exam_score` (
  `score_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `application_id` bigint(20) unsigned NOT NULL,
  `subject_id` bigint(20) unsigned NOT NULL,
  `score` decimal(4,2) NOT NULL CHECK (`score` between 0.00 and 10.00),
  `grader_staff_id` bigint(20) unsigned DEFAULT NULL,
  `note` text DEFAULT NULL,
  `graded_at` datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (`score_id`),
  UNIQUE KEY `uq_application_subject` (`application_id`,`subject_id`),
  KEY `fk_score_subject` (`subject_id`),
  KEY `fk_score_staff` (`grader_staff_id`),
  CONSTRAINT `fk_score_application` FOREIGN KEY (`application_id`) REFERENCES `application` (`application_id`),
  CONSTRAINT `fk_score_staff` FOREIGN KEY (`grader_staff_id`) REFERENCES `staff_account` (`staff_account_id`),
  CONSTRAINT `fk_score_subject` FOREIGN KEY (`subject_id`) REFERENCES `exam_subject` (`subject_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `exam_subject` (
  `subject_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `batch_major_id` bigint(20) unsigned NOT NULL,
  `subject_name` varchar(255) NOT NULL,
  `exam_format` varchar(20) NOT NULL CHECK (`exam_format` in ('THI_VIET','PHONG_VAN','XET_HO_SO')),
  `weight` decimal(4,2) NOT NULL DEFAULT 1.00 CHECK (`weight` > 0),
  `max_score` decimal(4,2) NOT NULL DEFAULT 10.00 CHECK (`max_score` > 0),
  PRIMARY KEY (`subject_id`),
  KEY `fk_subject_bm` (`batch_major_id`),
  CONSTRAINT `fk_subject_bm` FOREIGN KEY (`batch_major_id`) REFERENCES `admission_batch_major` (`batch_major_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `interview_schedule` (
  `schedule_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `application_id` bigint(20) unsigned NOT NULL,
  `committee_id` bigint(20) unsigned NOT NULL,
  `scheduled_at` datetime NOT NULL,
  `location_or_link` varchar(500) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'SCHEDULED' CHECK (`status` in ('SCHEDULED','COMPLETED','CANCELLED')),
  PRIMARY KEY (`schedule_id`),
  KEY `fk_schedule_application` (`application_id`),
  KEY `fk_schedule_committee` (`committee_id`),
  CONSTRAINT `fk_schedule_application` FOREIGN KEY (`application_id`) REFERENCES `application` (`application_id`),
  CONSTRAINT `fk_schedule_committee` FOREIGN KEY (`committee_id`) REFERENCES `admission_committee` (`committee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `lecturer` (
  `lecturer_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `lecturer_code` varchar(30) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `faculty_name` varchar(255) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (`status` in ('ACTIVE','INACTIVE')),
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete',
  PRIMARY KEY (`lecturer_id`),
  UNIQUE KEY `lecturer_code` (`lecturer_code`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notification` (
  `notification_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `recipient_type` varchar(20) NOT NULL CHECK (`recipient_type` in ('CANDIDATE','STAFF')),
  `recipient_id` bigint(20) unsigned NOT NULL,
  `channel` varchar(20) NOT NULL CHECK (`channel` in ('EMAIL','SMS','SYSTEM')),
  `title` varchar(255) DEFAULT NULL,
  `content` text NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (`status` in ('PENDING','SENT','FAILED')),
  `sent_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
  `read_at` datetime DEFAULT NULL,
  PRIMARY KEY (`notification_id`),
  KEY `idx_notification_recipient` (`recipient_type`,`recipient_id`),
  KEY `idx_notification_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `original_document_submission` (
  `submission_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `application_id` bigint(20) unsigned NOT NULL,
  `submitted_at` datetime DEFAULT NULL,
  `verified_by_staff_id` bigint(20) unsigned DEFAULT NULL,
  `verified_at` datetime DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (`status` in ('PENDING','VERIFIED','MISSING')),
  PRIMARY KEY (`submission_id`),
  UNIQUE KEY `application_id` (`application_id`),
  KEY `fk_submission_staff` (`verified_by_staff_id`),
  CONSTRAINT `fk_submission_application` FOREIGN KEY (`application_id`) REFERENCES `application` (`application_id`),
  CONSTRAINT `fk_submission_staff` FOREIGN KEY (`verified_by_staff_id`) REFERENCES `staff_account` (`staff_account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `otp_verification` (
  `otp_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `account_id` bigint(20) unsigned NOT NULL,
  `purpose` varchar(30) NOT NULL CHECK (`purpose` in ('REGISTER','RESET_PASSWORD','SENSITIVE_ACTION')),
  `otp_code_hash` varchar(255) NOT NULL,
  `sent_count` int(11) NOT NULL DEFAULT 1,
  `expires_at` datetime NOT NULL,
  `verified_at` datetime DEFAULT NULL,
  PRIMARY KEY (`otp_id`),
  KEY `fk_otp_account` (`account_id`),
  KEY `idx_otp_expires` (`expires_at`),
  CONSTRAINT `fk_otp_account` FOREIGN KEY (`account_id`) REFERENCES `candidate_account` (`account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `research_proposal` (
  `proposal_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `application_id` bigint(20) unsigned NOT NULL,
  `document_id` bigint(20) unsigned NOT NULL,
  `research_topic` varchar(500) NOT NULL,
  `research_field` varchar(255) DEFAULT NULL,
  `preferred_lecturer_id` bigint(20) unsigned DEFAULT NULL COMMENT 'GVHD mong muốn, tham chiếu danh mục lecturer',
  PRIMARY KEY (`proposal_id`),
  UNIQUE KEY `application_id` (`application_id`),
  KEY `fk_proposal_document` (`document_id`),
  KEY `fk_proposal_lecturer` (`preferred_lecturer_id`),
  CONSTRAINT `fk_proposal_application` FOREIGN KEY (`application_id`) REFERENCES `application` (`application_id`),
  CONSTRAINT `fk_proposal_document` FOREIGN KEY (`document_id`) REFERENCES `application_document` (`document_id`),
  CONSTRAINT `fk_proposal_lecturer` FOREIGN KEY (`preferred_lecturer_id`) REFERENCES `lecturer` (`lecturer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `role` (
  `role_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `role_code` varchar(30) NOT NULL COMMENT 'VD: CAN_BO_TUYEN_SINH, HOI_DONG, LANH_DAO_KHOA, ADMIN',
  `role_name` varchar(100) NOT NULL,
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `role_code` (`role_code`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `role` VALUES (1,'CAN_BO_TUYEN_SINH','Cán bộ tuyển sinh');
INSERT IGNORE INTO `role` VALUES (2,'HOI_DONG','Hội đồng tuyển sinh');
INSERT IGNORE INTO `role` VALUES (3,'LANH_DAO_KHOA','Lãnh đạo khoa/viện');
INSERT IGNORE INTO `role` VALUES (4,'ADMIN','Quản trị hệ thống');
CREATE TABLE IF NOT EXISTS `score_appeal` (
  `appeal_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `score_id` bigint(20) unsigned NOT NULL,
  `reason` text NOT NULL,
  `old_score` decimal(4,2) NOT NULL CHECK (`old_score` between 0.00 and 10.00),
  `new_score` decimal(4,2) DEFAULT NULL CHECK (`new_score` is null or `new_score` between 0.00 and 10.00),
  `status` varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (`status` in ('PENDING','RESOLVED_CHANGED','RESOLVED_UNCHANGED')),
  `created_at` datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
  `resolved_at` datetime DEFAULT NULL,
  `resolved_by_staff_id` bigint(20) unsigned DEFAULT NULL,
  `resolution_note` text DEFAULT NULL,
  PRIMARY KEY (`appeal_id`),
  KEY `fk_appeal_score` (`score_id`),
  KEY `fk_appeal_staff` (`resolved_by_staff_id`),
  KEY `idx_appeal_status` (`status`),
  CONSTRAINT `fk_appeal_score` FOREIGN KEY (`score_id`) REFERENCES `exam_score` (`score_id`),
  CONSTRAINT `fk_appeal_staff` FOREIGN KEY (`resolved_by_staff_id`) REFERENCES `staff_account` (`staff_account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `staff_account` (
  `staff_account_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `staff_code` varchar(30) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) DEFAULT NULL COMMENT 'Du phong: NULL neu tai khoan chi dang nhap bang Google',
  `status` varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (`status` in ('ACTIVE','LOCKED','DISABLED')),
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete',
  `must_change_password` tinyint(1) NOT NULL DEFAULT 0,
  `password_changed_at` datetime DEFAULT NULL,
  `failed_login_count` int(11) NOT NULL DEFAULT 0,
  `locked_until` datetime DEFAULT NULL,
  PRIMARY KEY (`staff_account_id`),
  UNIQUE KEY `staff_code` (`staff_code`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `staff_role` (
  `staff_role_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `staff_account_id` bigint(20) unsigned NOT NULL,
  `role_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`staff_role_id`),
  UNIQUE KEY `uq_staff_role` (`staff_account_id`,`role_id`),
  KEY `fk_sr_role` (`role_id`),
  CONSTRAINT `fk_sr_role` FOREIGN KEY (`role_id`) REFERENCES `role` (`role_id`),
  CONSTRAINT `fk_sr_staff` FOREIGN KEY (`staff_account_id`) REFERENCES `staff_account` (`staff_account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stored_file` (
  `file_path` varchar(255) NOT NULL COMMENT 'Trùng application_document.file_path',
  `content` longblob NOT NULL COMMENT 'Nội dung tệp (PDF/JPG/PNG, tối đa 5MB)',
  `size_bytes` int(10) unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`file_path`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Nội dung tệp minh chứng khi UPLOAD_STORAGE=db';

CREATE TABLE IF NOT EXISTS `supervisor_request` (
  `request_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `proposal_id` bigint(20) unsigned NOT NULL,
  `lecturer_id` bigint(20) unsigned NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (`status` in ('PENDING','ACCEPTED','REJECTED')),
  `requested_at` datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
  `responded_at` datetime DEFAULT NULL,
  `response_note` text DEFAULT NULL,
  PRIMARY KEY (`request_id`),
  KEY `fk_sup_req_proposal` (`proposal_id`),
  KEY `fk_sup_req_lecturer` (`lecturer_id`),
  CONSTRAINT `fk_sup_req_lecturer` FOREIGN KEY (`lecturer_id`) REFERENCES `lecturer` (`lecturer_id`),
  CONSTRAINT `fk_sup_req_proposal` FOREIGN KEY (`proposal_id`) REFERENCES `research_proposal` (`proposal_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `supplement_request` (
  `request_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `application_id` bigint(20) unsigned NOT NULL,
  `requested_by_staff_id` bigint(20) unsigned DEFAULT NULL,
  `content` text NOT NULL,
  `deadline` datetime NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (`status` in ('PENDING','RESOLVED','EXPIRED')),
  `created_at` datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
  `responded_at` datetime DEFAULT NULL,
  PRIMARY KEY (`request_id`),
  KEY `fk_supplement_application` (`application_id`),
  KEY `fk_supplement_staff` (`requested_by_staff_id`),
  CONSTRAINT `fk_supplement_application` FOREIGN KEY (`application_id`) REFERENCES `application` (`application_id`),
  CONSTRAINT `fk_supplement_staff` FOREIGN KEY (`requested_by_staff_id`) REFERENCES `staff_account` (`staff_account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `system_config` (
  `config_key` varchar(100) NOT NULL,
  `config_value` varchar(500) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `system_config` VALUES ('APPEAL_WINDOW_DAYS','7','Số ngày thí sinh được nộp đơn phúc khảo kể từ khi công bố điểm','2026-10-13 02:49:50');
INSERT IGNORE INTO `system_config` VALUES ('APPLICATION_FEE_THAC_SI','360000','Lệ phí xét tuyển thạc sĩ (đồng/hồ sơ)','2026-10-13 02:49:50');
INSERT IGNORE INTO `system_config` VALUES ('APPLICATION_FEE_TIEN_SI','1000000','Lệ phí xét tuyển tiến sĩ (đồng/hồ sơ)','2026-10-13 02:49:50');
INSERT IGNORE INTO `system_config` VALUES ('ENROLL_CONFIRM_DAYS','15','Số ngày thí sinh trúng tuyển phải xác nhận nhập học kể từ khi ký quyết định','2026-10-13 02:49:50');
INSERT IGNORE INTO `system_config` VALUES ('FEE_APPEAL','360000','Lệ phí phúc khảo hồ sơ (đồng/hồ sơ)','2026-10-13 02:49:50');
INSERT IGNORE INTO `system_config` VALUES ('FEE_ENGLISH_TEST','120000','Lệ phí đăng ký thi đánh giá năng lực tiếng Anh (đồng/thí sinh)','2026-10-13 02:49:50');
INSERT IGNORE INTO `system_config` VALUES ('FEE_REGISTRATION','100000','Lệ phí đăng ký dự tuyển (đồng/hồ sơ)','2026-10-13 02:49:50');
INSERT IGNORE INTO `system_config` VALUES ('FEE_SUPPLEMENT_CREDIT','490000','Học phí học bổ sung kiến thức (đồng/tín chỉ) — ngành gần','2026-10-13 02:49:50');
INSERT IGNORE INTO `system_config` VALUES ('INTERVIEW_MINUTES','20','Thời lượng mặc định mỗi lượt phỏng vấn / trình bày đề cương (phút)','2026-10-13 02:49:50');
INSERT IGNORE INTO `system_config` VALUES ('LOGIN_LOCK_MINUTES','15','Thời gian khóa tạm sau khi đăng nhập sai quá số lần','2026-10-13 02:49:50');
INSERT IGNORE INTO `system_config` VALUES ('LOGIN_MAX_FAILED','5','Số lần đăng nhập sai trước khi khóa tạm','2026-10-13 02:49:50');
INSERT IGNORE INTO `system_config` VALUES ('MAX_APPLICATION_FILES_KB','30720','Tổng dung lượng minh chứng tối đa 1 hồ sơ (KB)','2026-10-13 02:49:50');
INSERT IGNORE INTO `system_config` VALUES ('MAX_FILE_KB','5120','Dung lượng tối đa 1 tệp minh chứng (KB)','2026-10-13 02:49:50');
INSERT IGNORE INTO `system_config` VALUES ('OTP_EXPIRE_MINUTES','5','Thời hạn hiệu lực của mã OTP (phút)','2026-10-13 02:49:50');
INSERT IGNORE INTO `system_config` VALUES ('OTP_MAX_RESEND','5','Số lần gửi lại OTP tối đa cho một mục đích','2026-10-13 02:49:50');
INSERT IGNORE INTO `system_config` VALUES ('PAYMENT_ACCOUNT_NAME','','Tên chủ tài khoản nhận lệ phí','2026-10-13 02:49:50');
INSERT IGNORE INTO `system_config` VALUES ('PAYMENT_ACCOUNT_NO','','Số tài khoản nhận lệ phí','2026-10-13 02:49:50');
INSERT IGNORE INTO `system_config` VALUES ('PAYMENT_BANK_BIN','','Mã BIN ngân hàng nhận lệ phí (NAPAS), dùng tạo mã VietQR','2026-10-13 02:49:50');
INSERT IGNORE INTO `system_config` VALUES ('PAYMENT_BANK_NAME','','Ngân hàng nhận lệ phí','2026-10-13 02:49:50');
INSERT IGNORE INTO `system_config` VALUES ('SUPPLEMENT_DEFAULT_DAYS','7','Số ngày mặc định cho hạn bổ sung hồ sơ','2026-10-13 02:49:50');
CREATE TABLE IF NOT EXISTS `waitlist` (
  `waitlist_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `application_id` bigint(20) unsigned NOT NULL,
  `rank_order` int(11) NOT NULL CHECK (`rank_order` > 0),
  `status` varchar(20) NOT NULL DEFAULT 'WAITING' CHECK (`status` in ('WAITING','PROMOTED','EXPIRED')),
  PRIMARY KEY (`waitlist_id`),
  UNIQUE KEY `application_id` (`application_id`),
  CONSTRAINT `fk_waitlist_application` FOREIGN KEY (`application_id`) REFERENCES `application` (`application_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
