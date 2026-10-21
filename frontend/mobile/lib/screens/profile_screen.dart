import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config.dart';
import '../models/models.dart';
import '../services/api_client.dart';
import '../services/api_service.dart';
import '../services/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../utils/labels.dart';
import '../widgets/app_button.dart';
import '../widgets/app_card.dart';
import '../widgets/app_text_field.dart';
import '../widgets/common.dart';
import 'auth/login_screen.dart';
import 'complaint_screen.dart';
import 'gvhd_screen.dart';

/// Tab "Cá nhân": thông tin tài khoản, sửa thông tin cơ bản, GVHD, khiếu nại, đăng xuất.
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  Future<void> _logout(BuildContext context) async {
    final ok = await confirmDialog(context, title: 'Đăng xuất?', message: 'Bạn sẽ cần đăng nhập lại để xem hồ sơ.', ok: 'Đăng xuất');
    if (!ok) return;
    await apiService.logout();
    appState.clear();
    if (!context.mounted) return;
    Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const LoginScreen()), (_) => false);
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: appState,
      builder: (context, _) {
        final p = appState.profile;
        if (p == null) {
          return appState.error != null
              ? ErrorView(message: errText(appState.error!), onRetry: appState.refresh)
              : const LoadingView();
        }
        final a = appState.activeApplication;
        return RefreshIndicator(
          onRefresh: appState.refresh,
          child: ListView(padding: const EdgeInsets.all(16), children: [
            AppCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  CircleAvatar(
                    radius: 26,
                    backgroundColor: AppColors.navy50,
                    child: Text(
                      p.fullName.trim().isEmpty ? '?' : p.fullName.trim().split(' ').last[0].toUpperCase(),
                      style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.navy800),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(p.fullName, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                      Text(p.email ?? '', style: const TextStyle(color: AppColors.gray500, fontSize: 13)),
                    ]),
                  ),
                ]),
                const Divider(height: 26),
                KV('Ngày sinh', fmtDate(p.dob)),
                KV('Giới tính', genderLabel[p.gender]),
                KV('Số CCCD', p.idNumber),
                KV('Điện thoại', p.phoneNumber),
                KV('Nơi sinh', p.birthplace),
                KV('Dân tộc', p.ethnicity),
                KV('Thường trú', p.permanentAddress),
                KV('Địa chỉ liên hệ', p.address),
                KV('Tạo tài khoản', fmtDate(p.accountCreatedAt)),
                const SizedBox(height: 10),
                AppButton(
                  label: 'Sửa thông tin',
                  icon: Icons.edit_outlined,
                  variant: AppButtonVariant.outline,
                  fullWidth: true,
                  onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => EditProfileScreen(profile: p))),
                ),
              ]),
            ),
            const SizedBox(height: 14),
            AppCard(
              padding: EdgeInsets.zero,
              child: Column(children: [
                if (a != null && a.isDoctoral)
                  _MenuTile(
                    icon: Icons.school_outlined,
                    title: 'Giảng viên hướng dẫn',
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const GvhdScreen())),
                  ),
                _MenuTile(
                  icon: Icons.support_agent_outlined,
                  title: 'Khiếu nại / phúc khảo',
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ComplaintScreen())),
                ),
                _MenuTile(
                  icon: Icons.language,
                  title: 'Mở cổng tuyển sinh trên web',
                  onTap: () => launchUrl(Uri.parse(AppConfig.webBase), mode: LaunchMode.externalApplication),
                ),
                _MenuTile(
                  icon: Icons.privacy_tip_outlined,
                  title: 'Chính sách bảo vệ dữ liệu cá nhân',
                  onTap: () => launchUrl(Uri.parse('${AppConfig.webBase}/privacy'), mode: LaunchMode.externalApplication),
                ),
                _MenuTile(icon: Icons.logout, title: 'Đăng xuất', danger: true, onTap: () => _logout(context)),
              ]),
            ),
            const SizedBox(height: 18),
            Center(
              child: Text('Máy chủ: ${api.apiBase}', style: const TextStyle(fontSize: 11, color: AppColors.gray400)),
            ),
          ]),
        );
      },
    );
  }
}

