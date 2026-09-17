import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/journey_event.dart';

/// Trilha da jornada (igual à página do paciente no sistema web):
/// Entrada → Triagem → Fila → Atendimento → Continuidade.
class CareJourneyStepper extends StatelessWidget {
  final List<JourneyEvent> events;

  const CareJourneyStepper({super.key, required this.events});

  static const _stages = [
    ('entrada', 'Entrada', 'Cadastro', Icons.person_rounded, Tone.rose),
    ('triagem', 'Triagem', 'Prioridade', Icons.assignment_rounded, Tone.peach),
    ('fila', 'Fila', 'Especialidade', Icons.format_list_numbered_rounded, Tone.lilac),
    ('atendimento', 'Atendimento', 'Sessão', Icons.event_available_rounded, Tone.mint),
    ('continuidade', 'Continuidade', 'Encaminhar', Icons.send_rounded, Tone.sun),
  ];

  @override
  Widget build(BuildContext context) {
    final present = events.map((e) => e.stage).toSet();
    final done = [
      true,
      present.contains('triagem') || present.contains('fila'),
      present.contains('fila'),
      events.any((e) => e.eventType == 'atendimento_realizado'),
      present.contains('continuidade'),
    ];
    final current = done.lastIndexWhere((d) => d).clamp(0, 4);

    return LayoutBuilder(
      builder: (context, c) {
        final step = c.maxWidth / 5;
        return SizedBox(
          height: 96,
          child: Stack(
            children: [
              Positioned(
                left: step / 2,
                right: step / 2,
                top: 22,
                child: Container(height: 5, decoration: BoxDecoration(color: AppColors.surface2, borderRadius: BorderRadius.circular(5))),
              ),
              Positioned(
                left: step / 2,
                top: 22,
                child: TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0, end: current / 4),
                  duration: const Duration(milliseconds: 900),
                  curve: Curves.easeOutCubic,
                  builder: (context, v, _) => Container(
                    width: (c.maxWidth - step) * v,
                    height: 5,
                    decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(5)),
                  ),
                ),
              ),
              Row(
                children: [
                  for (var i = 0; i < 5; i++)
                    SizedBox(
                      width: step,
                      child: Column(
                        children: [
                          Stack(
                            clipBehavior: Clip.none,
                            children: [
                              AnimatedScale(
                                scale: i == current ? 1.1 : 1,
                                duration: const Duration(milliseconds: 300),
                                child: Container(
                                  width: 48,
                                  height: 48,
                                  decoration: BoxDecoration(
                                    color: done[i] ? _stages[i].$5.base : AppColors.surface2,
                                    shape: BoxShape.circle,
                                    border: Border.all(color: Colors.white, width: 4),
                                    boxShadow: i == current ? [BoxShadow(color: AppColors.primary.withValues(alpha: 0.25), blurRadius: 0, spreadRadius: 4)] : null,
                                  ),
                                  child: Icon(_stages[i].$4, size: 20, color: done[i] ? AppColors.primaryText : AppColors.inkFaint),
                                ),
                              ),
                              if (done[i])
                                Positioned(
                                  right: -2,
                                  bottom: -2,
                                  child: Container(
                                    decoration: const BoxDecoration(color: Color(0xFF067647), shape: BoxShape.circle),
                                    padding: const EdgeInsets.all(2),
                                    child: const Icon(Icons.check_rounded, size: 13, color: Colors.white),
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          FittedBox(fit: BoxFit.scaleDown, child: Text(_stages[i].$2, maxLines: 1, style: AppTextStyles.label.copyWith(fontSize: 11.5, color: done[i] ? AppColors.primaryText : AppColors.secondaryText, fontWeight: FontWeight.w700))),
                          FittedBox(fit: BoxFit.scaleDown, child: Text(_stages[i].$3, maxLines: 1, style: AppTextStyles.bodySm.copyWith(fontSize: 10, color: AppColors.secondaryText))),
                        ],
                      ),
                    ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}
