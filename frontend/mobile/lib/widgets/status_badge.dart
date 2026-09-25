import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../models/models.dart';

class StatusBadge extends StatelessWidget {
  final String text;
  final Color background;
  final Color foreground;

  const StatusBadge({
    super.key,
    required this.text,
    required this.background,
    required this.foreground,
  });

  // Ánh xạ trực tiếp 2 trục trạng thái trong admission_db v3 sang màu hiển thị,
  // dùng chung 1 cách tô màu với bản web (src/components/ui/Badge.tsx).
  factory StatusBadge.review(ReviewStatus status) {
    final (bg, fg) = switch (status) {
      ReviewStatus.approved => (AppColors.success50, AppColors.success),
      ReviewStatus.rejected => (AppColors.danger50, AppColors.danger),
      ReviewStatus.needsSupplement => (AppColors.warning50, AppColors.warning),
      ReviewStatus.underReview || ReviewStatus.submitted => (AppColors.info50, AppColors.info),
      _ => (AppColors.gray100, AppColors.gray500),
    };
    return StatusBadge(text: reviewStatusLabel(status), background: bg, foreground: fg);
  }

  factory StatusBadge.admission(AdmissionStatus status) {
    final (bg, fg) = switch (status) {
      AdmissionStatus.admitted || AdmissionStatus.confirmed || AdmissionStatus.enrolled =>
        (AppColors.success50, AppColors.success),
      AdmissionStatus.waitlisted => (AppColors.warning50, AppColors.warning),
      _ => (AppColors.gray100, AppColors.gray500),
    };
    return StatusBadge(text: admissionStatusLabel(status), background: bg, foreground: fg);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(999)),
      child: Text(text,
          style: TextStyle(color: foreground, fontSize: 13, fontWeight: FontWeight.w600)),
    );
  }
}
