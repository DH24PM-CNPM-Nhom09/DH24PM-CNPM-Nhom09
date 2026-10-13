# Đưa web lên mạng miễn phí với tên miền riêng

Web chạy ở **https://tuyensinhsdhnhom09.id.vn**, ai có link cũng vào được, mã OTP gửi về email thật. Không tốn tiền, không cần bật máy cá nhân.

| Phần | Dịch vụ miễn phí | Ghi chú |
| :--- | :--- | :--- |
| Giao diện (Next.js) | Render — Web Service Free | `https://tuyensinhsdhnhom09.id.vn` |
| API (NestJS) | Render — Web Service Free | `https://api.tuyensinhsdhnhom09.id.vn` |
| CSDL | Aiven — MySQL Free (1 GB) | Backend tự tạo bảng lần đầu |
| Gửi email OTP | Resend Free (3.000 thư/tháng, 100 thư/ngày) | Gửi từ `no-reply@tuyensinhsdhnhom09.id.vn` |
| Tên miền | iNET (đã mua) | Chỉ sửa bản ghi DNS |

Giới hạn của bản miễn phí:
- Không ai vào trong 15 phút thì Render cho web "ngủ"; người vào đầu tiên chờ khoảng 1 phút.
- Aiven có thể tắt CSDL khi lâu ngày không dùng (có email báo trước). Khi đó vào Aiven bấm **Power on**.
- Tệp minh chứng được lưu trong CSDL (`UPLOAD_STORAGE=db`) nên không mất khi Render ngủ. CSDL có 1 GB, đủ cho vài trăm bộ hồ sơ.

Làm lần lượt 5 bước dưới đây. Mỗi bước ghi rõ nút cần bấm và giá trị cần điền.

---

## Bước 1. Tạo CSDL trên Aiven

1. Vào https://console.aiven.io, đăng ký (dùng Google hoặc GitHub cho nhanh).
2. **Create service** → chọn **MySQL** → gói **Free**.
3. Chọn vùng gần Việt Nam nhất trong danh sách (Singapore nếu có), đặt tên, ví dụ `tuyensinh-db` → **Create service**.
4. Đợi trạng thái thành **Running** (vài phút).
5. Ở trang tổng quan của dịch vụ, mục **Connection information**, sao chép **Service URI**. Nó có dạng
   `mysql://avnadmin:MAT_KHAU@mysql-xxxx.aivencloud.com:12345/defaultdb?ssl-mode=REQUIRED`.
   Giữ nguyên chuỗi này, bước 3 sẽ dán vào `DATABASE_URL`. Backend tự xử lý phần `ssl-mode`.

Không cần chạy lệnh SQL nào: lần đầu backend khởi động sẽ tự tạo đủ 46 bảng.

## Bước 2. Tạo tài khoản gửi email trên Resend

1. Vào https://resend.com, đăng ký.
2. **Domains** → **Add Domain** → nhập `tuyensinhsdhnhom09.id.vn` → **Add**.
3. Resend hiện ra 3–4 bản ghi DNS (loại MX và TXT, tên dạng `send` và `resend._domainkey`). **Để trang này mở**, sang bước 5 thêm các bản ghi đó ở iNET rồi quay lại bấm **Verify DNS Records**.
4. **API Keys** → **Create API Key** → quyền **Sending access** → sao chép khóa (bắt đầu bằng `re_`). Khóa chỉ hiện 1 lần, nên lưu lại cẩn thận và không gửi cho ai.

## Bước 3. Tạo dịch vụ API (backend) trên Render

1. Vào https://render.com, đăng ký tài khoản **của bạn** (không dùng chung với tài khoản của Hải).
2. **New** → **Web Service** → thẻ **Public Git Repository** → dán
   `https://github.com/DH24PM-CNPM-Nhom09/DH24PM-CNPM-Nhom09` → **Connect**.
3. Điền:

   | Ô | Giá trị |
   | :--- | :--- |
   | Name | `tuyensinh-nhom09-api` |
   | Language | `Docker` |
   | Branch | `frontend` |
   | Region | `Singapore` |
   | Root Directory | `backend` |
   | Instance Type | `Free` |

