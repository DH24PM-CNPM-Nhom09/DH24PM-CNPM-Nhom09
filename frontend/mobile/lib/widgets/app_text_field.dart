import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class AppTextField extends StatelessWidget {
  final String label;
  final bool required;
  final TextEditingController? controller;
  final String? initialValue;
  final void Function(String)? onChanged;
  final bool obscureText;
  final TextInputType? keyboardType;
  final String? hint;
  final String? errorText;
  final int maxLines;

  const AppTextField({
    super.key,
    required this.label,
    this.required = false,
    this.controller,
    this.initialValue,
    this.onChanged,
    this.obscureText = false,
    this.keyboardType,
    this.hint,
    this.errorText,
    this.maxLines = 1,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        RichText(
          text: TextSpan(
            style: const TextStyle(
                fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.gray700),
            children: [
              TextSpan(text: label),
              if (required)
                const TextSpan(text: '  *', style: TextStyle(color: AppColors.danger)),
            ],
          ),
        ),
        const SizedBox(height: 6),
        TextFormField(
          controller: controller,
          initialValue: controller == null ? initialValue : null,
          onChanged: onChanged,
          obscureText: obscureText,
          keyboardType: keyboardType,
          maxLines: obscureText ? 1 : maxLines,
          style: const TextStyle(fontSize: 14, color: AppColors.gray900),
          decoration: InputDecoration(hintText: hint, errorText: errorText),
        ),
      ],
    );
  }
}

class AppDropdown<T> extends StatelessWidget {
  final String label;
  final T value;
  final List<T> items;
  final String Function(T) labelBuilder;
  final void Function(T) onChanged;

  const AppDropdown({
    super.key,
    required this.label,
    required this.value,
    required this.items,
    required this.labelBuilder,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.gray700)),
        const SizedBox(height: 6),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: AppColors.gray300),
            borderRadius: BorderRadius.circular(10),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<T>(
              value: value,
              isExpanded: true,
              items: items
                  .map((e) => DropdownMenuItem(value: e, child: Text(labelBuilder(e))))
                  .toList(),
              onChanged: (v) {
                if (v != null) onChanged(v);
              },
            ),
          ),
        ),
      ],
    );
  }
}
