import 'package:flutter/material.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../services/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../utils/labels.dart';
import '../widgets/app_button.dart';
import '../widgets/app_card.dart';
import '../widgets/common.dart';
import 'admission_letter_screen.dart';
import 'announcements_screen.dart';
import 'complaint_screen.dart';
import 'gvhd_screen.dart';
import 'shell/app_shell.dart';
import 'wizard/application_wizard_screen.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: appState,
      builder: (context, _) {
        if (!appState.loadedOnce) {
          if (appState.error != null) {
            return ErrorView(message: errText(appState.error!, 'Không tải được dữ liệu.'), onRetry: appState.refresh);
          }
          return const LoadingView();
        }
        final p = appState.profile;
        final a = appState.activeApplication;
        return RefreshIndicator(
          onRefresh: appState.refresh,
          child: ListView(padding: const EdgeInsets.all(16), children: [
            _Greeting(name: p?.fullName ?? '', app: a),
            const SizedBox(height: 14),
            _NextStep(app: a),
            const SizedBox(height: 14),
            _QuickActions(app: a),
            const SizedBox(height: 18),
            SectionTitle('Thông báo mới',
                trailing: TextButton(onPressed: () => AppShell.goTab(context, 2), child: const Text('Xem tất cả'))),
            if (appState.notifications.isEmpty)
              const AppCard(child: Text('Chưa có thông báo nào.', style: TextStyle(color: AppColors.gray500)))
            else
              ...appState.notifications.take(3).map((n) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: AppCard(
                      padding: const EdgeInsets.all(14),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Icon(n.isRead ? Icons.notifications_none : Icons.notifications_active,
                            size: 20, color: n.isRead ? AppColors.gray400 : AppColors.accent),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(n.title ?? 'Thông báo',
                                style: TextStyle(fontWeight: n.isRead ? FontWeight.w500 : FontWeight.w700, fontSize: 14)),
                            const SizedBox(height: 3),
                            Text(n.content,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(color: AppColors.gray600, fontSize: 13)),
                            const SizedBox(height: 3),
                            Text(fmtDateTime(n.createdAt), style: const TextStyle(color: AppColors.gray400, fontSize: 11.5)),
                          ]),
                        ),
                      ]),
                    ),
                  )),
          ]),
        );
      },
    );
  }
}

class _Greeting extends StatelessWidget {
  final String name;
  final FullApplication? app;
  const _Greeting({required this.name, required this.app});

  @override
  Widget build(BuildContext context) {
    final a = app;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [AppColors.navy900, AppColors.navy700]),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Xin chào,', style: TextStyle(color: Colors.white.withValues(alpha: 0.75), fontSize: 13)),
        const SizedBox(height: 2),
        Text(name.isEmpty ? 'Thí sinh' : name,
            style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 12),
        if (a == null)
          Text('Bạn chưa có hồ sơ xét tuyển nào.', style: TextStyle(color: Colors.white.withValues(alpha: 0.85)))
        else ...[
          Text('${degreeLabel[a.degreeLevel]} · ${a.major.majorName}',
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
          const SizedBox(height: 2),
          Text('Mã hồ sơ: ${a.applicationCode}',
              style: TextStyle(color: Colors.white.withValues(alpha: 0.75), fontSize: 12.5)),
          const SizedBox(height: 10),
          Wrap(spacing: 8, runSpacing: 6, children: [
            ToneBadge(reviewTone(a.reviewStatus), small: true),
            if (a.admissionStatus != 'NONE') ToneBadge(admissionTone(a.admissionStatus), small: true),
          ]),
        ],
      ]),
    );
  }
}

/// "Việc cần làm tiếp theo" — suy ra từ trạng thái hồ sơ
class _NextStep extends StatelessWidget {
  final FullApplication? app;
  const _NextStep({required this.app});

