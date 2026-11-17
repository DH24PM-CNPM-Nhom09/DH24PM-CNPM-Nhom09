import 'package:flutter/material.dart';

import '../services/api_client.dart';
import '../theme/app_theme.dart';
import '../utils/labels.dart';

/// Nhãn trạng thái dạng viên thuốc
class ToneBadge extends StatelessWidget {
  final Tone tone;
  final bool small;
  const ToneBadge(this.tone, {super.key, this.small = false});

  @override
  Widget build(BuildContext context) {
    final (bg, fg, text) = tone;
    return Container(
      padding: EdgeInsets.symmetric(horizontal: small ? 8 : 10, vertical: small ? 3 : 5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Text(text, style: TextStyle(color: fg, fontSize: small ? 11.5 : 12.5, fontWeight: FontWeight.w600)),
    );
  }
}

class SectionTitle extends StatelessWidget {
  final String text;
  final Widget? trailing;
  const SectionTitle(this.text, {super.key, this.trailing});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(children: [
          Expanded(
            child: Text(text, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.gray900)),
          ),
          if (trailing != null) trailing!,
        ]),
      );
}

/// Một dòng "Nhãn: giá trị"
class KV extends StatelessWidget {
  final String label;
  final String? value;
  final bool bold;
  const KV(this.label, this.value, {super.key, this.bold = true});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(width: 120, child: Text(label, style: const TextStyle(color: AppColors.gray500, fontSize: 13))),
          Expanded(
            child: Text(
              (value == null || value!.isEmpty) ? '—' : value!,
              style: TextStyle(
                  color: AppColors.gray900, fontSize: 13.5, fontWeight: bold ? FontWeight.w600 : FontWeight.w400),
            ),
          ),
        ]),
      );
}

class LoadingView extends StatelessWidget {
  final String text;
  const LoadingView({super.key, this.text = 'Đang tải…'});

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const SizedBox(width: 28, height: 28, child: CircularProgressIndicator(strokeWidth: 2.5)),
            const SizedBox(height: 14),
            Text(text, style: const TextStyle(color: AppColors.gray500, fontSize: 13)),
          ]),
        ),
      );
}

class ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const ErrorView({super.key, required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.cloud_off_outlined, size: 44, color: AppColors.gray400),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.gray600, fontSize: 14)),
            const SizedBox(height: 16),
            OutlinedButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: const Text('Thử lại')),
          ]),
        ),
      );
}

class EmptyView extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? message;
  final Widget? action;
  const EmptyView({super.key, required this.icon, required this.title, this.message, this.action});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 16),
        child: Column(children: [
          Icon(icon, size: 44, color: AppColors.gray300),
          const SizedBox(height: 12),
          Text(title,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.gray700)),
          if (message != null) ...[
            const SizedBox(height: 6),
            Text(message!, textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, color: AppColors.gray500)),
          ],
          if (action != null) ...[const SizedBox(height: 16), action!],
        ]),
      );
}

/// Ô thông báo lỗi/ghi chú đặt trong form
class Alert extends StatelessWidget {
  final String text;
  final bool error;
  const Alert(this.text, {super.key, this.error = true});

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 14),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: error ? AppColors.danger50 : AppColors.success50,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(text,
            style: TextStyle(color: error ? AppColors.danger : AppColors.success, fontSize: 13, height: 1.35)),
      );
}

void showSnack(BuildContext context, String text, {bool error = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text(text),
      backgroundColor: error ? AppColors.danger : AppColors.gray900,
      behavior: SnackBarBehavior.floating,
    ));
}

Future<bool> confirmDialog(
  BuildContext context, {
  required String title,
  required String message,
  String ok = 'Đồng ý',
  bool danger = false,
}) async {
  final r = await showDialog<bool>(
    context: context,
    builder: (c) => AlertDialog(
      title: Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
      content: Text(message),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Hủy')),
        FilledButton(
          style: danger ? FilledButton.styleFrom(backgroundColor: AppColors.danger) : null,
          onPressed: () => Navigator.pop(c, true),
          child: Text(ok),
        ),
      ],
    ),
  );
  return r == true;
}

/// Bọc một khối tải dữ liệu: đang tải / lỗi (có nút thử lại) / có dữ liệu.
class AsyncBody<T> extends StatelessWidget {
  final AsyncSnapshot<T> snap;
  final VoidCallback onRetry;
  final Widget Function(T data) builder;
  const AsyncBody({super.key, required this.snap, required this.onRetry, required this.builder});

  @override
  Widget build(BuildContext context) {
    if (snap.hasError) {
      return ErrorView(message: errText(snap.error!, 'Không tải được dữ liệu.'), onRetry: onRetry);
    }
    if (snap.connectionState != ConnectionState.done) return const LoadingView();
    return builder(snap.data as T);
  }
}
