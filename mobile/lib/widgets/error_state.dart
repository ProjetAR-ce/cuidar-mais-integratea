import 'package:flutter/material.dart';

import '../core/auth/auth_repository.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_text_styles.dart';
import 'cuidar_ui.dart';

/// Estado de erro visível — usado sempre que uma consulta ao Supabase falha,
/// para nunca mascarar um problema real de conexão/permissão com dado falso.
class ErrorState extends StatelessWidget {
  final Object? error;
  final VoidCallback onRetry;

  const ErrorState({super.key, required this.error, required this.onRetry});

  String get _message {
    final e = error;
    if (e is CuidarAuthException) return e.message;
    return 'Não foi possível carregar os dados: $e';
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const IconBubble(icon: Icons.cloud_off_rounded, tone: Tone.rose, size: 68),
            const SizedBox(height: 14),
            Text('Algo não carregou', style: AppTextStyles.titleMd),
            const SizedBox(height: 6),
            Text(_message, style: AppTextStyles.bodySm.copyWith(color: AppColors.secondaryText), textAlign: TextAlign.center),
            const SizedBox(height: 16),
            ElevatedButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh_rounded), label: const Text('Tentar novamente')),
          ],
        ),
      ),
    );
  }
}
