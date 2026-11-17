import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../config.dart';
import '../../services/api_client.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_button.dart';
import '../../widgets/app_text_field.dart';
import '../../widgets/common.dart';
import 'verify_email_screen.dart';

/// Đăng ký tài khoản thí sinh (UC-TS-01): khai thông tin -> nhận mã 6 số qua email -> xác thực.
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _pw = TextEditingController();
  final _pw2 = TextEditingController();
  String _dob = '';
  bool _agree = false;
  bool _show = false;
  bool _loading = false;
  String _error = '';
  Map<String, String> _errs = {};

  @override
  void dispose() {
    for (final c in [_name, _email, _phone, _pw, _pw2]) {
      c.dispose();
    }
    super.dispose();
  }

  bool _validate() {
    final e = <String, String>{};
    // Cùng quy tắc với backend/src/common/validate.ts: chữ cái, dấu gạch nối / dấu nháy giữa các chữ, tối đa 100 ký tự
    final name = _name.text.trim().replaceAll(RegExp(r'\s+'), ' ').replaceAll(RegExp('[’ʼ`]'), "'");
    final nameRe = RegExp(r"^[\p{L}\p{M}]+(?:['-]?[\p{L}\p{M}]+)*(?: [\p{L}\p{M}]+(?:['-]?[\p{L}\p{M}]+)*)*$", unicode: true);
    if (name.length < 4 || name.length > 100 || !nameRe.hasMatch(name)) {
      e['name'] = 'Họ và tên chỉ gồm chữ cái (có thể có dấu gạch nối hoặc dấu nháy), ví dụ: Nguyễn Văn An.';
    }
    if (_dob.isEmpty) {
      e['dob'] = 'Chọn ngày sinh.';
    } else {
      // Tuổi tròn theo lịch: đúng ngày sinh nhật 18 tuổi là đủ tuổi
      final d = DateTime.parse(_dob);
      final now = DateTime.now();
      var age = now.year - d.year;
      if (now.month < d.month || (now.month == d.month && now.day < d.day)) age--;
      if (age < 18 || age > 80) e['dob'] = 'Thí sinh phải từ 18 tuổi trở lên.';
    }
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$').hasMatch(_email.text.trim())) e['email'] = 'Email không hợp lệ.';
    if (!RegExp(r'^0\d{9}$').hasMatch(_phone.text.replaceAll(RegExp(r'[\s.\-]'), ''))) {
      e['phone'] = 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.';
    }
    final pw = _pw.text;
    if (pw.length < 8 || !RegExp(r'[A-Za-z]').hasMatch(pw) || !RegExp(r'\d').hasMatch(pw)) {
      e['pw'] = 'Mật khẩu cần ít nhất 8 ký tự, gồm cả chữ và số.';
    }
    if (_pw2.text != pw) e['pw2'] = 'Mật khẩu nhập lại không khớp.';
    setState(() => _errs = e);
    if (e.isNotEmpty) return false;
    if (!_agree) {
      setState(() => _error = 'Bạn cần đồng ý với Chính sách bảo vệ dữ liệu cá nhân để tạo tài khoản.');
      return false;
    }
    return true;
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    setState(() => _error = '');
    if (!_validate()) return;
    setState(() => _loading = true);
    try {
      final email = _email.text.trim().toLowerCase();
      final sent = await apiService.register(
        fullName: _name.text.trim().replaceAll(RegExp(r'\s+'), ' '),
        dob: _dob,
        email: email,
        phoneNumber: _phone.text.replaceAll(RegExp(r'[\s.\-]'), ''),
        password: _pw.text,
      );
      if (!mounted) return;
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => VerifyEmailScreen(email: email, sent: sent)));
    } catch (e) {
      setState(() => _error = errText(e, 'Đăng ký thất bại, vui lòng thử lại.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    return Scaffold(
      appBar: AppBar(title: const Text('Tạo tài khoản thí sinh')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Text(
              'Khai đúng họ tên và ngày sinh như trên CCCD. Mã xác thực 6 số sẽ được gửi về email của bạn.',
              style: TextStyle(fontSize: 13.5, color: AppColors.gray500, height: 1.4),
            ),
            const SizedBox(height: 18),
            if (_error.isNotEmpty) Alert(_error),
            AppTextField(
              label: 'Họ và tên',
              required: true,
              controller: _name,
              hint: 'Nguyễn Văn An',
              errorText: _errs['name'],
              textCapitalization: TextCapitalization.words,
              autofillHints: const [AutofillHints.name],
            ),
            DateField(
              label: 'Ngày sinh',
              required: true,
              value: _dob,
              errorText: _errs['dob'],
              initialDate: DateTime(now.year - 24, 1, 1),
              lastDate: DateTime(now.year - 18, now.month, now.day),
              onChanged: (v) => setState(() => _dob = v),
            ),
            AppTextField(
              label: 'Email',
              required: true,
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              hint: 'tenban@gmail.com',
              errorText: _errs['email'],
              autofillHints: const [AutofillHints.email],
            ),
            AppTextField(
              label: 'Số điện thoại',
              required: true,
              controller: _phone,
              keyboardType: TextInputType.phone,
              hint: '0912345678',
              errorText: _errs['phone'],
              maxLength: 12,
              inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9 .\-]'))],
            ),
            AppTextField(
              label: 'Mật khẩu',
              required: true,
              controller: _pw,
              obscureText: !_show,
              helper: 'Ít nhất 8 ký tự, gồm cả chữ và số.',
              errorText: _errs['pw'],
              suffixIcon: IconButton(
                icon: Icon(_show ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                onPressed: () => setState(() => _show = !_show),
              ),
            ),
            AppTextField(
              label: 'Nhập lại mật khẩu',
              required: true,
              controller: _pw2,
              obscureText: !_show,
              errorText: _errs['pw2'],
            ),
            CheckboxListTile(
              value: _agree,
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              onChanged: (v) => setState(() => _agree = v == true),
              title: const Text(
                'Tôi đồng ý với Chính sách bảo vệ dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP) của cổng tuyển sinh.',
                style: TextStyle(fontSize: 13),
              ),
            ),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: () => launchUrl(Uri.parse('${AppConfig.webBase}/privacy'), mode: LaunchMode.externalApplication),
                child: const Text('Đọc chính sách'),
              ),
            ),
            const SizedBox(height: 8),
            AppButton(label: 'Đăng ký & nhận mã xác thực', fullWidth: true, loading: _loading, onPressed: _submit),
          ]),
        ),
      ),
    );
  }
}
