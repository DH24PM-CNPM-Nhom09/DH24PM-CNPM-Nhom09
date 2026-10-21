import 'package:flutter/material.dart';

import '../../config.dart';
import '../../services/api_client.dart';
import '../../services/api_service.dart';
import '../../services/app_state.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_button.dart';
import '../../widgets/app_text_field.dart';
import '../../widgets/common.dart';
import '../announcements_screen.dart';
import '../shell/app_shell.dart';
import 'forgot_password_screen.dart';
import 'register_screen.dart';
import 'verify_email_screen.dart';

class LoginScreen extends StatefulWidget {
  final bool expired;
  const LoginScreen({super.key, this.expired = false});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _id = TextEditingController();
  final _pw = TextEditingController();
  bool _show = false;
  bool _loading = false;
  String _error = '';

  @override
  void initState() {
    super.initState();
    if (widget.expired) _error = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  }

  @override
  void dispose() {
    _id.dispose();
    _pw.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    FocusScope.of(context).unfocus();
    if (_id.text.trim().isEmpty || _pw.text.isEmpty) {
      setState(() => _error = 'Nhập email (hoặc số điện thoại) và mật khẩu.');
      return;
    }
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      await apiService.login(_id.text, _pw.text);
      appState.clear();
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const AppShell()), (_) => false);
    } on ApiException catch (e) {
      if (e.code == 'ACCOUNT_NOT_VERIFIED' && (e.detail ?? '').contains('@')) {
        if (!mounted) return;
        setState(() => _error = e.message);
        Navigator.of(context).push(MaterialPageRoute(builder: (_) => VerifyEmailScreen(email: e.detail!)));
      } else {
        setState(() => _error = e.message);
      }
    } catch (e) {
      setState(() => _error = errText(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Bấm giữ logo: đổi địa chỉ máy chủ (chạy thử với backend trên máy tính)
  Future<void> _serverDialog() async {
    final c = TextEditingController(text: api.apiBase);
    final r = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Địa chỉ máy chủ API'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: c, keyboardType: TextInputType.url, decoration: const InputDecoration(hintText: 'https://…/api/v1')),
          const SizedBox(height: 8),
          const Text('Mặc định: ${AppConfig.defaultApiBase}', style: TextStyle(fontSize: 12, color: AppColors.gray500)),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, ''), child: const Text('Dùng mặc định')),
          FilledButton(onPressed: () => Navigator.pop(ctx, c.text), child: const Text('Lưu')),
        ],
      ),
    );
    if (r == null) return;
    await api.setApiBase(r);
    if (mounted) showSnack(context, 'Đang dùng máy chủ: ${api.apiBase}');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 22),
          child: AutofillGroup(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              const SizedBox(height: 24),
              GestureDetector(onLongPress: _serverDialog, child: const BrandHeader()),
              const SizedBox(height: 28),
              const Text('Đăng nhập',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.gray900)),
              const SizedBox(height: 6),
              const Text('Dùng tài khoản đã đăng ký trên cổng tuyển sinh (web và app dùng chung tài khoản).',
                  style: TextStyle(fontSize: 13.5, color: AppColors.gray500, height: 1.4)),
              const SizedBox(height: 22),
              if (_error.isNotEmpty) Alert(_error),
              AppTextField(
                label: 'Email hoặc số điện thoại',
                controller: _id,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.email, AutofillHints.username],
                prefixIcon: const Icon(Icons.person_outline, color: AppColors.gray400),
              ),
              AppTextField(
                label: 'Mật khẩu',
                controller: _pw,
                obscureText: !_show,
                textInputAction: TextInputAction.done,
                autofillHints: const [AutofillHints.password],
                prefixIcon: const Icon(Icons.lock_outline, color: AppColors.gray400),
                suffixIcon: IconButton(
                  icon: Icon(_show ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: AppColors.gray500),
                  onPressed: () => setState(() => _show = !_show),
                ),
              ),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () =>
                      Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ForgotPasswordScreen())),
                  child: const Text('Quên mật khẩu?', style: TextStyle(fontWeight: FontWeight.w600)),
                ),
              ),
              const SizedBox(height: 6),
              AppButton(label: 'Đăng nhập', fullWidth: true, loading: _loading, onPressed: _login),
              const SizedBox(height: 14),
              AppButton(
                label: 'Tạo tài khoản thí sinh',
                variant: AppButtonVariant.outline,
                fullWidth: true,
                onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const RegisterScreen())),
              ),
              const SizedBox(height: 18),
              Center(
                child: TextButton.icon(
                  onPressed: () => Navigator.of(context)
                      .push(MaterialPageRoute(builder: (_) => const AnnouncementsScreen(standalone: true))),
                  icon: const Icon(Icons.campaign_outlined, size: 18),
                  label: const Text('Xem thông báo & điều kiện tuyển sinh'),
                ),
              ),
              const SizedBox(height: 24),
            ]),
          ),
        ),
      ),
    );
  }
}

/// Khối nhận diện ở đầu các màn hình đăng nhập/đăng ký
class BrandHeader extends StatelessWidget {
  const BrandHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.navy900, AppColors.navy700],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(children: [
        Container(
          width: 52,
          height: 52,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: AppColors.accent, borderRadius: BorderRadius.circular(14)),
          child: const Icon(Icons.school_rounded, color: Colors.white, size: 30),
        ),
        const SizedBox(width: 16),
        const Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Cổng tuyển sinh\nSau đại học',
                style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800, height: 1.2)),
            SizedBox(height: 6),
            Text('${AppConfig.schoolName} · Thạc sĩ & Tiến sĩ',
                style: TextStyle(color: Colors.white70, fontSize: 12.5)),
          ]),
        ),
      ]),
    );
  }
}
