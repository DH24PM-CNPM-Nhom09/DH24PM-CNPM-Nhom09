# Kiểm thử API tự động (chạy trên bản sao CSDL)

Ba kịch bản gọi thẳng API của backend và đọc CSDL để đối chiếu kết quả:

| Tệp | Kiểm tra | Số ca |
| :--- | :--- | :---: |
| `01-bao-mat-dang-nhap.js` | Lỗi 1 (chiếm tài khoản khi đăng ký chờ / Google), 2 (giữ chỗ SĐT), 3 (đặt lại mật khẩu thu hồi phiên cũ), 6 (đếm sai OTP lưu trong CSDL) | 16 |
| `02-can-bo-nghiep-vu.js` | Lỗi 3 (cán bộ đổi mật khẩu giữ phiên), 7 (tệp hồ sơ nháp), 8 (khóa sửa nhân thân sau khi nộp), 9 (lệ phí 0đ), 10 (thang điểm ≤ 10), 11 (bảng điều khiển), 12 (mở lại phòng thi, không dời giờ về quá khứ) | 17 |
| `03-loi-14-23.js` | Lỗi 14 (mã học viên khi bấm cùng lúc), 15 (trùng phòng phỏng vấn giữa các ngành), 16 (CSV), 17 (hồ sơ kẹt vì trượt / vắng thi tiếng Anh), 18–23 (kiểm tra đầu vào, múi giờ) | 24 |

Lỗi 13 (gửi lại email) được thử bằng mô phỏng máy chủ email lỗi; các hàm không cần CSDL có
kiểm thử đơn vị trong `backend/test` (`npm test`, chạy cả trong CI).

> ⚠️ Các kịch bản **sửa dữ liệu** (đổi mật khẩu tài khoản cán bộ mẫu, đổi trạng thái đợt, xếp lịch, hoàn tất nhập học...).
> Chỉ chạy trên **bản sao** CSDL, không chạy trên CSDL thật / Aiven.

## Cách chạy

Cần: CSDL có **dữ liệu mẫu** (`npm run db:seed:demo` — kịch bản 03 dùng các đợt THS-2026-D1 / D2 của bộ mẫu),
backend chạy với `DEV_AUTH_BYPASS=true`, **chưa** đặt `GOOGLE_CLIENT_ID` và chưa cấu hình email (để API trả mã OTP thử).

```bash
# 1. Tạo bản sao CSDL (MariaDB / XAMPP)
mysql -uroot -p -e "CREATE DATABASE admission_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mysqldump -uroot -p --routines --triggers admission_db | mysql -uroot -p admission_test

# 2. Chạy backend thứ hai trỏ vào bản sao, cổng 4100, chế độ thử (DEV_AUTH_BYPASS=true, chưa cấu hình email)
cd backend
npm run build
DATABASE_URL="mysql://root:<mật khẩu>@127.0.0.1:3306/admission_test" PORT=4100 DEV_AUTH_BYPASS=true node dist/main.js

# 3. Cửa sổ khác: chạy kịch bản (dùng cùng DATABASE_URL để đọc bản sao)
DATABASE_URL="mysql://root:<mật khẩu>@127.0.0.1:3306/admission_test" node ../qa/kiem-thu-api/01-bao-mat-dang-nhap.js
DATABASE_URL="..." node ../qa/kiem-thu-api/02-can-bo-nghiep-vu.js
DATABASE_URL="..." node ../qa/kiem-thu-api/03-loi-14-23.js
```

Windows (PowerShell): đặt biến bằng `$env:DATABASE_URL="..."; $env:PORT="4100"` trước lệnh `node`.

Mỗi dòng in `PASS` / `FAIL`, cuối cùng là tổng số. Muốn chạy lại từ đầu thì tạo lại bản sao (bước 1).
Email thí sinh trong kịch bản đều có đuôi `@example.test` (tên miền dành riêng cho thử nghiệm), không gửi thư thật.

Biến tùy chọn: `API` (mặc định `http://localhost:4100/api/v1`), `BE` (thư mục backend), `ADMIN_PW`.
