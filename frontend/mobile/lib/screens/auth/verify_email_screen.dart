import 'dart:async';

import 'package:flutter/material.dart';

import '../../models/models.dart';
import '../../services/api_client.dart';
import '../../services/api_service.dart';
import '../../services/app_state.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_button.dart';
import '../../widgets/common.dart';
import '../../widgets/otp_input.dart';
import '../shell/app_shell.dart';

/// Nhập mã 6 số gửi về email để kích hoạt tài khoản.
class VerifyEmailScreen extends StatefulWidget {
  final String email;
  final OtpSent? sent;
  const VerifyEmailScreen({super.key, required this.email, this.sent});

  @override
  State<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends State<VerifyEmailScreen> {
  final _otp = TextEditingController();
  bool _loading = false;
  bool _resending = false;
  String _error = '';
  String _info = '';
  int _wait = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    final s = widget.sent;
    if (s != null) {
      _startWait(s.resendAfterSeconds);
      _info = _sentText(s);
    } else {
      _info = 'Nhập mã 6 số đã gửi tới ${widget.email}. Nếu mã đã hết hạn, bấm "Gửi lại mã".';
    }
  }

  String _sentText(OtpSent s) {
    if (s.devOtp != null) return 'Máy chủ đang chạy thử chưa gửi email. Mã xác thực: ${s.devOtp}';
    return 'Đã gửi mã 6 số tới ${widget.email}. Mã có hiệu lực ${s.expiresInMinutes} phút. '
        'Không thấy email thì kiểm tra cả mục Thư rác (Spam).';
  }

  void _startWait(int seconds) {
    _timer?.cancel();
    setState(() => _wait = seconds);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      setState(() => _wait = _wait > 0 ? _wait - 1 : 0);
      if (_wait == 0) t.cancel();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _otp.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    if (_otp.text.length != 6) {
      setState(() => _error = 'Nhập đủ 6 chữ số.');
      return;
    }
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      await apiService.verifyRegistration(widget.email, _otp.text);
      appState.clear();
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const AppShell()), (_) => false);
      showSnack(context, 'Tài khoản đã được kích hoạt. Chào mừng bạn!');
    } on ApiException catch (e) {
      setState(() => _error = e.message);
      if (e.code == 'ALREADY_VERIFIED' && mounted) Navigator.of(context).pop();
    } catch (e) {
      setState(() => _error = errText(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _resend() async {
    setState(() {
      _resending = true;
      _error = '';
    });
    try {
      final s = await apiService.resendRegistrationOtp(widget.email);
      _startWait(s.resendAfterSeconds);
      setState(() => _info = _sentText(s));
    } catch (e) {
      setState(() => _error = errText(e));
    } finally {
      if (mounted) setState(() => _resending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Xác thực email')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(22, 16, 22, 28),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Icon(Icons.mark_email_read_outlined, size: 56, color: AppColors.accent),
            const SizedBox(height: 14),
            Text(_info,
                textAlign: TextAlign.center, style: const TextStyle(fontSize: 14, color: AppColors.gray600, height: 1.45)),
            const SizedBox(height: 22),
            if (_error.isNotEmpty) Alert(_error),
            OtpInput(controller: _otp, onCompleted: (_) => _verify()),
            const SizedBox(height: 20),
            AppButton(label: 'Xác nhận', fullWidth: true, loading: _loading, onPressed: _verify),
            const SizedBox(height: 10),
            Center(
              child: TextButton(
                onPressed: (_wait > 0 || _resending) ? null : _resend,
                child: Text(_wait > 0 ? 'Gửi lại mã sau $_wait giây' : (_resending ? 'Đang gửi…' : 'Gửi lại mã')),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}
