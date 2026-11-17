import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_theme.dart';

class FieldLabel extends StatelessWidget {
  final String label;
  final bool required;
  const FieldLabel(this.label, {super.key, this.required = false});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text.rich(
          TextSpan(
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.gray700),
            children: [
              TextSpan(text: label),
              if (required) const TextSpan(text: ' *', style: TextStyle(color: AppColors.danger)),
            ],
          ),
        ),
      );
}

class AppTextField extends StatelessWidget {
  final String label;
  final bool required;
  final TextEditingController? controller;
  final void Function(String)? onChanged;
  final bool obscureText;
  final TextInputType? keyboardType;
  final String? hint;
  final String? helper;
  final String? errorText;
  final int maxLines;
  final int? maxLength;
  final bool readOnly;
  final bool enabled;
  final VoidCallback? onTap;
  final Widget? suffixIcon;
  final Widget? prefixIcon;
  final TextInputAction? textInputAction;
  final List<TextInputFormatter>? inputFormatters;
  final Iterable<String>? autofillHints;
  final TextCapitalization textCapitalization;

  const AppTextField({
    super.key,
    required this.label,
    this.required = false,
    this.controller,
    this.onChanged,
    this.obscureText = false,
    this.keyboardType,
    this.hint,
    this.helper,
    this.errorText,
    this.maxLines = 1,
    this.maxLength,
    this.readOnly = false,
    this.enabled = true,
    this.onTap,
    this.suffixIcon,
    this.prefixIcon,
    this.textInputAction,
    this.inputFormatters,
    this.autofillHints,
    this.textCapitalization = TextCapitalization.none,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (label.isNotEmpty) FieldLabel(label, required: required),
          TextField(
            controller: controller,
            onChanged: onChanged,
            obscureText: obscureText,
            keyboardType: keyboardType,
            maxLines: obscureText ? 1 : maxLines,
            minLines: 1,
            maxLength: maxLength,
            readOnly: readOnly,
            enabled: enabled,
            onTap: onTap,
            textInputAction: textInputAction,
            inputFormatters: inputFormatters,
            autofillHints: autofillHints,
            textCapitalization: textCapitalization,
            style: const TextStyle(fontSize: 14.5, color: AppColors.gray900),
            decoration: InputDecoration(
              hintText: hint,
              helperText: helper,
              helperMaxLines: 3,
              errorText: errorText,
              errorMaxLines: 3,
              suffixIcon: suffixIcon,
              prefixIcon: prefixIcon,
              counterText: '',
            ),
          ),
        ],
      ),
    );
  }
}

/// Ô chọn trong danh sách (giá trị có thể rỗng)
class AppDropdown<T> extends StatelessWidget {
  final String label;
  final bool required;
  final T? value;
  final List<T> items;
  final String Function(T) labelBuilder;
  final void Function(T?) onChanged;
  final String? hint;
  final String? errorText;

  const AppDropdown({
    super.key,
    required this.label,
    required this.value,
    required this.items,
    required this.labelBuilder,
    required this.onChanged,
    this.required = false,
    this.hint,
    this.errorText,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (label.isNotEmpty) FieldLabel(label, required: required),
          DropdownButtonFormField<T>(
            // key theo giá trị: khi giá trị đổi từ bên ngoài (quét CCCD…) ô chọn hiển thị lại đúng
            key: ValueKey<Object?>(value),
            initialValue: value,
            isExpanded: true,
            hint: hint == null ? null : Text(hint!, style: const TextStyle(fontSize: 14, color: AppColors.gray400)),
            decoration: InputDecoration(errorText: errorText, errorMaxLines: 3),
            items: items
                .map((e) => DropdownMenuItem<T>(
                      value: e,
                      child: Text(labelBuilder(e), overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14.5)),
                    ))
                .toList(),
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }
}

/// Ô chọn ngày — hiển thị dd/mm/yyyy, giá trị yyyy-mm-dd
class DateField extends StatelessWidget {
  final String label;
  final bool required;
  final String? value; // yyyy-mm-dd
  final void Function(String) onChanged;
  final String? errorText;
  final DateTime? firstDate;
  final DateTime? lastDate;
  final DateTime? initialDate;

  const DateField({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
    this.required = false,
    this.errorText,
    this.firstDate,
    this.lastDate,
    this.initialDate,
  });

  String get _shown {
    final v = value;
    if (v == null || v.length < 10) return '';
    return '${v.substring(8, 10)}/${v.substring(5, 7)}/${v.substring(0, 4)}';
  }

  @override
  Widget build(BuildContext context) {
    return AppTextField(
      label: label,
      required: required,
      controller: TextEditingController(text: _shown),
      readOnly: true,
      hint: 'dd/mm/yyyy',
      errorText: errorText,
      suffixIcon: const Icon(Icons.calendar_month_outlined, color: AppColors.gray500),
      onTap: () async {
        final now = DateTime.now();
        final cur = (value != null && value!.length >= 10) ? DateTime.tryParse(value!) : null;
        final picked = await showDatePicker(
          context: context,
          locale: const Locale('vi'),
          initialDate: cur ?? initialDate ?? now,
          firstDate: firstDate ?? DateTime(1940),
          lastDate: lastDate ?? now,
          helpText: label.toUpperCase(),
        );
        if (picked != null) {
          onChanged('${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}');
        }
      },
    );
  }
}
