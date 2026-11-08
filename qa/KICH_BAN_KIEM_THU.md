# Kịch bản kiểm thử — Cổng tuyển sinh Sau đại học

Ba lớp kiểm thử:

1. **Kiểm thử đơn vị** — `cd backend && npm test` (không cần CSDL; chạy tự động trong CI ở mỗi Pull Request vào `main`).
   Tệp: `backend/test/validate.test.ts` (ngày sinh, họ tên, SĐT, múi giờ…), `backend/test/rules.test.ts`
   (thẩm định hồ sơ, tính điểm thang 10, xếp lịch, CSV, lệ phí 0đ, ma trận quyền FE = BE, phiên đăng nhập).
2. **Kiểm thử API tự động** — `qa/kiem-thu-api/` (57 ca, chạy trên bản sao CSDL, xem README trong thư mục).
3. **Kiểm thử tay trên giao diện** — bảng dưới đây. Ghi kết quả vào cột cuối khi kiểm tra trước buổi demo / bàn giao.

Tài khoản thử: tạo thí sinh mới bằng email thật của người kiểm thử (không dùng địa chỉ bịa — hệ thống gửi email thật khi đã cấu hình).

## A. Tài khoản và đăng nhập

| # | Bước thực hiện | Kết quả mong đợi | Lỗi liên quan | Đạt? |
| :-- | :--- | :--- | :---: | :---: |
| A1 | Đăng ký với ngày sinh đúng 18 năm trước hôm nay | Đăng ký được | 18 | |
| A2 | Đăng ký với ngày sinh 18 năm trước ngày mai | Báo "phải từ 18 tuổi trở lên" | 18 | |
| A3 | Gọi API đăng ký với `dob: "2008-02-30"` | 400 "Ngày sinh không hợp lệ" (không tự đổi thành 01/03) | 19 | |
| A4 | Đăng ký tên "H'Hen Niê", "Nguyễn-Trần An"; gõ tên trên Mac/iPhone | Đăng ký được; tên lưu đúng chữ có dấu | 20 | |
| A5 | Đăng ký họ tên dài 300 ký tự (gọi API) | 400 "Họ và tên tối đa 100 ký tự", không phải lỗi 500 | 21 | |
| A6 | Đăng ký SĐT "0912.345.678", sau đó sửa ở Hồ sơ cá nhân thành "+84 912 345 679" | Cả hai đều lưu dạng 09xxxxxxxx | 22 | |
| A7 | Người B đăng ký lại email của người A khi mã xác thực của A còn hạn | Báo "Email này vừa được đăng ký và đang chờ nhập mã" | 1 | |
| A8 | Đăng ký bỏ dở (không nhập mã), chờ mã hết hạn, người khác đăng ký cùng SĐT | Người sau đăng ký được | 2 | |
| A9 | Đăng nhập trên 2 trình duyệt, đặt lại mật khẩu ở trình duyệt 1 | Trình duyệt 2 bị đưa về trang đăng nhập ở thao tác kế tiếp | 3 | |
| A10 | Cán bộ đổi mật khẩu ở trang Tài khoản | Vẫn ở lại trang, không bị đăng xuất | 3 | |
| A11 | Nhập sai mã OTP 3 lần, chờ máy chủ khởi động lại, nhập sai thêm 2 lần | Lần thứ 5 mã bị hủy (số lần sai không mất khi khởi động lại) | 6 | |
| A12 | Mở `/api/v1/public/auth-config` trên máy chủ thật | `devAuthBypass: false` | 4 | |

## B. Hồ sơ thí sinh

| # | Bước thực hiện | Kết quả mong đợi | Lỗi liên quan | Đạt? |
| :-- | :--- | :--- | :---: | :---: |
| B1 | Sau khi nộp hồ sơ, sửa họ tên / ngày sinh / CCCD ở Hồ sơ cá nhân | Báo "đã nộp nên không sửa được…"; SĐT, địa chỉ vẫn sửa được | 8 | |
| B2 | Hồ sơ nháp đã tích cam kết, sửa địa chỉ | Phải tích lại ô cam kết trước khi nộp | 8 | |
| B3 | Khai ngày cấp CCCD 30/02 (gọi API) | Báo "Ngày cấp CCCD không hợp lệ" | 19 | |
| B4 | Đợt có lệ phí 0đ: nộp hồ sơ | Hồ sơ hiện đã nộp lệ phí (MIEN-PHI), không hiện mã chuyển khoản | 9 | |

