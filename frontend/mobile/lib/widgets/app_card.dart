import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;

  const AppCard({super.key, required this.child, this.padding = const EdgeInsets.all(20)});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.gray200),
      ),
      child: child,
    );
  }
}

class InfoBanner extends StatelessWidget {
  final String text;
  final Color background;
  final Color foreground;

  const InfoBanner({super.key, required this.text, required this.background, required this.foreground});

  factory InfoBanner.warning(String text) =>
      InfoBanner(text: text, background: AppColors.warning50, foreground: AppColors.warning);
  factory InfoBanner.danger(String text) =>
      InfoBanner(text: text, background: AppColors.danger50, foreground: AppColors.danger);
  factory InfoBanner.info(String text) =>
      InfoBanner(text: text, background: AppColors.info50, foreground: AppColors.info);
  factory InfoBanner.success(String text) =>
      InfoBanner(text: text, background: AppColors.success50, foreground: AppColors.success);

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(10)),
      child: Text(text, style: TextStyle(color: foreground, fontSize: 13, fontWeight: FontWeight.w500)),
    );
  }
}