  @override
  Widget build(BuildContext context) {
    final a = app;
    String title;
    String text;
    String? button;
    VoidCallback? onTap;
    IconData icon = Icons.flag_outlined;

    void openWizard() async {
      await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ApplicationWizardScreen()));
      appState.refresh();
    }

    final e = a?.admission?.enrollment;
    final r = a?.admission?.result;
    if (a == null) {
      title = 'Đăng ký dự tuyển';
      text = 'Xem các đợt đang mở, chọn ngành rồi tạo hồ sơ xét tuyển ngay trên điện thoại.';
      button = 'Tạo hồ sơ xét tuyển';
      onTap = openWizard;
      icon = Icons.post_add;
    } else if (a.isDraft) {
      title = 'Hoàn thiện hồ sơ nháp';
      text = a.missingDocuments.isNotEmpty
          ? 'Còn thiếu ${a.missingDocuments.length} minh chứng bắt buộc. Hạn nhận hồ sơ: ${fmtDateTime(a.batch.registrationEndAt)}.'
          : 'Kiểm tra lại thông tin rồi nộp hồ sơ trước ${fmtDateTime(a.batch.registrationEndAt)}.';
      button = 'Tiếp tục hồ sơ';
      onTap = openWizard;
      icon = Icons.edit_note;
    } else if (a.reviewStatus == 'NEEDS_SUPPLEMENT') {
      title = 'Cần bổ sung minh chứng';
      text = '${a.supplement?.content ?? 'Cán bộ yêu cầu bổ sung minh chứng.'}'
          '${a.supplement != null ? '\nHạn: ${fmtDateTime(a.supplement!.deadline)}' : ''}';
      button = 'Bổ sung ngay';
      onTap = () => AppShell.goTab(context, 1);
      icon = Icons.upload_file;
    } else if (a.payment != null && a.payment!.status == 'PENDING') {
      title = 'Nộp lệ phí xét tuyển';
      text = 'Số tiền ${fmtMoney(a.payment!.amount)}. Quét mã VietQR bằng app ngân hàng để chuyển khoản.';
      button = 'Xem mã thanh toán';
      onTap = () => AppShell.goTab(context, 1);
      icon = Icons.qr_code_2;
    } else if (e != null && e.status != 'TU_CHOI_QUA_HAN') {
      if (e.canConfirm) {
        title = 'Xác nhận nhập học';
        text = 'Bạn đã trúng tuyển! Xác nhận nhập học trước ${fmtDateTime(e.deadline)} (${timeLeft(e.deadline)}).';
        button = 'Xác nhận ngay';
        onTap = () => AppShell.goTab(context, 1);
        icon = Icons.celebration_outlined;
      } else {
        title = 'Giấy báo trúng tuyển';
        text = e.studentCode != null
            ? 'Mã học viên của bạn: ${e.studentCode}.'
            : 'Tải giấy báo trúng tuyển (PDF) và mang theo khi làm thủ tục nhập học.';
        button = 'Xem giấy báo';
        onTap = () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AdmissionLetterScreen()));
        icon = Icons.verified_outlined;
      }
    } else if (r != null) {
      title = 'Kết quả xét tuyển: ${r.label}';
      text = r.result == 'DU_BI' && r.waitlistRank != null
          ? 'Bạn ở vị trí dự bị số ${r.waitlistRank}. Theo dõi thông báo nếu được gọi bổ sung.'
          : 'Xem chi tiết điểm và kết quả trong mục Hồ sơ.';
      button = 'Xem kết quả';
      onTap = () => AppShell.goTab(context, 1);
      icon = Icons.emoji_events_outlined;
    } else if (a.reviewStatus == 'REJECTED') {
      title = 'Hồ sơ không đạt thẩm định';
      text = 'Xem lý do trong mục Hồ sơ. Nếu chưa đồng ý, bạn có thể gửi khiếu nại.';
      button = 'Xem hồ sơ';
      onTap = () => AppShell.goTab(context, 1);
      icon = Icons.report_outlined;
    } else {
      title = 'Hồ sơ đang được xử lý';
      text = a.englishTest?.testAt != null
          ? 'Lịch thi tiếng Anh: ${fmtDateTime(a.englishTest!.testAt)}${a.englishTest!.room != null ? ', phòng ${a.englishTest!.room}' : ''}.'
          : 'Nhà trường sẽ gửi thông báo khi có lịch thi, điểm hoặc kết quả. Bật thông báo để không bỏ lỡ.';
      button = 'Xem hồ sơ';
      onTap = () => AppShell.goTab(context, 1);
      icon = Icons.hourglass_top;
    }

    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: AppColors.accent50, borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: AppColors.accent, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(child: Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700))),
        ]),
        const SizedBox(height: 10),
        Text(text, style: const TextStyle(color: AppColors.gray600, fontSize: 13.5, height: 1.45)),
        const SizedBox(height: 14),
        AppButton(label: button, fullWidth: true, onPressed: onTap),
      ]),
    );
  }
}

class _QuickActions extends StatelessWidget {
  final FullApplication? app;
  const _QuickActions({required this.app});

  @override
  Widget build(BuildContext context) {
    final a = app;
    final hasLetter = a?.admission?.enrollment != null && a!.admission!.enrollment!.status != 'TU_CHOI_QUA_HAN';
    final items = <(IconData, String, VoidCallback)>[
      (Icons.description_outlined, 'Hồ sơ', () => AppShell.goTab(context, 1)),
      (
        Icons.rule_folder_outlined,
        'Điều kiện\ntuyển sinh',
        () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const OpenBatchesScreen())),
      ),
      if (hasLetter)
        (
          Icons.picture_as_pdf_outlined,
          'Giấy báo\ntrúng tuyển',
          () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AdmissionLetterScreen())),
        ),
      if (a != null && a.isDoctoral)
        (
          Icons.school_outlined,
          'Giảng viên\nhướng dẫn',
          () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const GvhdScreen())),
        ),
      (
        Icons.support_agent_outlined,
        'Khiếu nại',
        () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ComplaintScreen())),
      ),
    ];
    return GridView.count(
      crossAxisCount: 4,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 8,
      crossAxisSpacing: 8,
      childAspectRatio: 0.82,
      children: items
          .map((it) => Material(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                child: InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: it.$3,
                  child: Container(
                    decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.gray200)),
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 10),
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Icon(it.$1, color: AppColors.navy800, size: 26),
                      const SizedBox(height: 6),
                      Text(it.$2,
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, height: 1.2)),
                    ]),
                  ),
                ),
              ))
          .toList(),
    );
  }
}
