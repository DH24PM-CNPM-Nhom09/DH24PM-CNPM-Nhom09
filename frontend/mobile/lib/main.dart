import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'config.dart';
import 'screens/auth/login_screen.dart';
import 'screens/shell/app_shell.dart';
import 'services/api_client.dart';
import 'services/app_state.dart';
import 'theme/app_theme.dart';

final navigatorKey = GlobalKey<NavigatorState>();

/// Lỗi chưa xử lý gần nhất — hiện lên màn hình thay vì để màn hình trắng.
final startupError = ValueNotifier<String?>(null);

void main() {
  // Vẽ giao diện NGAY, việc đọc bộ nhớ máy làm sau (trong _Bootstrap), có giới hạn thời gian.
  // Trước đây main() chờ đọc bộ nhớ xong mới vẽ: nếu bước này lỗi/treo trên một số máy thì chỉ thấy màn hình trắng.
  runZonedGuarded(() {
    WidgetsFlutterBinding.ensureInitialized();
    FlutterError.onError = (details) {
      FlutterError.presentError(details);
      _report(details.exception, details.stack);
    };
    PlatformDispatcher.instance.onError = (error, stack) {
      _report(error, stack);
      return true;
    };
    // Widget nào lỗi khi vẽ thì hiện chữ báo lỗi (bản release mặc định chỉ là ô xám/trắng)
    ErrorWidget.builder = (details) => _ErrorBox(text: '${details.exception}');
    api.onUnauthorized = () {
      appState.clear();
      navigatorKey.currentState?.pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginScreen(expired: true)),
        (_) => false,
      );
    };
    runApp(const TuyenSinhApp());
  }, _report);
}

void _report(Object error, StackTrace? stack) {
  debugPrint('LỖI: $error\n$stack');
  startupError.value = '$error';
}

class TuyenSinhApp extends StatelessWidget {
  const TuyenSinhApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: AppConfig.appName,
      navigatorKey: navigatorKey,
      debugShowCheckedModeBanner: false,
      theme: appTheme,
      locale: const Locale('vi'),
      supportedLocales: const [Locale('vi'), Locale('en')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      home: const _Bootstrap(),
    );
  }
}

/// Màn hình khởi động: đọc phiên đăng nhập đã lưu rồi chuyển vào app.
class _Bootstrap extends StatefulWidget {
  const _Bootstrap();

  @override
  State<_Bootstrap> createState() => _BootstrapState();
}

class _BootstrapState extends State<_Bootstrap> {
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    try {
      await api.load().timeout(const Duration(seconds: 6));
    } catch (e, s) {
      _report(e, s);
    }
    if (mounted) setState(() => _ready = true);
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<String?>(
      valueListenable: startupError,
      builder: (context, err, _) {
        final body = !_ready
            ? const _Splash()
            : (api.isLoggedIn ? const AppShell() : const LoginScreen());
        if (err == null) return body;
        // Có lỗi: vẫn cho dùng app, hiện dải báo lỗi ở đáy để chụp màn hình gửi nhóm
        return Stack(children: [
          Positioned.fill(child: body),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Material(
              color: AppColors.danger,
              child: SafeArea(
                top: false,
                child: InkWell(
                  onTap: () => startupError.value = null,
                  child: Padding(
                    padding: const EdgeInsets.all(10),
                    child: Text('Lỗi (chạm để ẩn): $err',
                        maxLines: 4, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 12)),
                  ),
                ),
              ),
            ),
          ),
        ]);
      },
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash();

  @override
  Widget build(BuildContext context) => const Scaffold(
        backgroundColor: AppColors.navy900,
        body: Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.school_rounded, color: Colors.white, size: 64),
            SizedBox(height: 14),
            Text('Tuyển sinh Sau đại học', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700)),
            SizedBox(height: 18),
            SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white)),
          ]),
        ),
      );
}

class _ErrorBox extends StatelessWidget {
  final String text;
  const _ErrorBox({required this.text});

  @override
  Widget build(BuildContext context) => Container(
        color: AppColors.danger50,
        padding: const EdgeInsets.all(12),
        child: Text('Không hiển thị được phần này: $text',
            textDirection: TextDirection.ltr, style: const TextStyle(color: AppColors.danger, fontSize: 12)),
      );
}
