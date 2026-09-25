import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';
import '../models/models.dart';
import '../widgets/app_card.dart';
import '../widgets/app_button.dart';
import '../widgets/status_badge.dart';
import 'application_screen.dart';
import 'complaint_screen.dart';
import 'wizard/application_wizard_screen.dart';
import 'admission_confirm_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Application? _app;
  Candidate? _candidate;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final results = await Future.wait([
      apiService.getMyApplication(),
      apiService.getMyProfile(),
    ]);
    setState(() {
      _app = results[0] as Application?;
      _candidate = results[1] as Candidate?;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Xin chào, ${_candidate?.fullName ?? "..."} 👋',
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.gray900)),
          const SizedBox(height: 4),
          const Text('Đây là tổng quan hồ sơ xét tuyển sau đại học của bạn.',
              style: TextStyle(fontSize: 13, color: AppColors.gray500)),
          const SizedBox(height: 16),
          if (_app != null)
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('MÃ HỒ SƠ',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.gray400)),
                            const SizedBox(height: 4),
                            Text(_app!.applicationCode,
                                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                            const SizedBox(height: 4),
                            Text(
                                '${_app!.majorName} · ${_app!.degreeLevel == DegreeLevel.tienSi ? "Tiến sĩ" : "Thạc sĩ"} · ${_app!.batchName}',
                                style: const TextStyle(fontSize: 13, color: AppColors.gray500)),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Wrap(spacing: 8, runSpacing: 8, children: [
                    StatusBadge.review(_app!.reviewStatus),
                    StatusBadge.admission(_app!.admissionStatus),
                  ]),
                  if (_app!.reviewStatus == ReviewStatus.needsSupplement) ...[
                    const SizedBox(height: 12),
                    InfoBanner.warning(
                        'Hồ sơ của bạn cần bổ sung thêm giấy tờ. Vui lòng kiểm tra chi tiết trong mục Hồ sơ xét tuyển.'),
                  ],
                  const SizedBox(height: 16),
                  Wrap(spacing: 10, runSpacing: 10, children: [
                    AppButton(
                      label: 'Xem chi tiết hồ sơ',
                      onPressed: () => Navigator.of(context)
                          .push(MaterialPageRoute(builder: (_) => const ApplicationScreen())),
                    ),
                    if (_app!.admissionStatus == AdmissionStatus.admitted)
                      AppButton(
                        label: 'Xác nhận nhập học',
                        variant: AppButtonVariant.secondary,
                        onPressed: () => Navigator.of(context)
                            .push(MaterialPageRoute(builder: (_) => const AdmissionConfirmScreen())),
                      ),
                    AppButton(
                      label: 'Gửi khiếu nại',
                      variant: AppButtonVariant.outline,
                      onPressed: () => Navigator.of(context)
                          .push(MaterialPageRoute(builder: (_) => const ComplaintScreen())),
                    ),
                  ]),
                ],
              ),
            )
          else
            AppCard(
              child: Column(
                children: [
                  const Text('Bạn chưa tạo hồ sơ xét tuyển nào.',
                      style: TextStyle(fontSize: 13, color: AppColors.gray500)),
                  const SizedBox(height: 12),
                  AppButton(
                    label: 'Tạo hồ sơ xét tuyển',
                    onPressed: () => Navigator.of(context)
                        .push(MaterialPageRoute(builder: (_) => const ApplicationWizardScreen())),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }
}
