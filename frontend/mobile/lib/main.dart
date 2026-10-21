import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'config.dart';
import 'screens/auth/login_screen.dart';
import 'screens/shell/app_shell.dart';
import 'services/api_client.dart';
import 'services/app_state.dart';
import 'theme/app_theme.dart';

final navigatorKey = GlobalKey<NavigatorState>();

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await api.load();
  // Phiên đăng nhập hết hạn ở bất kỳ màn hình nào -> về trang đăng nhập
  api.onUnauthorized = () {
    appState.clear();
    navigatorKey.currentState?.pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen(expired: true)),
      (_) => false,
    );
  };
  runApp(const TuyenSinhApp());
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
      home: api.isLoggedIn ? const AppShell() : const LoginScreen(),
    );
  }
}
