import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

enum AppButtonVariant { primary, secondary, outline, ghost }

class AppButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final AppButtonVariant variant;
  final bool loading;
  final bool fullWidth;
  final IconData? icon;

  const AppButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = AppButtonVariant.primary,
    this.loading = false,
    this.fullWidth = false,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final Color bg;
    final Color fg;
    Border? border;
    switch (variant) {
      case AppButtonVariant.primary:
        bg = AppColors.accent;
        fg = Colors.white;
        break;
      case AppButtonVariant.secondary:
        bg = AppColors.navy800;
        fg = Colors.white;
        break;
      case AppButtonVariant.outline:
        bg = Colors.white;
        fg = AppColors.accent;
        border = Border.all(color: AppColors.accent, width: 1.5);
        break;
      case AppButtonVariant.ghost:
        bg = Colors.transparent;
        fg = AppColors.gray600;
        break;
    }

    final child = loading
        ? SizedBox(
            height: 18,
            width: 18,
            child: CircularProgressIndicator(strokeWidth: 2, color: fg),
          )
        : Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[Icon(icon, size: 18, color: fg), const SizedBox(width: 8)],
              Text(label,
                  style: TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: 15)),
            ],
          );

    return SizedBox(
      width: fullWidth ? double.infinity : null,
      child: Material(
        color: bg,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: loading ? null : onPressed,
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              border: border,
            ),
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 15),
            alignment: Alignment.center,
            child: child,
          ),
        ),
      ),
    );
  }
}
