# Phân hệ Quản lý (Admin Portal) — Frontend Web

Cổng dành cho cán bộ: tiếp nhận và thẩm định hồ sơ, cấu hình đợt tuyển sinh, xử lý phúc khảo, quản lý tài khoản. Chạy chung project Next.js với phân hệ Thí sinh, nằm dưới đường dẫn `/admin`.

Mã của phân hệ Quản lý nằm riêng ở các thư mục dưới đây. Phân hệ Thí sinh dùng chung `src/lib/announcements.ts` (thông báo) với cổng Quản lý:

```
src/app/admin/            các trang /admin/...
src/components/admin/     khung trang, nút, nhãn trạng thái, hộp thoại
src/lib/admin/            kiểu dữ liệu, phân quyền, state machine, lớp API, dữ liệu mẫu
```

## Chạy thử

```bash
npm install
npm run dev
```

Mở `http://localhost:3000/admin/login` và bấm một trong 4 tài khoản demo:

| Vai trò | Email demo | Thấy được gì |
|---|---|---|
| Cán bộ tuyển sinh | canbo@agu.edu.vn | Thẩm định hồ sơ, cấu hình đợt, đăng thông báo, phúc khảo, nhật ký |
| Hội đồng tuyển sinh | hoidong@agu.edu.vn | Xem hồ sơ (chỉ đọc), xử lý phúc khảo |
| Lãnh đạo khoa/viện | lanhdao@agu.edu.vn | Phê duyệt chỉ tiêu ngành, xem tiến độ, nhật ký |
| Quản trị hệ thống | quantri@agu.edu.vn | Cấp tài khoản, phân quyền, khóa/mở khóa, nhật ký |

Ở chế độ dữ liệu mẫu (mặc định, chưa cần backend), mật khẩu bất kỳ từ 6 ký tự đều được chấp nhận. Mọi thao tác được lưu trong trình duyệt (localStorage) nên tải lại trang vẫn còn. Nút **Khôi phục** ở góc dưới thanh bên đưa dữ liệu về như ban đầu (nên bấm trước buổi demo).

## Kịch bản demo gợi ý (5 phút)

1. Đăng nhập **Cán bộ tuyển sinh**, mở thẻ "Hồ sơ mới chờ tiếp nhận", chọn 1 hồ sơ, bấm **Tiếp nhận thẩm định**.
2. Đánh dấu 1 minh chứng **Không hợp lệ** (chọn lý do có sẵn), bấm **Yêu cầu bổ sung**: nội dung tự điền từ lý do vừa chọn, đặt hạn.
3. Bấm **Giả lập: thí sinh đã nộp bổ sung** (chỉ có ở dữ liệu mẫu; với backend thật thì đăng nhập cổng thí sinh để nộp), hồ sơ quay lại bước thẩm định. Đánh dấu tất cả **Hợp lệ** rồi bấm **Đạt thẩm định**. Xem lịch sử xử lý bên phải.
4. Vào **Đợt tuyển sinh**, mở đợt nháp 2027: nút **Mở đăng ký** bị khóa và ghi rõ lý do (ngành chưa duyệt, tổng trọng số 80%). Sửa trọng số thành 50% + 50%.
5. Đăng xuất, vào **Lãnh đạo**, phê duyệt ngành. Quay lại Cán bộ: nút Mở đăng ký đã bật.
6. Vào **Hội đồng**: xử lý 1 đơn phúc khảo; thử mở `/admin/accounts` để thấy màn hình "không có quyền".
7. Vào **Quản trị**: khóa 1 tài khoản, xem **Nhật ký hệ thống** ghi lại mọi thao tác ở các bước trên.

## Quy tắc nghiệp vụ đã cài (Backend phải làm y hệt)

**State machine `application.review_status`** — `src/lib/admin/stateMachine.ts`

| Thao tác | Từ | Sang | Điều kiện |
|---|---|---|---|
| START_REVIEW | SUBMITTED | UNDER_REVIEW | Người bấm thành cán bộ phụ trách |
| APPROVE | UNDER_REVIEW | APPROVED | Lệ phí `SUCCESS` và mọi minh chứng `VALID` |
| REJECT | UNDER_REVIEW | REJECTED | Lý do ≥ 10 ký tự |
| REQUEST_SUPPLEMENT | UNDER_REVIEW | NEEDS_SUPPLEMENT | Nội dung ≥ 10 ký tự, hạn sau thời điểm hiện tại; tạo `supplement_request` |
| SUPPLEMENT_RECEIVED | NEEDS_SUPPLEMENT | UNDER_REVIEW | Do thí sinh nộp bổ sung (phân hệ Thí sinh gọi) |
| REJECT_EXPIRED | NEEDS_SUPPLEMENT | REJECTED | Chỉ khi đã quá hạn bổ sung |

