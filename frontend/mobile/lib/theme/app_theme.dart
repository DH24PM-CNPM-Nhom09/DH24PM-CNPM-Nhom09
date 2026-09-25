import 'package:flutter/material.dart';

// Toàn bộ màu sắc lấy đúng theo Design System trong tài liệu
// "Thiết kế giao diện người dùng" và bản web Next.js, để 2 nền tảng đồng bộ.
class AppColors {
  static const navy900 = Color(0xFF142B4D);
  static const navy800 = Color(0xFF1B3A66);
  static const navy700 = Color(0xFF20477A);
  static const navy50 = Color(0xFFEEF2F8);

  static const accent = Color(0xFFE8734A);
  static const accentDark = Color(0xFFC85A33);
  static const accent50 = Color(0xFFFDEEE7);

  static const success = Color(0xFF16A34A);
  static const success50 = Color(0xFFEAF7EE);
  static const warning = Color(0xFFD97706);
  static const warning50 = Color(0xFFFEF3E2);
  static const danger = Color(0xFFDC2626);
  static const danger50 = Color(0xFFFDECEC);
  static const info = Color(0xFF2563EB);
  static const info50 = Color(0xFFEAF1FE);

  static const gray25 = Color(0xFFFCFCFD);
  static const gray50 = Color(0xFFF7F8FA);
  static const gray100 = Color(0xFFF1F3F6);
  static const gray200 = Color(0xFFE3E7ED);
  static const gray300 = Color(0xFFCBD2DC);
  static const gray400 = Color(0xFF9AA4B2);
  static const gray500 = Color(0xFF69738A);
  static const gray600 = Color(0xFF4B5468);
  static const gray700 = Color(0xFF333B4D);
  static const gray900 = Color(0xFF12151C);
}

final appTheme = ThemeData(
  useMaterial3: true,
  scaffoldBackgroundColor: AppColors.gray50,
  colorScheme: ColorScheme.fromSeed(
    seedColor: AppColors.accent,
    primary: AppColors.accent,
  ),
  fontFamily: 'Roboto',
  appBarTheme: const AppBarTheme(
    backgroundColor: Colors.white,
    foregroundColor: AppColors.gray900,
    elevation: 0,
    surfaceTintColor: Colors.transparent,
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: Colors.white,
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: const BorderSide(color: AppColors.gray300),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: const BorderSide(color: AppColors.gray300),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: const BorderSide(color: AppColors.accent, width: 1.5),
    ),
    errorBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: const BorderSide(color: AppColors.danger),
    ),
  ),
);
