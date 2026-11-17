import 'dart:async';

import 'package:flutter/material.dart';

import '../../services/api_client.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_button.dart';
import '../../widgets/app_text_field.dart';
import '../../widgets/common.dart';
import '../../widgets/otp_input.dart';

/// Quên mật khẩu: nhận mã qua email đã đăng ký -> đặt mật khẩu mới.
class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _id = TextEditingController();
  final _otp = TextEditingController();
  final _pw = TextEditingController();
  final _pw2 = TextEditingController();
  bool _codeSent = false;
  bool _loading = false;
  bool _show = false;
  String _error = '';
  String _info = '';
  int _wait = 0;
  Timer? _timer;

  @override
  void dispose() {
    _timer?.cancel();
    for (final c in [_id, _otp, _pw, _pw2]) {
      c.dispose();
    }
    super.dispose();
  }

  void _startWait(int s) {
    _timer?.cancel();
    setState(() => _wait = s);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      setState(() => _wait = _wait > 0 ? _wait - 1 : 0);
      if (_wait == 0) t.cancel();
    });
  }

  Future<void> _send() async {
    if (_id.text.trim().isEmpty) {
      setState(() => _error = 'Nhập email hoặc số điện thoại đã đăng ký.');
      return;
    }
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final s = await apiService.requestPasswordReset(_id.text);
      _startWait(s.resendAfterSeconds);
      setState(() {
        _codeSent = true;
        _info = s.devOtp != null
            ? 'Máy chủ đang chạy thử chưa gửi email. Mã xác thực: ${s.devOtp}'
            : 'Nếu thông tin khớp một tài khoản, mã 6 số đã được gửi tới email đăng ký. '
                'Không thấy email thì kiểm tra mục Thư rác (Spam).';
      });
    } catch (e) {
      setState(() => _error = errText(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _reset() async {
    final pw = _pw.text;
    if (_otp.text.length != 6) return setState(() => _error = 'Nhập đủ mã 6 số.');
    if (pw.length < 8 || !RegExp(r'[A-Za-z]').hasMatch(pw) || !RegExp(r'\d').hasMatch(pw)) {
      return setState(() => _error = 'Mật khẩu mới cần ít nhất 8 ký tự, gồm cả chữ và số.');
    }
    if (_pw2.text != pw) return setState(() => _error = 'Mật khẩu nhập lại không khớp.');
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      await apiService.resetPassword(_id.text, _otp.text, pw);
      if (!mounted) return;
      Navigator.of(context).pop();
      showSnack(context, 'Đã đặt mật khẩu mới. Bạn đăng nhập lại nhé.');
    } catch (e) {
      setState(() => _error = errText(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Quên mật khẩu')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(
              _codeSent ? _info : 'Nhập email hoặc số điện thoại đã đăng ký, hệ thống gửi mã xác thực về email của bạn.',
              style: const TextStyle(fontSize: 13.5, color: AppColors.gray600, height: 1.45),
            ),
            const SizedBox(height: 18),
            if (_error.isNotEmpty) Alert(_error),
            AppTextField(
              label: 'Email hoặc số điện thoại',
              controller: _id,
              enabled: !_codeSent,
              keyboardType: TextInputType.emailAddress,
            ),
            if (!_codeSent)
              AppButton(label: 'Gửi mã xác thực', fullWidth: true, loading: _loading, onPressed: _send)
            else ...[
              const FieldLabel('Mã xác thực', required: true),
              OtpInput(controller: _otp),
              const SizedBox(height: 14),
              AppTextField(
                label: 'Mật khẩu mới',
                required: true,
                controller: _pw,
                obscureText: !_show,
                helper: 'Ít nhất 8 ký tự, gồm cả chữ và số.',
                suffixIcon: IconButton(
                  icon: Icon(_show ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                  onPressed: () => setState(() => _show = !_show),
                ),
              ),
              AppTextField(label: 'Nhập lại mật khẩu mới', required: true, controller: _pw2, obscureText: !_show),
              AppButton(label: 'Đặt mật khẩu mới', fullWidth: true, loading: _loading, onPressed: _reset),
              const SizedBox(height: 8),
              Center(
                child: TextButton(
                  onPressed: _wait > 0 ? null : _send,
                  child: Text(_wait > 0 ? 'Gửi lại mã sau $_wait giây' : 'Gửi lại mã'),
                ),
              ),
            ],
          ]),
        ),
      ),
    );
  }
}
