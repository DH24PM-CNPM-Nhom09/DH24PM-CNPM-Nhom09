# Sửa 24 lỗi do An rà soát (11/2026)

Mỗi dòng: lỗi → cách sửa → chỗ sửa chính. Kiểm thử: `backend/test` (đơn vị, `npm test`), `qa/kiem-thu-api` (API, 57 ca), `qa/KICH_BAN_KIEM_THU.md` (kiểm tra tay).

## Đợt 1 — commit "Sửa 12 lỗi bảo mật và nghiệp vụ"

| # | Lỗi | Cách sửa | Tệp chính |
| :-- | :--- | :--- | :--- |
| 1 | Đăng ký lại ghi đè mật khẩu tài khoản chờ xác thực; Google kích hoạt nhưng giữ mật khẩu cũ | Mã còn hạn thì không cho người khác đăng ký lại (`REGISTRATION_PENDING`); web gửi kèm mật khẩu khi nhập mã; Google kích hoạt thì xóa mật khẩu + SĐT + hồ sơ chưa ai chứng minh | `auth.service.ts` |
| 2 | SĐT bị đăng ký bỏ dở giữ chỗ mãi | SĐT của đăng ký chưa xác thực, mã đã hết hạn được nhả; tự dọn tài khoản chờ > 7 ngày | `common/pending-accounts.ts`, `jobs.service.ts` |
| 3 | Đổi / đặt lại mật khẩu không thu hồi JWT cũ | Token mang `pv` (dấu phiên bản mật khẩu), AuthGuard so với CSDL | `common/auth.ts` |
| 4 | `DEV_AUTH_BYPASS=true` mặc định, đăng nhập giả được cả khi có Google | Mặc định `false`; chỉ có tác dụng khi chưa có `GOOGLE_CLIENT_ID`; `/public/auth-config` báo `devAuthBypass`; cảnh báo khi khởi động | `.env.example`, `main.ts` |
| 5 | JWT_SECRET mẫu công khai vẫn được dùng | Gặp chuỗi mẫu thì dùng khóa ngẫu nhiên tạm + cảnh báo | `common/jwt-secret.ts` |
| 6 | Đếm sai OTP / giới hạn IP nằm trong RAM | Bảng `security_counter` (migration v14), câu lệnh tăng nguyên tử | `common/counter.ts`, `otp.service.ts`, `security.ts` |
| 7 | Tải được tệp của hồ sơ nháp | Hồ sơ nháp / đã xóa trả 404 | `admin/applications.service.ts` |
| 8 | Sửa nhân thân sau khi nộp; không reset cam kết | Khóa họ tên, ngày sinh, giới tính, CCCD (`PROFILE_LOCKED`); hồ sơ nháp phải cam kết lại | `candidate/candidate.service.ts` |
| 9 | Lệ phí 0đ không lưu được | `parseMoney` nhận 0; hồ sơ 0đ ghi nhận đã nộp (`KHAC`, biên lai `MIEN-PHI`) | `config.service.ts`, `application-flow.service.ts` |
| 10 | Thang điểm không chuẩn hóa | Quy từng môn về thang 10 trước khi nhân trọng số; thang điểm môn 1–10 | `common/admission.ts`, `batches.service.ts` |
| 11 | Bảng điều khiển chỉ đếm đợt OPEN | Đếm OPEN + CLOSED + IN_REVIEW | `admin/applications.service.ts` |
| 12 | Sửa phòng thi đã hủy tự mở lại; dời giờ về quá khứ | Chỉ nút "Mở lại" mới mở lại; giờ mới phải ở tương lai; phòng đã thi không đổi giờ | `english-test.service.ts`, web `english-test/page.tsx` |

## Đợt 2 — commit "Sửa thêm 12 lỗi…"