class _MenuTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final VoidCallback onTap;
  final bool danger;
  const _MenuTile({required this.icon, required this.title, required this.onTap, this.danger = false});

  @override
  Widget build(BuildContext context) => ListTile(
        leading: Icon(icon, color: danger ? AppColors.danger : AppColors.navy800),
        title: Text(title, style: TextStyle(fontWeight: FontWeight.w600, color: danger ? AppColors.danger : AppColors.gray900)),
        trailing: danger ? null : const Icon(Icons.chevron_right, color: AppColors.gray400),
        onTap: onTap,
      );
}

/// Sửa thông tin cơ bản (họ tên, ngày sinh, giới tính, điện thoại, địa chỉ liên hệ).
/// Các mục theo CCCD (số CCCD, ngày cấp, nơi cấp…) khai ở bước Minh chứng khi làm hồ sơ.
class EditProfileScreen extends StatefulWidget {
  final Candidate profile;
  const EditProfileScreen({super.key, required this.profile});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  late final _name = TextEditingController(text: widget.profile.fullName);
  late final _phone = TextEditingController(text: widget.profile.phoneNumber ?? '');
  late final _address = TextEditingController(text: widget.profile.address ?? '');
  late String _dob = widget.profile.dob;
  late String? _gender = widget.profile.gender;
  bool _busy = false;
  String _error = '';

  bool get _locked {
    final a = appState.activeApplication;
    return a != null && !a.isDraft;
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = '';
    });
    try {
      await apiService.updateProfile({
        if (!_locked) 'fullName': _name.text.trim().replaceAll(RegExp(r'\s+'), ' '),
        if (!_locked && _dob.isNotEmpty) 'dob': _dob,
        if (!_locked) 'gender': _gender,
        'phoneNumber': _phone.text.replaceAll(RegExp(r'[\s.]'), ''),
        'address': _address.text.trim(),
      });
      await appState.refresh();
      if (!mounted) return;
      Navigator.of(context).pop();
      showSnack(context, 'Đã lưu thông tin.');
    } catch (e) {
      setState(() => _error = errText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    return Scaffold(
      appBar: AppBar(title: const Text('Sửa thông tin')),
      body: SafeArea(
        child: ListView(padding: const EdgeInsets.all(18), children: [
          if (_error.isNotEmpty) Alert(_error),
          if (_locked)
            Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: InfoBanner.info('Hồ sơ đã nộp nên họ tên, ngày sinh, giới tính không sửa được. '
                  'Cần đính chính thì gửi yêu cầu ở mục Khiếu nại.'),
            ),
          AppTextField(label: 'Họ và tên', controller: _name, enabled: !_locked, textCapitalization: TextCapitalization.words),
          if (_locked)
            KV('Ngày sinh', fmtDate(_dob))
          else
            DateField(
              label: 'Ngày sinh',
              value: _dob,
              lastDate: DateTime(now.year - 18, now.month, now.day),
              onChanged: (v) => setState(() => _dob = v),
            ),
          if (_locked)
            KV('Giới tính', genderLabel[_gender])
          else
            AppDropdown<String>(
              label: 'Giới tính',
              value: _gender,
              items: const ['NAM', 'NU', 'KHAC'],
              labelBuilder: (v) => genderLabel[v]!,
              onChanged: (v) => setState(() => _gender = v),
            ),
          AppTextField(label: 'Số điện thoại', controller: _phone, keyboardType: TextInputType.phone, maxLength: 12),
          AppTextField(label: 'Địa chỉ liên hệ', controller: _address, maxLines: 2),
          const SizedBox(height: 6),
          AppButton(label: 'Lưu', fullWidth: true, loading: _busy, onPressed: _save),
        ]),
      ),
    );
  }
}