Mỗi lần chuyển: ghi 1 dòng `application_status_history`, 1 dòng `audit_log`, gửi `notification` cho thí sinh (EMAIL + SYSTEM).

**Đợt tuyển sinh**: DRAFT → OPEN → CLOSED → IN_REVIEW → COMPLETED (DRAFT có thể → CANCELLED). Mở đăng ký chỉ khi mọi ngành đã được lãnh đạo phê duyệt và tổng trọng số môn thi mỗi ngành = 100%. Chuyển sang xét kết quả chỉ khi không còn hồ sơ chưa kết luận. Sửa chỉ tiêu/môn thi chỉ khi đợt còn DRAFT, và sửa xong phải duyệt lại.

**Phân quyền (RBAC)**: ma trận quyền khai báo bằng code trong `src/lib/admin/permissions.ts`, đúng hướng Backend GĐ3 (không có bảng permission). Backend copy y hệt sang `PERMISSION_MATRIX` cho `RbacGuard`. Frontend chỉ ẩn/hiện; Backend vẫn phải chặn lại.

## Chạy với backend thật

Backend nằm ở thư mục `backend/` cạnh `frontend/` (NestJS + Prisma + MariaDB). Cách cài XAMPP, tạo CSDL và chạy backend: xem `backend/README.md`.
Khi backend đã chạy ở cổng 4000, tạo file `frontend/web/.env.local`:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_ADMIN_USE_MOCK=false
NEXT_PUBLIC_USE_MOCK=false
NEXT_PUBLIC_DEMO_LOGIN=true
```

Tắt rồi chạy lại `npm run dev`. Dòng `NEXT_PUBLIC_USE_MOCK` dành cho phân hệ Thí sinh, `NEXT_PUBLIC_ADMIN_USE_MOCK` dành cho phân hệ Quản lý.
Xóa file `.env.local` là quay về dữ liệu mẫu trong trình duyệt. Tài khoản demo khi dùng backend có mật khẩu chung `Demo@123`.

## API phân hệ Quản lý

| Hàm | Method | Path |
|---|---|---|
| staffLogin | POST | `/auth/staff/login` |
| staffLoginWithGoogle | POST | `/auth/staff/google` |
| getLookups | GET | `/admin/lookups` |
| getDashboard | GET | `/admin/dashboard` |
| listApplications | GET | `/admin/applications?batchId&majorId&status&q&sort&page&pageSize` |
| getApplication | GET | `/admin/applications/{id}` |
| verifyDocument | PATCH | `/admin/application-documents/{documentId}/verify` |
| reviewApplication | PATCH | `/applications/{id}/review` (đã có trong tài liệu Backend GĐ3) |
| bulkStartReview | POST | `/admin/applications/bulk-start-review` |
| listBatches / createBatch | GET / POST | `/admission-batches` |
| getBatch | GET | `/admission-batches/{id}` |
| changeBatchStatus | PATCH | `/admission-batches/{id}/status` |
| addBatchMajor | POST | `/admission-batches/{id}/majors` |
| updateBatchMajor | PUT | `/admission-batch-majors/{id}` |
| approveBatchMajor | PATCH | `/admission-batch-majors/{id}/approve` |
| listAppeals | GET | `/score-appeals` |
| resolveAppeal | POST | `/score-appeals/{id}/resolve` (đã có trong tài liệu Backend GĐ3) |
| listStaff / createStaff | GET / POST | `/staff-accounts` |
| updateStaffRoles | PUT | `/staff-accounts/{id}/roles` |
| setStaffStatus | PATCH | `/staff-accounts/{id}/status` |
| listAuditLogs | GET | `/audit-logs?q&actorType&page&pageSize` |
| adminListAnnouncements | GET | `/admin/announcements?status&category&q` |
| adminCreateAnnouncement | POST | `/admin/announcements` |
| adminUpdateAnnouncement | PUT | `/admin/announcements/{id}` |
| adminSetAnnouncementStatus | PATCH | `/admin/announcements/{id}/status` |

Các hàm thông báo nằm ở `src/lib/announcements.ts` (dùng chung với cổng Thí sinh: `getAnnouncements`, `getAnnouncement`, `getOpenBatches` gọi `/public/...`).

Dữ liệu trả về đúng kiểu trong `src/lib/admin/types.ts` (tên trường = cột `admission_db` v3 dạng camelCase). Lỗi theo format chung `{ error_code, message }`.

## Chưa làm ở bản này

Xếp phòng thi và nhập điểm (M5), xếp hạng và công bố trúng tuyển (M6), quyết định và nhập học (M7), màn cán bộ xử lý khiếu nại chung. Khung trang, phân quyền và lớp API đã sẵn để thêm các màn này theo cùng cách.