## C. Cán bộ tuyển sinh

| # | Bước thực hiện | Kết quả mong đợi | Lỗi liên quan | Đạt? |
| :-- | :--- | :--- | :---: | :---: |
| C1 | Cấu hình lệ phí = 0, lưu, tải lại trang | Vẫn là 0 | 9 | |
| C2 | Mở tệp minh chứng của hồ sơ còn nháp (sửa id trên đường dẫn) | 404 | 7 | |
| C3 | Bảng điều khiển khi có đợt Đã đóng / Đang xét | Đợt đó vẫn được đếm | 11 | |
| C4 | Hủy phòng thi tiếng Anh, sửa thông tin phòng | Phòng vẫn Đã hủy; bấm "Mở lại" mới về Đã lên lịch | 12 | |
| C5 | Sửa giờ thi tiếng Anh về hôm qua | Báo lỗi, không lưu | 12 | |
| C6 | Xếp lịch phỏng vấn tự động ngành X ở "Phòng B2-101", rồi ngành Y cùng phòng, cùng giờ bắt đầu | Ngành Y được xếp sang các khung giờ còn trống, thông báo số khung đã bỏ qua | 15 | |
| C7 | Sửa tay một lượt phỏng vấn sang giờ đã có người trong cùng phòng | Báo "Phòng / đường dẫn này đã có lịch …" | 15 | |
| C8 | Hai cán bộ cùng bấm "Hoàn tất nhập học" cho 2 thí sinh cùng đợt cùng lúc | Hai mã học viên khác nhau; bấm 2 lần một thí sinh thì lần sau báo "đã hoàn tất" | 14 | |
| C9 | Xuất CSV khi có thí sinh địa chỉ bắt đầu bằng "=" hoặc ký tự tab | Excel hiện nguyên văn, không chạy công thức | 16 | |
| C10 | Xuất CSV khi danh sách > 50.000 tài khoản (hoặc giảm `EXPORT_MAX_ROWS` để thử) | Cảnh báo đỏ "tệp chỉ có …/… thí sinh"; dòng cuối tệp ghi rõ | 16 | |
| C11 | Đợt đã đóng có hồ sơ thi tiếng Anh Không đạt / Vắng chưa kết luận; chuyển đợt sang "Xét kết quả" | Chuyển được; các hồ sơ đó tự kết luận Không đạt (lý do ngoại ngữ), thí sinh nhận thông báo | 17 | |
| C12 | Tạo đợt với tên 300 ký tự / căn cứ pháp lý 150 ký tự | 400 có câu dễ hiểu, không phải lỗi 500 | 21 | |
| C13 | Gọi API tạo đợt với `registrationStartAt: "2026-12-01T08:00"` (không có múi giờ) | Trang chi tiết đợt hiện 08:00 (giờ VN), không phải 15:00 | 23 | |
| C14 | Yêu cầu bổ sung với hạn "2026-12-01T17:00" gửi từ app / API | Hạn hiển thị 17:00 ngày 01/12 | 23 | |
| C15 | Đặt thang điểm môn 20 (gọi API) | Báo "Thang điểm của môn phải từ 1 đến 10" | 10 | |

## D. Email thông báo

| # | Bước thực hiện | Kết quả mong đợi | Lỗi liên quan | Đạt? |
| :-- | :--- | :--- | :---: | :---: |
| D1 | Tạm sai khóa gửi email (RESEND_API_KEY), duyệt một hồ sơ, sửa lại khóa trong 10 phút | Thư vẫn tới (hệ thống thử lại sau 1, 5, 15… phút); chỉ đánh FAILED sau 6 lần lỗi | 13 | |
| D2 | Bảng `notification` có nhiều nghìn dòng | Log backend không chậm dần; mỗi 20 giây chỉ đọc tối đa 20 thông báo đang chờ | 13 | |
