import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';
import '../models/models.dart';
import '../widgets/app_card.dart';
import '../widgets/status_badge.dart';
import '../widgets/app_button.dart';

class AdmissionConfirmScreen extends StatefulWidget {
  const AdmissionConfirmScreen({super.key});
  @override
  State<AdmissionConfirmScreen> createState() => _AdmissionConfirmScreenState();
}

class _AdmissionConfirmScreenState extends State<AdmissionConfirmScreen> {
  Application? _app;
  bool _loading = true;
  bool _confirmed = false;

  @override
  void initState() {
    super.initState();
    apiService.getMyApplication().then((a) => setState(() {
          _app = a;
          _loading = false;
        }));
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Xác nhận nhập học')),
      body: _app == null
          ? const Center(child: Text('Không tìm thấy hồ sơ xét tuyển.'))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(_app!.applicationCode, style: const TextStyle(color: AppColors.gray500, fontSize: 12)),
                                const SizedBox(height: 4),
                                Text(
                                    '${_app!.majorName} · ${_app!.degreeLevel == DegreeLevel.tienSi ? "Tiến sĩ" : "Thạc sĩ"}',
                                    style: const TextStyle(fontWeight: FontWeight.w700)),
                              ],
                            ),
                          ),
                          StatusBadge.admission(_app!.admissionStatus),
                        ],
                      ),
                      if (_app!.admissionStatus == AdmissionStatus.admitted && !_confirmed) ...[
                        const Divider(height: 28),
                        const Text(
                            'Chúc mừng bạn đã trúng tuyển! Vui lòng xác nhận nhập học trước thời hạn quy định của trường để giữ chỗ.',
                            style: TextStyle(fontSize: 13, color: AppColors.gray600)),
                        const SizedBox(height: 14),
                        AppButton(
                            label: 'Xác nhận nhập học ngay', onPressed: () => setState(() => _confirmed = true)),
                      ],
                      if (_confirmed ||
                          _app!.admissionStatus == AdmissionStatus.confirmed ||
                          _app!.admissionStatus == AdmissionStatus.enrolled) ...[
                        const SizedBox(height: 16),
                        InfoBanner.success(
                            'Bạn đã xác nhận nhập học thành công. Vui lòng theo dõi email để nhận hướng dẫn nhập học chi tiết.'),
                      ],
                      if (_app!.admissionStatus == AdmissionStatus.none) ...[
                        const SizedBox(height: 16),
                        const InfoBanner(
                            text: 'Hồ sơ của bạn chưa có kết quả xét tuyển. Vui lòng quay lại sau.',
                            background: AppColors.gray100,
                            foreground: AppColors.gray500),
                      ],
                      if (_app!.admissionStatus == AdmissionStatus.waitlisted) ...[
                        const SizedBox(height: 16),
                        InfoBanner.warning(
                            'Bạn đang ở danh sách dự bị. Chúng tôi sẽ thông báo nếu có chỉ tiêu bổ sung.'),
                      ],
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}
