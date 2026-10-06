# ERD cập nhật Giai đoạn 4: các thay đổi so với ERD GĐ3

Người viết: Lâm Hoài An (nhóm Data)
Phạm vi: các file `backend/database/migration_v4_backend.sql` đến `migration_v11_privacy.sql`, áp dụng lên `admission_db_v3.sql`.

Tài liệu này bổ sung cho `docs/Giai Đoạn 2/ERD_PhanHe_TuyenSinh_GD3.md`. ERD GĐ3 mô tả **40 bảng**. Sau khi nạp đủ v3 đến v11, CSDL `admission_db` có **45 bảng**, thêm 5 bảng mới và một số cột, index, dữ liệu cấu hình.

## 1. Tổng quan

| Hạng mục | ERD GĐ3 | Sau v11 |
|---|---|---|
| Số bảng | 40 | 45 (thêm 5) |
| Trigger | 11 | 11 (các migration v4 đến v11 không thêm trigger) |
| Thủ tục lưu sẵn | 1 | 1 |
| Bảng phân quyền riêng (permission) | Không có | Không có (phân quyền theo vai trò trong code, `src/common/permissions.ts`) |

## 2. Năm bảng mới

### 2.1. `application_education` (v4): trình độ đào tạo của hồ sơ
| Cột | Kiểu | Ghi chú |
|---|---|---|
| `education_id` | BIGINT UNSIGNED, AUTO_INCREMENT | Khóa chính |
| `application_id` | BIGINT UNSIGNED, NOT NULL, UNIQUE | FK đến `application` (mỗi hồ sơ một dòng) |
| `degree_level` | VARCHAR(10), NOT NULL | Giá trị: `DAI_HOC`, `THAC_SI` |
| `institution_name` | VARCHAR(255), NOT NULL | Tên trường đã tốt nghiệp |
| `major_name` | VARCHAR(255), NOT NULL | Ngành đã học |
| `graduation_year` | SMALLINT, NOT NULL | Từ 1950 đến 2100 |
| `gpa` | DECIMAL(4,2), NULL | Điểm trung bình |
| `gpa_scale` | DECIMAL(4,2), NOT NULL, mặc định 4.00 | Thang điểm: 4.00 hoặc 10.00 |

### 2.2. `complaint` (v4): khiếu nại của thí sinh
| Cột | Kiểu | Ghi chú |
|---|---|---|
| `complaint_id` | BIGINT UNSIGNED, AUTO_INCREMENT | Khóa chính |
| `candidate_id` | BIGINT UNSIGNED, NOT NULL | FK đến `candidate` |
| `application_id` | BIGINT UNSIGNED, NULL | FK đến `application` |
| `complaint_type` | VARCHAR(30) | `PHUC_KHAO_DIEM`, `KHIEU_NAI_KET_QUA`, `KHIEU_NAI_HO_SO`, `KHAC` |
| `content` | TEXT, NOT NULL | Nội dung khiếu nại |
| `status` | VARCHAR(20), mặc định `PENDING` | `PENDING`, `IN_PROGRESS`, `RESOLVED`, `REJECTED` |
| `response` | TEXT, NULL | Nội dung trả lời |
| `handled_by_staff_id` | BIGINT UNSIGNED, NULL | FK đến `staff_account` |
| `created_at` | DATETIME, mặc định UTC_TIMESTAMP() | |
| `resolved_at` | DATETIME, NULL | |

### 2.3. `english_test_session` (v9): ca thi đánh giá năng lực tiếng Anh
| Cột | Kiểu | Ghi chú |
|---|---|---|
| `session_id` | BIGINT UNSIGNED, AUTO_INCREMENT | Khóa chính |
| `batch_id` | BIGINT UNSIGNED, NOT NULL | FK đến `admission_batch` |
| `session_code` | VARCHAR(30), NOT NULL | UNIQUE cùng `batch_id` (`uq_test_session_code`) |
| `test_at` | DATETIME, NOT NULL | Giờ thi |
| `room` | VARCHAR(100), NOT NULL | Phòng thi |
| `location` | VARCHAR(255), NULL | Địa điểm |
| `capacity` | INT, NOT NULL | CHECK: lớn hơn 0 và không quá 500 |
| `note` | VARCHAR(500), NULL | |
| `status` | VARCHAR(20), NOT NULL, mặc định `SCHEDULED` | `SCHEDULED`, `COMPLETED`, `CANCELLED` |
| `created_at` | DATETIME, NOT NULL, mặc định UTC_TIMESTAMP() | |

