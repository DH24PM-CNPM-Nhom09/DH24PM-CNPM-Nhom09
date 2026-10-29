// Cấu hình chung của app.
//
// Địa chỉ API mặc định là máy chủ thật của nhóm. Khi chạy thử với backend trên
// máy cá nhân, build kèm:
//   flutter run --dart-define=API_BASE=http://10.0.2.2:4000/api/v1   (máy ảo Android)
//   flutter run --dart-define=API_BASE=http://<IP-máy-tính>:4000/api/v1   (điện thoại thật cùng Wi-Fi)
// Hoặc đổi ngay trong app: màn hình Đăng nhập → bấm giữ vào logo → "Địa chỉ máy chủ".
class AppConfig {
  static const defaultApiBase = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'https://tuyensinh-nhom09-api.onrender.com/api/v1',
  );

  /// Trang web của cổng tuyển sinh (mở các chức năng chỉ có trên web, ví dụ in đơn đăng ký).
  static const webBase = String.fromEnvironment(
    'WEB_BASE',
    defaultValue: 'https://tuyensinhsdhnhom09.id.vn',
  );

  static const appName = 'Tuyển sinh Sau đại học';
  static const schoolName = 'Trường Đại học An Giang';

  /// Render bản miễn phí "ngủ" sau 15 phút không dùng, lần gọi đầu có thể mất gần 1 phút.
  static const requestTimeout = Duration(seconds: 90);

  /// Giới hạn tệp minh chứng — khớp backend (5MB/tệp, PDF/JPG/PNG).
  static const maxFileBytes = 5 * 1024 * 1024;
}
