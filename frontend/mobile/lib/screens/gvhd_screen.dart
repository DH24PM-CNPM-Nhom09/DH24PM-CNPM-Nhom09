import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';
import '../models/models.dart';
import '../widgets/app_card.dart';
import '../widgets/status_badge.dart';

class GvhdScreen extends StatefulWidget {
  const GvhdScreen({super.key});
  @override
  State<GvhdScreen> createState() => _GvhdScreenState();
}

String _lastTwoInitials(String name) {
  final parts = name.split(' ').where((s) => s.isNotEmpty).toList();
  final last2 = parts.length > 2 ? parts.sublist(parts.length - 2) : parts;
  return last2.map((s) => s[0]).join().toUpperCase();
}

class _GvhdScreenState extends State<GvhdScreen> {
  SupervisorRequest? _req;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    apiService.getMySupervisorRequest().then((r) => setState(() {
          _req = r;
          _loading = false;
        }));
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());

    if (_req == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text('Bạn chưa gửi yêu cầu đăng ký giảng viên hướng dẫn nào.',
              textAlign: TextAlign.center, style: TextStyle(color: AppColors.gray500)),
        ),
      );
    }

    final statusMeta = switch (_req!.status) {
      SupervisorRequestStatus.pending => ('Đang chờ phản hồi', AppColors.warning50, AppColors.warning),
      SupervisorRequestStatus.accepted => ('Đã chấp nhận hướng dẫn', AppColors.success50, AppColors.success),
      SupervisorRequestStatus.rejected => ('Đã từ chối', AppColors.danger50, AppColors.danger),
    };

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Áp dụng cho bậc Tiến sĩ — theo dõi trạng thái yêu cầu đăng ký GVHD.',
            style: TextStyle(fontSize: 13, color: AppColors.gray500)),
        const SizedBox(height: 16),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: AppColors.navy50,
                    child: Text(
                      _lastTwoInitials(_req!.lecturerName),
                      style: const TextStyle(color: AppColors.navy800, fontWeight: FontWeight.w800),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(_req!.lecturerName, style: const TextStyle(fontWeight: FontWeight.w700)),
                        Text(_req!.facultyName,
                            style: const TextStyle(fontSize: 12, color: AppColors.gray500)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              StatusBadge(text: statusMeta.$1, background: statusMeta.$2, foreground: statusMeta.$3),
              const Divider(height: 24),
              Text('Ngày gửi yêu cầu: ${_req!.requestedAt.split("T").first}',
                  style: const TextStyle(fontSize: 12, color: AppColors.gray500)),
              if (_req!.status == SupervisorRequestStatus.pending) ...[
                const SizedBox(height: 12),
                InfoBanner.info(
                    'Yêu cầu của bạn đang chờ giảng viên hướng dẫn phản hồi. Bạn sẽ nhận được thông báo ngay khi có kết quả.'),
              ],
              if (_req!.status == SupervisorRequestStatus.rejected) ...[
                const SizedBox(height: 12),
                InfoBanner.danger(
                    'Giảng viên đã từ chối yêu cầu hướng dẫn này. Vui lòng liên hệ Phòng Đào tạo Sau đại học để được hỗ trợ chọn GVHD khác.'),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
