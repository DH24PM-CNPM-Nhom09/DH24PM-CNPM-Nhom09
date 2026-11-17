import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_theme.dart';

/// Ô nhập mã 6 số — một ô duy nhất, dán (paste) mã từ email được.
class OtpInput extends StatelessWidget {
  final TextEditingController controller;
  final void Function(String)? onCompleted;
  final String? errorText;

  const OtpInput({super.key, required this.controller, this.onCompleted, this.errorText});

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      autofocus: true,
      keyboardType: TextInputType.number,
      textAlign: TextAlign.center,
      maxLength: 6,
      autofillHints: const [AutofillHints.oneTimeCode],
      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
      style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800, letterSpacing: 14, color: AppColors.navy900),
      decoration: InputDecoration(counterText: '', hintText: '••••••', errorText: errorText),
      onChanged: (v) {
        if (v.length == 6) onCompleted?.call(v);
      },
    );
  }
}
