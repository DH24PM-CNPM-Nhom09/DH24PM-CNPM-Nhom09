import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';
import '../models/models.dart';
import '../widgets/app_card.dart';
import '../widgets/app_text_field.dart';
import '../widgets/app_button.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Candidate? _profile;
  bool _loading = true;
  bool _saving = false;
  bool _saved = false;

  final _fullNameCtrl = TextEditingController();
  final _dobCtrl = TextEditingController();
  final _idNumberCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  Gender? _gender;

  @override
  void initState() {
    super.initState();
    apiService.getMyProfile().then((p) {
      setState(() {
        _profile = p;
        _fullNameCtrl.text = p.fullName;
        _dobCtrl.text = p.dob;
        _idNumberCtrl.text = p.idNumber ?? '';
        _phoneCtrl.text = p.phoneNumber ?? '';
        _emailCtrl.text = p.email ?? '';
        _addressCtrl.text = p.address ?? '';
        _gender = p.gender;
        _loading = false;
      });
    });
  }

  Future<void> _save() async {
    if (_profile == null) return;
    setState(() {
      _saving = true;
      _saved = false;
    });
    final updated = _profile!.copyWith(
      fullName: _fullNameCtrl.text,
      dob: _dobCtrl.text,
      gender: _gender,
      idNumber: _idNumberCtrl.text,
      phoneNumber: _phoneCtrl.text,
      email: _emailCtrl.text,
      address: _addressCtrl.text,
    );
    await apiService.updateMyProfile(updated);
    setState(() {
      _profile = updated;
      _saving = false;
      _saved = true;
    });
  }

  static const _genderLabel = {Gender.nam: 'Nam', Gender.nu: 'Nữ', Gender.khac: 'Khác'};

  @override
  Widget build(BuildContext context) {
    if (_loading || _profile == null) return const Center(child: CircularProgressIndicator());

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Thông tin cá nhân dùng để lập hồ sơ xét tuyển. Vui lòng đảm bảo thông tin chính xác.',
            style: TextStyle(fontSize: 13, color: AppColors.gray500)),
        const SizedBox(height: 16),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_saved) ...[InfoBanner.success('Đã lưu thông tin thành công.'), const SizedBox(height: 12)],
              AppTextField(label: 'Họ và tên', required: true, controller: _fullNameCtrl),
              const SizedBox(height: 16),
              AppTextField(label: 'Ngày sinh (yyyy-MM-dd)', required: true, controller: _dobCtrl),
              const SizedBox(height: 16),
              AppDropdown<Gender?>(
                label: 'Giới tính',
                value: _gender,
                items: const [null, Gender.nam, Gender.nu, Gender.khac],
                labelBuilder: (g) => g == null ? '-- Chọn --' : _genderLabel[g]!,
                onChanged: (v) => setState(() => _gender = v),
              ),
              const SizedBox(height: 16),
              AppTextField(label: 'Số CCCD/CMND', controller: _idNumberCtrl),
              const SizedBox(height: 16),
              AppTextField(label: 'Số điện thoại', controller: _phoneCtrl, keyboardType: TextInputType.phone),
              const SizedBox(height: 16),
              AppTextField(label: 'Email', controller: _emailCtrl, keyboardType: TextInputType.emailAddress),
              const SizedBox(height: 16),
              AppTextField(label: 'Địa chỉ', controller: _addressCtrl, maxLines: 2),
              const SizedBox(height: 20),
              AppButton(label: 'Lưu thay đổi', loading: _saving, onPressed: _save),
            ],
          ),
        ),
      ],
    );
  }
}
