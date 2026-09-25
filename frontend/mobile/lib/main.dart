import 'package:flutter/material.dart';
import 'theme/app_theme.dart';
import 'screens/auth/login_screen.dart';

void main() {
  runApp(const TuyenSinhApp());
}

class TuyenSinhApp extends StatelessWidget {
  const TuyenSinhApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Cổng Tuyển Sinh Sau Đại Học',
      debugShowCheckedModeBanner: false,
      theme: appTheme,
      home: const LoginScreen(),
    );
  }
}
