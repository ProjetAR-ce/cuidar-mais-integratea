import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/appointment.dart';
import '../../../widgets/cuidar_ui.dart';
import '../../../widgets/status_badges.dart';

/// Consulta (v_agenda) no mesmo desenho da agenda do sistema web: data em
/// destaque, faixa na cor do serviço, badges e confirmação de presença.
class AppointmentCard extends StatefulWidget {
  final Appointment appointment;
  final Future<void> Function() onConfirm;

  const AppointmentCard({super.key, required this.appointment, required this.onConfirm});

  @override
  State<AppointmentCard> createState() => _AppointmentCardState();
}

class _AppointmentCardState extends State<AppointmentCard> {
  bool _loading = false;

  @override
  Widget build(BuildContext context) {
    final a = widget.appointment;
    final local = a.scheduledFor.toLocal();
    final tone = Tone.fromName(a.serviceColor);

    return Container(
      decoration: cardDecoration(),
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(width: 6, color: tone.edge == Tone.neutral.edge ? AppColors.primary : tone.edge),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 14, 4, 14),
              child: SizedBox(
                width: 54,
                child: Column(
                  children: [
                    Text(DateFormat('EEE', 'pt_BR').format(local).replaceAll('.', '').toUpperCase(), style: AppTextStyles.label.copyWith(fontSize: 11, color: AppColors.secondaryText)),
                    Text(DateFormat('dd').format(local), style: AppTextStyles.displayLg.copyWith(fontSize: 28, fontWeight: FontWeight.w800, height: 1.1)),
                    Text(DateFormat('MMM', 'pt_BR').format(local).replaceAll('.', ''), style: AppTextStyles.label.copyWith(fontSize: 12, color: AppColors.secondaryText)),
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(8)),
                      child: Text(DateFormat('HH:mm').format(local), style: AppTextStyles.label.copyWith(fontSize: 12, color: AppColors.primaryInk, fontWeight: FontWeight.w800)),
                    ),
                  ],
                ),
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(8, 14, 14, 14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(a.specialtyName ?? 'Atendimento', style: AppTextStyles.subtitle.copyWith(fontSize: 16, fontWeight: FontWeight.w700)),
                    if (a.professionalName != null)
                      Text(a.professionalName!, style: AppTextStyles.bodySm.copyWith(color: AppColors.secondaryText)),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        if (a.serviceName != null) ServiceChip(name: a.serviceName!, color: a.serviceColor),
                        AppointmentStatusBadge(status: a.status),
                        if (a.confirmedByGuardianAt != null) const ToneBadge(label: 'Você confirmou', tone: Tone.mint, icon: Icons.verified_rounded),
                      ],
                    ),
                    if (a.needsGuardianConfirmation) ...[
                      const SizedBox(height: 10),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: _loading
                              ? null
                              : () async {
                                  setState(() => _loading = true);
                                  await widget.onConfirm();
                                  if (mounted) setState(() => _loading = false);
                                },
                          icon: _loading
                              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                              : const Icon(Icons.check_circle_rounded, size: 18),
                          label: const Text('Confirmar presença'),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