### 2.4. `english_test_registration` (v9): đăng ký dự thi tiếng Anh
| Cột | Kiểu | Ghi chú |
|---|---|---|
| `registration_id` | BIGINT UNSIGNED, AUTO_INCREMENT | Khóa chính |
| `application_id` | BIGINT UNSIGNED, NOT NULL, UNIQUE | FK đến `application` |
| `session_id` | BIGINT UNSIGNED, NOT NULL | FK đến `english_test_session` |
| `candidate_number` | VARCHAR(30), NOT NULL, UNIQUE | Số báo danh |
| `seat_no` | INT, NOT NULL | Số ghế |
| `result` | VARCHAR(20), NOT NULL, mặc định `PENDING` | `PENDING`, `PASSED`, `FAILED`, `ABSENT` |
| `score` | DECIMAL(5,2), NULL | Điểm (tùy chọn) |
| `note` | VARCHAR(500), NULL | |
| `graded_by_staff_id` | BIGINT UNSIGNED, NULL | FK đến `staff_account` |
| `graded_at` | DATETIME, NULL | |
| `assigned_at` | DATETIME, NOT NULL, mặc định UTC_TIMESTAMP() | |

### 2.5. `appeal_request` (v10): đơn phúc khảo và lệ phí
| Cột | Kiểu | Ghi chú |
|---|---|---|
| `request_id` | BIGINT UNSIGNED, AUTO_INCREMENT | Khóa chính |
| `application_id` | BIGINT UNSIGNED, NOT NULL, UNIQUE | FK đến `application` (một đơn mỗi hồ sơ) |
| `reason` | TEXT, NOT NULL | Lý do và phần điểm cần phúc khảo |
| `fee_amount` | DECIMAL(15,2), NOT NULL | CHECK: không âm |
| `status` | VARCHAR(20), NOT NULL, mặc định `CHO_NOP_PHI` | `CHO_NOP_PHI`, `DA_NOP_PHI`, `DONG` |
| `created_at` | DATETIME, NOT NULL, mặc định UTC_TIMESTAMP() | |
| `paid_at` | DATETIME, NULL | Lúc xác nhận đã thu phí |
| `receipt_no` | VARCHAR(50), NULL | Số biên lai |
| `confirmed_by_staff_id` | BIGINT UNSIGNED, NULL | FK đến `staff_account` |

Engine: InnoDB.

## 3. Cột thêm vào bảng đã có

| Bảng | Cột thêm | Kiểu | Migration |
|---|---|---|---|
| `application` | `assigned_staff_id` (FK `staff_account`) | BIGINT UNSIGNED, NULL | v4 |
| `application` | `language_option` | VARCHAR(20), NULL, CHECK: `CERTIFICATE`, `EXEMPT`, `TEST` | v8 |
| `application` | `language_note` | VARCHAR(500), NULL | v8 |
| `application_document` | `verify_note` | VARCHAR(500), NULL | v4 |
| `application_document` | `verified_by_staff_id` (FK `staff_account`) | BIGINT UNSIGNED, NULL | v4 |
| `application_document` | `verified_at` | DATETIME, NULL | v4 |
| `application_document` | `document_type` (đổi CHECK, mở rộng giá trị) | VARCHAR(30), NOT NULL | v8 |
| `application_payment` | `fee_detail` | TEXT, NULL | v8 |
| `admission_batch_major` | `approved_by_staff_id` (FK `staff_account`) | BIGINT UNSIGNED, NULL | v4 |
| `admission_batch_major` | `approved_at` | DATETIME, NULL | v4 |
| `admission_batch_major` | `scores_published_at` | DATETIME, NULL | v10 |
| `admission_batch_major` | `appeal_deadline` | DATETIME, NULL | v10 |
| `admission_batch_major` | `result_return_note` | VARCHAR(500), NULL | v10 |
| `admission_decision` | `return_note` | VARCHAR(500), NULL | v10 |
| `score_appeal` | `created_at` | DATETIME, mặc định UTC_TIMESTAMP() | v4 |
| `score_appeal` | `resolved_by_staff_id` (FK `staff_account`) | BIGINT UNSIGNED, NULL | v4 |
| `score_appeal` | `resolution_note` | TEXT, NULL | v4 |
| `supplement_request` | `created_at` | DATETIME, mặc định UTC_TIMESTAMP() | v4 |
| `notification` | `title` | VARCHAR(255), NULL | v4 |
| `notification` | `created_at` | DATETIME, mặc định UTC_TIMESTAMP() | v4 |
| `notification` | `read_at` | DATETIME, NULL | v4 |
| `announcement` | `category` | VARCHAR(20), NOT NULL, mặc định `TUYEN_SINH`, CHECK: `TUYEN_SINH`, `QUY_DINH`, `HUONG_DAN`, `KET_QUA` | v5 |
| `announcement` | `is_pinned` | TINYINT(1), NOT NULL, mặc định 0 | v5 |
| `announcement` | `updated_at` | DATETIME, NULL | v5 |
| `staff_account` | `must_change_password` | TINYINT(1), NOT NULL, mặc định 0 | v6 |
| `staff_account` | `password_changed_at` | DATETIME, NULL | v6 |
| `staff_account` | `failed_login_count` | INT, NOT NULL, mặc định 0 | v6 |
| `staff_account` | `locked_until` | DATETIME, NULL | v6 |
| `candidate_account` | `privacy_consent_at` | DATETIME, NULL | v11 |

