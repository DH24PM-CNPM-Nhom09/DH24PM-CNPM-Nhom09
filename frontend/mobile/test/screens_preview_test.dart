// Chụp ảnh các màn hình với dữ liệu THẬT từ backend để kiểm tra giao diện (không chạy trong CI).
//   PREVIEW_API=http://localhost:4000/api/v1 PREVIEW_OUT=/tmp/shots flutter test test/screens_preview_test.dart --update-goldens
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tuyensinh_mobile/main.dart';
import 'package:tuyensinh_mobile/screens/announcements_screen.dart';
import 'package:tuyensinh_mobile/screens/shell/app_shell.dart';
import 'package:tuyensinh_mobile/screens/wizard/application_wizard_screen.dart';
import 'package:tuyensinh_mobile/services/api_client.dart';
import 'package:tuyensinh_mobile/services/api_service.dart';
import 'package:tuyensinh_mobile/services/app_state.dart';
import 'package:tuyensinh_mobile/theme/app_theme.dart';

Future<void> _loadFonts() async {
  final sdk = Platform.environment['FLUTTER_ROOT'] ?? '/opt/flutter-sdk/flutter';
  final dir = '$sdk/bin/cache/artifacts/material_fonts';
  final roboto = FontLoader('Roboto');
  for (final f in ['Roboto-Regular.ttf', 'Roboto-Medium.ttf', 'Roboto-Bold.ttf', 'Roboto-Italic.ttf']) {
    roboto.addFont(Future.value(ByteData.view(File('$dir/$f').readAsBytesSync().buffer)));
  }
  await roboto.load();
  final icons = FontLoader('MaterialIcons')
    ..addFont(Future.value(ByteData.view(File('$dir/MaterialIcons-Regular.otf').readAsBytesSync().buffer)));
  await icons.load();
}

void main() {
  final base = Platform.environment['PREVIEW_API'];
  if (base == null) {
    test('bỏ qua (chưa đặt PREVIEW_API)', () {});
    return;
  }

  Future<void> wait(WidgetTester t, [int ms = 1500]) async {
    await t.runAsync(() => Future.delayed(Duration(milliseconds: ms)));
    await t.pump(const Duration(milliseconds: 400));
    await t.runAsync(() => Future.delayed(const Duration(milliseconds: 300)));
    await t.pump(const Duration(milliseconds: 400));
  }

  Future<void> shot(WidgetTester t, String name) async {
    await expectLater(find.byType(MaterialApp), matchesGoldenFile('shots/$name.png'));
  }

  Future<void> setup(WidgetTester t, {String? email}) async {
    HttpOverrides.global = null; // cho phép gọi mạng thật trong test
    t.view.physicalSize = const Size(1080, 2280);
    t.view.devicePixelRatio = 2.625;
    await t.runAsync(() async {
      await _loadFonts();
      SharedPreferences.setMockInitialValues({});
      await api.load();
      await api.setApiBase(base);
      appState.clear();
      if (email != null) {
        await apiService.login(email, Platform.environment['PREVIEW_PASSWORD'] ?? 'Demo@123');
        await appState.refresh();
      }
    });
  }

  testWidgets('01 đăng nhập', (t) async {
    await setup(t);
    await t.pumpWidget(const TuyenSinhApp());
    await wait(t, 200);
    await shot(t, '01_dang_nhap');
  });

  testWidgets('02-06 thí sinh trúng tuyển', (t) async {
    await setup(t, email: Platform.environment['ADMITTED_EMAIL'] ?? 'nhanle21@gmail.com');
    await t.pumpWidget(const TuyenSinhApp());
    await wait(t);
    await shot(t, '02_tong_quan');
    final shell = t.state(find.byType(AppShell)) as dynamic;
    shell.setTab(1);
    await wait(t, 300);
    await shot(t, '03_ho_so_dau');
    await t.drag(find.byType(ListView).first, const Offset(0, -1400));
    await wait(t, 300);
    await shot(t, '04_ho_so_ket_qua');
    await t.drag(find.byType(ListView).first, const Offset(0, -1400));
    await wait(t, 300);
    await shot(t, '05_ho_so_minh_chung');
    shell.setTab(2);
    await wait(t, 300);
    await shot(t, '06_thong_bao');
    shell.setTab(4);
    await wait(t, 300);
    await shot(t, '07_ca_nhan');
  });

  testWidgets('08 thí sinh cần bổ sung + lệ phí', (t) async {
    await setup(t, email: Platform.environment['SUPPLEMENT_EMAIL'] ?? 'phucpham86@gmail.com');
    await t.pumpWidget(const TuyenSinhApp());
    await wait(t);
    (t.state(find.byType(AppShell)) as dynamic).setTab(1);
    await wait(t, 300);
    await shot(t, '08_bo_sung');
  });

  testWidgets('09-10 tuyển sinh', (t) async {
    await setup(t);
    await t.runAsync(() async {
      await t.pumpWidget(_app(const AnnouncementsScreen(standalone: true)));
      await Future.delayed(const Duration(seconds: 2));
    });
    await t.pump(const Duration(milliseconds: 500));
    await shot(t, '09_thong_bao_tuyen_sinh');
  });

  testWidgets('10 đợt đang mở + chi tiết', (t) async {
    await setup(t);
    await t.runAsync(() async {
      await t.pumpWidget(_app(const OpenBatchesScreen()));
      await Future.delayed(const Duration(seconds: 2));
    });
    await t.pump(const Duration(milliseconds: 500));
    await shot(t, '10_dot_dang_mo');
    await t.tap(find.textContaining('Tuyển sinh thạc sĩ').first);
    await t.pump(const Duration(milliseconds: 600));
    await t.pump(const Duration(milliseconds: 600));
    await shot(t, '10b_chi_tiet_dot');
  });

  testWidgets('11-13 tạo hồ sơ (thí sinh mới)', (t) async {
    final email = Platform.environment['NEW_EMAIL'];
    if (email == null) return;
    await setup(t, email: email);
    await t.runAsync(() async {
      await t.pumpWidget(_app(const ApplicationWizardScreen()));
      await Future.delayed(const Duration(seconds: 2));
    });
    await t.pump(const Duration(milliseconds: 500));
    await shot(t, '11_tao_ho_so_buoc1');
  });
}

Widget _app(Widget home) => MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: appTheme,
      locale: const Locale('vi'),
      supportedLocales: const [Locale('vi'), Locale('en')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      home: home,
    );
