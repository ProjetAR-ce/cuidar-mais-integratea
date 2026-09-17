import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/auth/auth_repository.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import '../../widgets/cuidar_ui.dart';
import '../auth/login_screen.dart';
import '../shell/app_shell.dart';

/// Abertura do Cuidar+: o símbolo da marca "pula" como no site.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  Timer? _navigationTimer;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100))..forward();

    _navigationTimer = Timer(const Duration(milliseconds: 1700), () {
      if (!mounted) return;
      final isLoggedIn = AuthRepository().isLoggedIn;
      Navigator.of(context).pushReplacement(
        PageRouteBuilder(
          transitionDuration: const Duration(milliseconds: 400),
          pageBuilder: (_, _, _) => isLoggedIn ? const AppShell() : const LoginScreen(),
          transitionsBuilder: (_, animation, _, child) => FadeTransition(opacity: animation, child: child),
        ),
      );
    });
  }

  @override
  void dispose() {
    _navigationTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final fade = CurvedAnimation(parent: _controller, curve: const Interval(0.35, 1, curve: Curves.easeOut));
    return Scaffold(
      backgroundColor: AppColors.primarySoft,
      body: Stack(
        children: [
          const Positioned(right: -60, top: -40, child: OrganicBlob(color: Color(0x40FDB022), size: 220, variant: 0)),
          const Positioned(left: -70, bottom: -50, child: OrganicBlob(color: Color(0x4075E0A7), size: 240, variant: 2)),
          const Positioned(left: -40, top: 120, child: OrganicBlob(color: Color(0x266B4EFF), size: 120, variant: 1)),
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ScaleTransition(
                  scale: CurvedAnimation(parent: _controller, curve: const Interval(0, 0.7, curve: Curves.elasticOut)),
                  child: Image.asset('assets/brand/symbol.png', width: 150),
                ),
                const SizedBox(height: 20),
                FadeTransition(
                  opacity: fade,
                  child: Text('Cuidar+', style: AppTextStyles.displayLg.copyWith(fontSize: 44, color: AppColors.primary, fontWeight: FontWeight.w800)),
                ),
                FadeTransition(
                  opacity: fade,
                  child: Text('Inovação que transforma o cuidado.', style: AppTextStyles.body.copyWith(color: AppColors.ink)),
                ),
              ],
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 32,
            child: SafeArea(
              child: FadeTransition(
                opacity: fade,
                child: Text('Rede IntegraTEA · Prefeitura de Crateús',
                    textAlign: TextAlign.center, style: AppTextStyles.bodySm.copyWith(color: AppColors.secondaryText)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
