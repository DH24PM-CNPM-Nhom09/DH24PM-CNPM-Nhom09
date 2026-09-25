import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:tuyensinh_mobile/main.dart';

void main() {
  testWidgets('App khởi động và hiển thị màn hình đăng nhập',
      (WidgetTester tester) async {
    await tester.pumpWidget(const TuyenSinhApp());
    await tester.pump();

    expect(find.byType(MaterialApp), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
