import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../theme/app_theme.dart';
import '../utils/cccd.dart';

/// Quét mã QR trên CCCD gắn chip bằng camera, trả về các trường đọc được.
class ScanCccdScreen extends StatefulWidget {
  const ScanCccdScreen({super.key});

  @override
  State<ScanCccdScreen> createState() => _ScanCccdScreenState();
}

class _ScanCccdScreenState extends State<ScanCccdScreen> {
  final _controller = MobileScannerController(
    formats: const [BarcodeFormat.qrCode],
    detectionSpeed: DetectionSpeed.normal,
  );
  bool _done = false;
  String _hint = 'Đưa mã QR ở góc trên bên phải mặt trước CCCD vào khung.';

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture cap) {
    if (_done) return;
    for (final b in cap.barcodes) {
      final raw = b.rawValue;
      if (raw == null) continue;
      final f = parseCccdQr(raw);
      if (f != null) {
        _done = true;
        Navigator.of(context).pop(f);
        return;
      }
      setState(() => _hint = 'Đây không phải mã QR của CCCD. Hãy quét mã ở mặt trước thẻ CCCD gắn chip.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: const Text('Quét QR trên CCCD'),
        actions: [
          IconButton(
            tooltip: 'Đèn flash',
            icon: const Icon(Icons.flash_on),
            onPressed: () => _controller.toggleTorch(),
          ),
        ],
      ),
      body: Stack(children: [
        MobileScanner(
          controller: _controller,
          onDetect: _onDetect,
          errorBuilder: (context, error) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                'Không mở được camera. Vào Cài đặt → Ứng dụng → Tuyển sinh SĐH → Quyền → bật Camera.\n(${error.errorCode.name})',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white),
              ),
            ),
          ),
        ),
        Center(
          child: Container(
            width: 250,
            height: 250,
            decoration: BoxDecoration(
              border: Border.all(color: AppColors.accent, width: 3),
              borderRadius: BorderRadius.circular(18),
            ),
          ),
        ),
        Positioned(
          left: 20,
          right: 20,
          bottom: 40,
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.65), borderRadius: BorderRadius.circular(12)),
            child: Text(
              '$_hint\nGiữ máy cách thẻ khoảng 10–15 cm, đủ sáng, không bị lóa.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white, fontSize: 13.5, height: 1.4),
            ),
          ),
        ),
      ]),
    );
  }
}
