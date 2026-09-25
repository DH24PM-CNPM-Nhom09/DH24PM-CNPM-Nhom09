import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/api_service.dart';
import '../../widgets/app_button.dart';
import 'register_screen.dart';
import 'forgot_password_screen.dart';
import '../shell/app_shell.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool _loading = false;
  String _error = '';

  Future<void> _handleGoogleLogin() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      // TODO (tích hợp thật): thay bằng Google Sign-In SDK để lấy id_token thật.
      await apiService.loginWithGoogle('mock-google-id-token');
      if (mounted) {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const AppShell()),
          (route) => false,
        );
      }
    } catch (e) {
      setState(() => _error = 'Đăng nhập thất bại, vui lòng thử lại.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 32),
              // Header thương hiệu
              Container(
                padding: const EdgeInsets.all(28),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.navy900, AppColors.navy700],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                          color: AppColors.accent, borderRadius: BorderRadius.circular(12)),
                      child: const Text('TS',
                          style: TextStyle(
                              color: Colors.white, fontWeight: FontWeight.w800, fontSize: 18)),
                    ),
                    const SizedBox(height: 16),
                    const Text('Cổng thông tin\ndành cho Thí sinh',
                        style: TextStyle(
                            color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800, height: 1.25)),
                    const SizedBox(height: 8),
                    const Text('Trường Đại học An Giang',
                        style: TextStyle(color: Colors.white70, fontSize: 13)),
                  ],
                ),
              ),
              const SizedBox(height: 32),
              const Text('Đăng nhập',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.gray900)),
              const SizedBox(height: 6),
              const Text('Đăng nhập để nộp và theo dõi hồ sơ xét tuyển sau đại học.',
                  style: TextStyle(fontSize: 14, color: AppColors.gray500)),
              const SizedBox(height: 24),
              if (_error.isNotEmpty) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                      color: AppColors.danger50, borderRadius: BorderRadius.circular(10)),
                  child: Text(_error, style: const TextStyle(color: AppColors.danger, fontSize: 13)),
                ),
                const SizedBox(height: 16),
              ],
              AppButton(
                label: 'Đăng nhập với Google',
                variant: AppButtonVariant.outline,
                fullWidth: true,
                loading: _loading,
                onPressed: _handleGoogleLogin,
                icon: Icons.login,
              ),
              const SizedBox(height: 20),
              Center(
                child: TextButton(
                  onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const ForgotPasswordScreen())),
                  child: const Text('Quên tài khoản Google đã đăng ký?',
                      style: TextStyle(color: AppColors.accent, fontWeight: FontWeight.w600)),
                ),
              ),
              const SizedBox(height: 12),
              Center(
                child: TextButton(
                  onPressed: () => Navigator.of(context)
                      .push(MaterialPageRoute(builder: (_) => const RegisterScreen())),
                  child: const Text('Chưa có tài khoản? Đăng ký ngay',
                      style: TextStyle(color: AppColors.accent, fontWeight: FontWeight.w600)),
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
