import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colors.dart';

/// Tipografia do Cuidar+: Baloo 2 em todos os pesos usados no produto.
class AppTextStyles {
  AppTextStyles._();

  static TextStyle _base(double size, FontWeight weight, {Color? color, double? height}) {
    return GoogleFonts.baloo2(
      fontSize: size,
      fontWeight: weight,
      color: color ?? AppColors.primaryText,
      height: height,
    );
  }

  // Títulos — Bold 700
  static TextStyle displayLg = _base(32, FontWeight.w700, height: 1.2);
  static TextStyle titleLg = _base(24, FontWeight.w700, height: 1.25);
  static TextStyle titleMd = _base(20, FontWeight.w700, height: 1.3);

  // Subtítulos / botões — SemiBold 600
  static TextStyle subtitle = _base(16, FontWeight.w600, height: 1.3);
  static TextStyle button = _base(16, FontWeight.w600, height: 1.0);
  static TextStyle label = _base(13, FontWeight.w600, height: 1.2);

  // Corpo — Regular 400
  static TextStyle body = _base(15, FontWeight.w400, height: 1.45);
  static TextStyle bodySm = _base(13, FontWeight.w400, height: 1.4);
}