Giá trị `document_type` sau v8: `VAN_BANG`, `BANG_DIEM`, `CHUNG_CHI_NGOAI_NGU`, `DE_CUONG_NCS`, `THU_GIOI_THIEU`, `CONG_BO_KHOA_HOC`, `KHAC`, `DON_DANG_KY`, `SO_YEU_LY_LICH`, `LY_LICH_CHUYEN_MON`, `ANH_THE`, `CCCD`, `GIAY_GIOI_THIEU`, `GIAY_UU_TIEN`, `CONG_NHAN_VAN_BANG`, `CHUNG_CHI_AI`.

## 4. Index thêm mới

- v4: sáu index (người phụ trách hồ sơ, `submitted_at`, khiếu nại theo thí sinh, khiếu nại theo trạng thái, trạng thái phúc khảo, `notification.created_at`).
- v5: `idx_announcement_status_published` trên `announcement(status, published_at)`.

## 5. Quan hệ (khóa ngoại) mới

```
application_education.application_id          -> application
complaint.candidate_id                        -> candidate
complaint.application_id                      -> application
complaint.handled_by_staff_id                 -> staff_account
english_test_session.batch_id                 -> admission_batch
english_test_registration.application_id      -> application
english_test_registration.session_id         -> english_test_session
english_test_registration.graded_by_staff_id  -> staff_account
appeal_request.application_id                 -> application
appeal_request.confirmed_by_staff_id          -> staff_account
application.assigned_staff_id                 -> staff_account
application_document.verified_by_staff_id     -> staff_account
admission_batch_major.approved_by_staff_id    -> staff_account
score_appeal.resolved_by_staff_id             -> staff_account
```

## 6. Dữ liệu cấu hình thêm vào

**Bảng `role` (v4):** `CAN_BO_TUYEN_SINH`, `HOI_DONG`, `LANH_DAO_KHOA`, `ADMIN`.

**Bảng `system_config`:**

| Migration | Khóa cấu hình |
|---|---|
| v4 | 7 tham số: OTP, kích thước tệp, bảo mật đăng nhập, số ngày bổ sung hồ sơ |
| v7 | `APPLICATION_FEE_THAC_SI`, `APPLICATION_FEE_TIEN_SI`, `PAYMENT_BANK_BIN`, `PAYMENT_BANK_NAME`, `PAYMENT_ACCOUNT_NO`, `PAYMENT_ACCOUNT_NAME` |
| v8 | `FEE_REGISTRATION`, `FEE_ENGLISH_TEST`, `FEE_SUPPLEMENT_CREDIT`, `FEE_APPEAL` (đồng thời cập nhật mức `APPLICATION_FEE_THAC_SI` nếu còn giá trị cũ) |
| v10 | `APPEAL_WINDOW_DAYS` (7), `ENROLL_CONFIRM_DAYS` (15), `INTERVIEW_MINUTES` (20) |

## 7. Lịch sử migration

| File | Nội dung chính |
|---|---|
| `admission_db_v3.sql` | Cấu trúc gốc 40 bảng, trigger, thủ tục |
| `migration_v4_backend.sql` | Bảng `application_education`, `complaint`; cột phục vụ thẩm định, thông báo; vai trò; cấu hình |
| `migration_v5_announcement.sql` | Phân loại và ghim thông báo |
| `migration_v6_staff_security.sql` | Bảo mật tài khoản cán bộ (khóa tạm, bắt đổi mật khẩu) |
| `migration_v7_payment_config.sql` | Cấu hình lệ phí và tài khoản nhận tiền |
| `migration_v8_real_notice.sql` | Hồ sơ theo thông báo tuyển sinh thật, ngoại ngữ, chi tiết lệ phí |
| `migration_v9_english_test.sql` | Thi đánh giá năng lực tiếng Anh |
| `migration_v10_admission_results.sql` | Công bố điểm, phúc khảo có lệ phí, trả lại kết quả và quyết định |
| `migration_v11_privacy.sql` | Ghi nhận đồng ý chính sách dữ liệu cá nhân |

Thứ tự nạp bắt buộc: v3, v4, ..., v11. Với DB đã có dữ liệu, README backend ghi `npm run db:update` chạy lại migration v5 đến v11 an toàn (v6, v7, v11 tự dùng `IF NOT EXISTS` hoặc `ON DUPLICATE KEY UPDATE`). Còn v3 và v4 chỉ nạp một lần trên DB trống. Xem hướng dẫn nạp trong `docs/HUONG_DAN_DATABASE.md`.

## 8. Điểm cần lưu ý

- Có hai bản `backend/` và `frontend/backend/` cùng chứa `schema.prisma` và bộ SQL. Hai bản có cùng danh sách 45 model, nhưng chưa đối chiếu từng cột. Cần nhóm xác nhận bản nào là chuẩn.
- Trong repo còn bản SQL cũ ở `docs/Giai Đoạn 2/` (`admission_db_v3.sql`, `migration_v3_GD3.sql`) thuộc GĐ2/GĐ3, không dùng để dựng DB hiện tại.
- Tài liệu này lập từ nội dung các file migration. Khi cần dùng làm tài liệu chính thức, đối chiếu lại với file SQL hoặc `npx prisma studio` cho các cột quan trọng.
