# Ứng dụng di động Thí sinh — Cổng tuyển sinh Sau đại học

App Flutter dành **riêng cho thí sinh** (theo yêu cầu của giảng viên). Phần quản trị vẫn làm trên web.
App dùng **chung tài khoản và chung API** với web (`backend/`), không có backend riêng.

## Chức năng

| Nhóm | Chức năng |
| :--- | :--- |
| Tài khoản | Đăng nhập (email/SĐT + mật khẩu), đăng ký + mã OTP qua email, quên mật khẩu |
| Tổng quan | Lời chào, "việc cần làm tiếp theo" theo trạng thái hồ sơ, lối tắt, thông báo mới |
| Tạo hồ sơ | Chọn đợt & ngành → quá trình đào tạo → ngoại ngữ → khai theo CCCD (**quét mã QR trên CCCD**) + **chụp/tải minh chứng bằng camera** → đề tài (tiến sĩ) → xác nhận & nộp |
| Hồ sơ | Trạng thái, lịch sử xử lý, bổ sung minh chứng khi được yêu cầu, **lệ phí + mã VietQR**, lịch thi tiếng Anh |
| Xét tuyển | Điểm, phúc khảo, kết quả, quyết định trúng tuyển, xác nhận / từ chối nhập học |
| Giấy báo | **Tạo giấy báo trúng tuyển PDF ngay trên máy** (có mã QR đối chiếu), xem trước, lưu / chia sẻ |
| Tuyển sinh | Thông báo của Trường, các đợt đang mở, điều kiện từng ngành, **tải điều kiện tuyển sinh PDF** |
| Khác | Thông báo cá nhân, khiếu nại / phúc khảo, giảng viên hướng dẫn (tiến sĩ), sửa thông tin |

## Cấu trúc `lib/`

```
config.dart              địa chỉ API mặc định (đổi bằng --dart-define=API_BASE=...)
models/models.dart       kiểu dữ liệu khớp JSON backend (giống web src/lib/types.ts)
services/api_client.dart gọi HTTP, gắn token, đổi lỗi sang câu tiếng Việt
services/api_service.dart các API của cổng thí sinh (cùng đường dẫn với web src/lib/api.ts)
services/app_state.dart  dữ liệu dùng chung giữa các tab
services/pdf_service.dart giấy báo trúng tuyển + điều kiện tuyển sinh (PDF, phông Roboto có dấu)
services/file_pick.dart  chụp ảnh / chọn ảnh / chọn PDF, kiểm tra ≤ 5MB
utils/                   định dạng ngày giờ, tiền; VietQR; đọc QR CCCD; nhãn tiếng Việt
screens/                 các màn hình (auth, shell, wizard, ...)
widgets/                 nút, ô nhập, thẻ, ô minh chứng ...
```

## Chạy thử

```bash
cd frontend/mobile
flutter pub get
flutter run                     # dùng máy chủ thật https://tuyensinh-nhom09-api.onrender.com/api/v1
```

Chạy với backend trên máy tính (cùng Wi-Fi với điện thoại):

```bash
flutter run --dart-define=API_BASE=http://<IP-máy-tính>:4000/api/v1
# máy ảo Android: http://10.0.2.2:4000/api/v1
```

Hoặc đổi ngay trong app: màn hình Đăng nhập → **bấm giữ vào khối logo** → nhập địa chỉ máy chủ.

## Build file cài đặt (APK)

```bash
flutter build apk --release --split-per-abi
# build/app/outputs/flutter-apk/app-arm64-v8a-release.apk  (đa số điện thoại hiện nay)
```

## Kiểm thử

```bash
flutter analyze
flutter test                                   # kiểm thử đơn vị + giao diện
# Kiểm thử tích hợp với backend thật (chế độ thử, không gửi email):
API_BASE_TEST=http://localhost:4000/api/v1 flutter test test/api_integration_test.dart
```

## Ghi chú

- Đăng nhập bằng Google chưa có trên app (cần tạo thêm OAuth client cho Android). Tài khoản tạo bằng Google trên web vẫn dùng web.
- `android/gradle.properties` có dòng `org.gradle.java.home` trỏ JDK 17 trên máy của Khang; máy khác báo lỗi JDK thì sửa/xóa dòng này.
- Đơn đăng ký dự tuyển in từ web (nút "Mở trang in đơn trên web" trong app), ký tên rồi chụp tải lên.