4. Mục **Environment Variables** → thêm từng dòng:

   | Tên | Giá trị |
   | :--- | :--- |
   | `DATABASE_URL` | Service URI copy ở bước 1 |
   | `JWT_SECRET` | bấm **Generate** để Render tự tạo chuỗi ngẫu nhiên |
   | `CORS_ORIGINS` | `https://tuyensinhsdhnhom09.id.vn,https://www.tuyensinhsdhnhom09.id.vn,https://tuyensinh-nhom09-web.onrender.com` |
   | `DEV_AUTH_BYPASS` | `false` |
   | `UPLOAD_STORAGE` | `db` |
   | `RESEND_API_KEY` | khóa `re_...` ở bước 2 |
   | `MAIL_FROM` | `no-reply@tuyensinhsdhnhom09.id.vn` |
   | `SEED_DEMO` | `true` để có sẵn 65 hồ sơ mẫu cho buổi demo, `false` nếu muốn web trống |
   | `SEED_DEMO_PASSWORD` | mật khẩu riêng của nhóm cho các tài khoản cán bộ mẫu (khi `SEED_DEMO=true`) |
   | `SEED_ADMIN_PASSWORD` | mật khẩu cho `quantri@agu.edu.vn` (khi `SEED_DEMO=false`) |

   Không dùng `Demo@123`, vì mật khẩu này có sẵn trong mã nguồn công khai trên GitHub.

5. Mở **Advanced**:
   - **Health Check Path**: `/health`
   - **Docker Command**: `npm run start:hosted`
6. **Deploy Web Service**. Lần đầu build mất khoảng 5–10 phút. Trong **Logs** sẽ thấy:
   `✓ Đã tạo đủ bảng và dữ liệu cấu hình.` … `Đã bật gửi email qua Resend (HTTPS)` … `Nest application successfully started`.
7. Ghi lại địa chỉ Render cấp ở đầu trang (dạng `https://tuyensinh-nhom09-api.onrender.com`). Nếu tên đã có người dùng, Render thêm đuôi ngẫu nhiên; khi đó dùng đúng địa chỉ Render hiện ra ở các bước sau.

Kiểm tra: mở `https://tuyensinh-nhom09-api.onrender.com/health` thấy `"database":"up"` là được.

## Bước 4. Tạo dịch vụ giao diện (frontend) trên Render

1. **New** → **Web Service** → **Public Git Repository** → cùng địa chỉ GitHub như trên.
2. Điền:

   | Ô | Giá trị |
   | :--- | :--- |
   | Name | `tuyensinh-nhom09-web` |
   | Language | `Docker` |
   | Branch | `frontend` |
   | Region | `Singapore` |
   | Root Directory | `frontend/web` |
   | Instance Type | `Free` |

3. **Environment Variables**:

   | Tên | Giá trị |
   | :--- | :--- |
   | `NEXT_PUBLIC_API_BASE_URL` | `https://api.tuyensinhsdhnhom09.id.vn/api/v1` |
   | `NEXT_PUBLIC_DEMO_LOGIN` | `false` |

   Giá trị `NEXT_PUBLIC_*` được "đóng" vào web lúc build. Sau này có đổi thì phải bấm **Manual Deploy** để build lại.

4. **Advanced** → **Health Check Path**: `/announcements` → **Deploy Web Service**.

## Bước 5. Trỏ tên miền ở iNET

**5a. Gắn tên miền trên Render**

- Dịch vụ `tuyensinh-nhom09-web` → **Settings** → **Custom Domains** → **Add Custom Domain**: thêm `tuyensinhsdhnhom09.id.vn`, rồi thêm tiếp `www.tuyensinhsdhnhom09.id.vn`.
- Dịch vụ `tuyensinh-nhom09-api` → **Settings** → **Custom Domains**: thêm `api.tuyensinhsdhnhom09.id.vn`.

**5b. Sửa bản ghi ở iNET**

Vào trang quản lý tên miền iNET → **Quản lý DNS** của `tuyensinhsdhnhom09.id.vn`.

