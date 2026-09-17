import 'package:flutter/material.dart';

/// Paleta do Cuidar+ — idêntica aos tokens do sistema web
/// (web/src/app/globals.css), para app e site terem a mesma identidade.
class AppColors {
  AppColors._();

  // Marca
  static const Color primary = Color(0xFF6B4EFF);
  static const Color primaryStrong = Color(0xFF5A3EF0);
  static const Color primarySoft = Color(0xFFF4F3FF);
  static const Color primaryInk = Color(0xFF5925DC);

  // Estrutura
  static const Color ink = Color(0xFF344054);
  static const Color primaryText = Color(0xFF1D2939); // ink-strong
  static const Color secondaryText = Color(0xFF667085); // ink-muted
  static const Color inkFaint = Color(0xFF98A2B3);
  static const Color background = Color(0xFFF9FAFB);
  static const Color surface = Colors.white;
  static const Color surface2 = Color(0xFFF2F4F7);
  static const Color line = Color(0xFFEAECF0);
  static const Color lineStrong = Color(0xFFD0D5DD);

  // Tons claros (fundos)
  static const Color purpleLight = Color(0xFFF4F3FF);
  static const Color peachLight = Color(0xFFFFF4ED);
  static const Color mintLight = Color(0xFFECFDF3);
  static const Color yellowLight = Color(0xFFFEFBE8);
  static const Color blueLight = Color(0xFFF0F9FF);
  static const Color roseLight = Color(0xFFFEF3F2);

  // Tons vivos (ícones e destaques)
  static const Color purple = Color(0xFF7A5AF8);
  static const Color peach = Color(0xFFF79009);
  static const Color mint = Color(0xFF12B76A);
  static const Color yellow = Color(0xFFFAC515);
  static const Color blue = Color(0xFF2E90FA);
  static const Color rose = Color(0xFFF04438);

  static const Color success = mint;
  static const Color warning = yellow;
  static const Color info = blue;
  static const Color error = rose;

  // Aliases legados
  static const Color lavender = purpleLight;
  static const Color pastelYellow = yellowLight;
}

/// Tom completo (mesma lógica do `TONE` do site): base, suave, borda e texto acessível.
class Tone {
  final Color base;
  final Color soft;
  final Color edge;
  final Color ink;
  const Tone(this.base, this.soft, this.edge, this.ink);

  static const mint = Tone(Color(0xFF75E0A7), Color(0xFFECFDF3), Color(0xFF12B76A), Color(0xFF067647));
  static const peach = Tone(Color(0xFFFDB022), Color(0xFFFFF4ED), Color(0xFFF79009), Color(0xFFB54708));
  static const lilac = Tone(Color(0xFFBDB4FE), Color(0xFFF4F3FF), Color(0xFF7A5AF8), Color(0xFF5925DC));
  static const sun = Tone(Color(0xFFFDE272), Color(0xFFFEFBE8), Color(0xFFFAC515), Color(0xFF854A0E));
  static const rose = Tone(Color(0xFFFDA29B), Color(0xFFFEF3F2), Color(0xFFF04438), Color(0xFFB42318));
  static const blue = Tone(Color(0xFF84CAFF), Color(0xFFF0F9FF), Color(0xFF2E90FA), Color(0xFF175CD3));
  static const neutral = Tone(Color(0xFFD0D5DD), Color(0xFFF2F4F7), Color(0xFF98A2B3), Color(0xFF344054));

  /// Cor do serviço gravada no banco (`services.color`)
  static Tone fromName(String? name) {
    switch (name) {
      case 'mint':
        return mint;
      case 'peach':
        return peach;
      case 'lilac':
        return lilac;
      case 'sun':
        return sun;
      case 'rose':
        return rose;
      default:
        return neutral;
    }
  }
}
