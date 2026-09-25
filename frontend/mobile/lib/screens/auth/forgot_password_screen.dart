import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/api_service.dart';
import '../../widgets/app_button.dart';
import '../../widgets/app_text_field.dart';
import '../../widgets/otp_input.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});
  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  int _step = 1;
  final _emailOrPhoneCtrl = TextEditingController();
  final _newPasswordCtrl = TextEditingController();
  final _confirmPasswordCtrl = TextEditingController();
  String _otp = '';
  bool _loading = false;
  String _error = '';

  Future<void> _sendOtp() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      await apiService.requestPasswordResetOtp(_emailOrPhoneCtrl.text);
      setState(() => _step = 2);
    } catch (e) {
      setState(() => _error = 'Không gửi được mã xác thực.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _reset() async {
    setState(() => _error = '');
    if (_newPasswordCtrl.text != _confirmPasswordCtrl.text) {
      setState(() => _error = 'Mật khẩu xác nhận không khớp.');
      return;
    }
    setState(() => _loading = true);
    try {
      await apiService.resetPassword(_emailOrPhoneCtrl.text, _otp, _newPasswordCtrl.text);
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      setState(() => _error = 'Đặt lại mật khẩu thất bại.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_step == 1 ? 'Quên mật khẩu' : 'Đặt lại mật khẩu')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_error.isNotEmpty) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration:
                      BoxDecoration(color: AppColors.danger50, borderRadius: BorderRadius.circular(10)),
                  child: Text(_error, style: const TextStyle(color: AppColors.danger, fontSize: 13)),
                ),
                const SizedBox(height: 16),
              ],
              if (_step == 1) ...[
                const Text('Nhập email hoặc số điện thoại đã đăng ký để nhận mã xác thực.',
                    style: TextStyle(color: AppColors.gray500, fontSize: 14)),
                const SizedBox(height: 20),
                AppTextField(
                    label: 'Email hoặc số điện thoại',
                    required: true,
                    controller: _emailOrPhoneCtrl,
                    hint: 'email@example.com hoặc 09xxxxxxxx'),
                const SizedBox(height: 24),
                AppButton(label: 'Gửi mã xác thực', fullWidth: true, loading: _loading, onPressed: _sendOtp),
              ] else ...[
                Text('Nhập mã đã gửi tới ${_emailOrPhoneCtrl.text} và mật khẩu mới.',
                    style: const TextStyle(color: AppColors.gray500, fontSize: 14)),
                const SizedBox(height: 20),
                OtpInput(onChanged: (v) => setState(() => _otp = v)),
                const SizedBox(height: 20),
                AppTextField(
                    label: 'Mật khẩu mới', required: true, controller: _newPasswordCtrl, obscureText: true),
                const SizedBox(height: 16),
                AppTextField(
                    label: 'Xác nhận mật khẩu mới',
                    required: true,
                    controller: _confirmPasswordCtrl,
                    obscureText: true),
                const SizedBox(height: 24),
                AppButton(
                  label: 'Đặt lại mật khẩu',
                  fullWidth: true,
                  loading: _loading,
                  onPressed: _otp.length == 6 ? _reset : null,
                ),
                const SizedBox(height: 12),
                Center(
                  child: TextButton(
                    onPressed: () => setState(() => _step = 1),
                    child: const Text('← Quay lại', style: TextStyle(color: AppColors.gray500)),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