1. **Xóa** 3 bản ghi A đang có ở `@` (IP `103.166.183.10`, `103.216.118.10`, `103.56.163.10`; đây là trang mặc định của iNET). Nếu có bật "chuyển tiếp tên miền" thì tắt.
2. **Thêm**:

   | Loại | Tên (Host) | Giá trị | Ghi chú |
   | :--- | :--- | :--- | :--- |
   | A | `@` | `216.24.57.1` | địa chỉ máy chủ của Render |
   | CNAME | `www` | `tuyensinh-nhom09-web.onrender.com` | địa chỉ Render của web |
   | CNAME | `api` | `tuyensinh-nhom09-api.onrender.com` | địa chỉ Render của API |
   | MX, TXT | như Resend hiện | như Resend hiện | 3–4 bản ghi ở bước 2 |

   Không thêm bản ghi AAAA nào.

3. Đợi 5–30 phút rồi:
   - Trên Render, bấm **Verify** ở từng tên miền. Render tự cấp HTTPS (ổ khóa), có thể mất thêm ít phút.
   - Trên Resend, bấm **Verify DNS Records** cho tới khi tên miền chuyển sang **Verified**.

## Kiểm tra lần cuối

- Mở `https://tuyensinhsdhnhom09.id.vn` → trang thông báo tuyển sinh hiện ra.
- **Đăng ký** bằng email thật của bạn → mã OTP về hộp thư (xem cả mục Thư rác lần đầu).
- `https://tuyensinhsdhnhom09.id.vn/admin/login` → đăng nhập cán bộ:
  - `SEED_DEMO=true`: `canbo@agu.edu.vn`, `hoidong@agu.edu.vn`, `lanhdao@agu.edu.vn`, `quantri@agu.edu.vn` với mật khẩu `SEED_DEMO_PASSWORD`.
  - `SEED_DEMO=false`: `quantri@agu.edu.vn` với `SEED_ADMIN_PASSWORD`. Hệ thống bắt đổi mật khẩu ngay lần đầu.

Dữ liệu mẫu dùng địa chỉ email bịa. Hệ thống chỉ gửi email cho tài khoản đã xác thực mã OTP, nên các địa chỉ đó không bao giờ nhận thư.

## Cập nhật web khi có code mới

Repo công khai nên Render không tự build khi có code mới. Sau khi đẩy code lên nhánh `frontend`, vào từng dịch vụ trên Render → **Manual Deploy** → **Deploy latest commit**. Dữ liệu trong CSDL vẫn giữ nguyên.

## Đăng nhập bằng Google (không bắt buộc)

Thí sinh vẫn đăng ký bằng email + OTP bình thường. Muốn bật nút Google:

1. Vào Google Cloud Console → Google Auth Platform → Clients → tạo client **Web application**.
2. Ở **Authorized JavaScript origins** thêm `https://tuyensinhsdhnhom09.id.vn` và `https://www.tuyensinhsdhnhom09.id.vn`.
3. Đặt `GOOGLE_CLIENT_ID` ở dịch vụ API trên Render.

## Lỗi thường gặp

| Hiện tượng | Cách xử lý |
| :--- | :--- |
| Web mở được nhưng đăng nhập báo lỗi mạng | `CORS_ORIGINS` của API chưa có đúng địa chỉ web (có `https://`, không có `/` ở cuối) |
| Log API: `Khởi tạo CSDL thất bại` / `database: down` | Kiểm tra `DATABASE_URL`; vào Aiven xem dịch vụ có đang **Running** không (bị tắt thì **Power on**) |
| Không nhận được OTP, log có `Resend trả lỗi 403` | Tên miền trên Resend chưa **Verified**, hoặc `MAIL_FROM` không thuộc `tuyensinhsdhnhom09.id.vn` |
| Mở tên miền thấy trang của iNET | Chưa xóa hết 3 bản ghi A cũ, hoặc DNS chưa cập nhật (đợi thêm) |
| Lần đầu mở web chờ lâu | Render đang "đánh thức" dịch vụ, khoảng 1 phút |

Chạy thử trên máy với MySQL 8 giống Aiven (không bắt buộc): `npm run db:hosted-init` trong `backend/` với `DATABASE_URL` trỏ tới MySQL trống. Tệp tạo bảng là `backend/database/hosted/admission_db_mysql.sql`, sinh từ bản MariaDB đầy đủ bằng `mariadb_to_mysql.py` (hướng dẫn ở đầu tệp đó).
