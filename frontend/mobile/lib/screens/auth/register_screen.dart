import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/api_service.dart';
import '../../widgets/app_button.dart';
import '../../widgets/app_text_field.dart';
import '../../widgets/otp_input.dart';
import '../shell/app_shell.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});
  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  int _step = 1;
  final _fullNameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  String _otp = '';
  bool _loading = false;

  Future<void> _verify() async {
    setState(() => _loading = true);
    try {
      await apiService.loginWithGoogle('mock-google-id-token');
      if (mounted) {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const AppShell()),
          (route) => false,
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_step == 1 ? 'Đăng ký tài khoản' : 'Xác thực email')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: _step == 1
              ? Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text('Tạo tài khoản để bắt đầu nộp hồ sơ xét tuyển sau đại học.',
                        style: TextStyle(color: AppColors.gray500, fontSize: 14)),
                    const SizedBox(height: 20),
                    AppTextField(label: 'Họ và tên', required: true, controller: _fullNameCtrl, hint: 'Nguyễn Văn A'),
                    const SizedBox(height: 16),
                    AppTextField(
                        label: 'Email',
                        required: true,
                        controller: _emailCtrl,
                        hint: 'email@example.com',
                        keyboardType: TextInputType.emailAddress),
                    const SizedBox(height: 16),
                    AppTextField(
                        label: 'Số điện thoại',
                        required: true,
                        controller: _phoneCtrl,
                        hint: '09xxxxxxxx',
                        keyboardType: TextInputType.phone),
                    const SizedBox(height: 24),
                    AppButton(
                      label: 'Tiếp tục',
                      fullWidth: true,
                      onPressed: () => setState(() => _step = 2),
                    ),
                  ],
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text('Nhập mã 6 số vừa được gửi tới ${_emailCtrl.text.isEmpty ? "email của bạn" : _emailCtrl.text}.',
                        style: const TextStyle(color: AppColors.gray500, fontSize: 14)),
                    const SizedBox(height: 24),
                    OtpInput(onChanged: (v) => setState(() => _otp = v)),
                    const SizedBox(height: 24),
                    AppButton(
                      label: 'Xác nhận',
                      fullWidth: true,
                      loading: _loading,
                      onPressed: _otp.length == 6 ? _verify : null,
                    ),
                    const SizedBox(height: 12),
                    Center(
                      child: TextButton(
                        onPressed: () => setState(() => _step = 1),
                        child: const Text('← Quay lại', style: TextStyle(color: AppColors.gray500)),
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}