| # | Lỗi | Cách sửa | Tệp chính |
| :-- | :--- | :--- | :--- |
| 13 | Email lỗi một lần là FAILED; quét toàn bộ tài khoản mỗi 20 giây | Thử lại sau 1, 5, 15, 60, 180 phút, FAILED sau 6 lần (số lần lưu ở `security_counter`); một câu SQL JOIN chỉ lấy 20 thông báo đang chờ; chỉ mục `idx_notification_queue` | `common/notification-dispatcher.ts` |
| 14 | Mã học viên "max + 1" có thể trùng | Khóa dòng đợt (`SELECT … FOR UPDATE`), lấy số lớn nhất theo giá trị số, chỉ mục UNIQUE `uq_completion_transfer_ref`, thử lại khi đụng; bấm trùng một hồ sơ báo "đã hoàn tất" | `admin/enrollment.service.ts` |
| 15 | Lịch phỏng vấn trùng phòng / giờ giữa các ngành | Xếp tự động bỏ qua khung giờ phòng (mọi ngành) hoặc tiểu ban đang bận; sửa tay trùng thì báo `SCHEDULE_CLASH` | `admin/scoring.service.ts` |
| 16 | CSV cắt cứng 5000 dòng không báo; thiếu chặn tab / CR | Đọc theo lô 1000 dòng, tối đa 50.000; vượt thì ghi rõ trong tệp + header `X-Export-Truncated`, web cảnh báo; chặn `= + - @ \t \r \n` (cả sau khoảng trắng) | `common/csv.ts`, `admin/candidates.service.ts` |
| 17 | Hồ sơ trượt / vắng thi tiếng Anh kẹt, đợt không sang Xét kết quả | Khi chuyển đợt sang IN_REVIEW, hồ sơ đó tự kết luận Không đạt (lý do ngoại ngữ, ghi lịch sử, báo thí sinh) | `admin/batches.service.ts` |
| 18 | Đúng sinh nhật 18 tuổi bị từ chối (/365.25) | Tính tuổi theo lịch, theo ngày Việt Nam | `common/validate.ts` (`ageOn`) |
| 19 | Ngày không tồn tại (30/02) bị đổi sang tháng sau | `parseYmd` kiểm tra ngày có thật — ngày sinh, ngày cấp CCCD, ngày quyết định, ngày lập tiểu ban | `common/validate.ts` |
| 20 | Tên NFD, có `-` hoặc `'` bị chặn | Chuẩn hóa NFC; cho phép gạch nối / nháy giữa các chữ (web + app cùng quy tắc) | `common/validate.ts`, web `register/page.tsx`, app `register_screen.dart` |
| 21 | Nhập quá dài ra 500 | Kiểm tra độ dài trước (họ tên 100, tên đợt 255, căn cứ pháp lý 100…); bộ lọc lỗi đổi Prisma P2000 / "Data too long" thành 400 `VALUE_TOO_LONG` | `exception.filter.ts` |
| 22 | Sửa thông tin không kiểm tra như đăng ký; SĐT chuẩn hóa lệch | Dùng chung `normalizeFullName` / `fullNameError` / `normalizePhone` (bỏ khoảng trắng . - ( ), +84 → 0) | `candidate.service.ts`, `auth.service.ts`, `application-flow.service.ts` |
| 23 | Ngày giờ không múi giờ bị hiểu là UTC (lệch 7 tiếng) | `parseDateTimeVn`: không có múi giờ = giờ Việt Nam; áp dụng cho đợt, hạn bổ sung, giờ thi, lịch phỏng vấn, ngày nộp tiền | `common/validate.ts` |
| 24 | Không có test; CI chỉ build | 30 kiểm thử đơn vị (`node:test`, không thêm thư viện) chạy trong CI; 57 ca kiểm thử API; kịch bản kiểm tra tay | `backend/test`, `qa/` , `.github/workflows/ci.yml` |

## Cập nhật CSDL

- **Render / Aiven**: không cần làm tay — lúc khởi động `start:hosted` tự thêm bảng `security_counter` và 2 chỉ mục v15 (chỉ thêm, không sửa dữ liệu). Nếu đã có mã học viên trùng, chỉ mục UNIQUE sẽ không được tạo và log ghi rõ để xử lý tay.
- **Máy cá nhân (XAMPP / MariaDB)**: `cd backend && npm run db:update`.
- **Docker**: CSDL mới tự chạy tới `migration_v15_indexes.sql`.

## Lưu ý khi triển khai

- Mọi người phải đăng nhập lại một lần (token cũ không có `pv`).
- App điện thoại: máy chủ đã chấp nhận tên có `-`/`'` và đúng ngày sinh nhật 18 tuổi; bản APK cũ vẫn chặn ở máy cho tới khi build lại APK.
