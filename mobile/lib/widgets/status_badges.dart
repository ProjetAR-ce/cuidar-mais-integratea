import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';
import '../models/enums.dart';
import 'cuidar_ui.dart';

/// Estados sempre com cor + ícone + texto, iguais ao sistema web.

class PriorityBadge extends StatelessWidget {
  final PriorityLevel priority;
  final bool short;
  const PriorityBadge({super.key, required this.priority, this.short = false});

  @override
  Widget build(BuildContext context) {
    switch (priority) {
      case PriorityLevel.p1:
        return ToneBadge(label: short ? 'P1' : 'P1 · Urgente', tone: Tone.rose, icon: Icons.keyboard_double_arrow_up_rounded);
      case PriorityLevel.p2:
        return ToneBadge(label: short ? 'P2' : 'P2 · Curto prazo', tone: Tone.sun, icon: Icons.keyboard_arrow_up_rounded);
      case PriorityLevel.p3:
        return ToneBadge(label: short ? 'P3' : 'P3 · Lista de espera', tone: Tone.mint, icon: Icons.remove_rounded);
    }
  }
}

class AppointmentStatusBadge extends StatelessWidget {
  final AppointmentStatus status;
  const AppointmentStatusBadge({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    switch (status) {
      case AppointmentStatus.agendado:
        return const ToneBadge(label: 'Agendado', tone: Tone.lilac, icon: Icons.event_rounded);
      case AppointmentStatus.presente:
        return const ToneBadge(label: 'Presente', tone: Tone.mint, icon: Icons.check_circle_rounded);
      case AppointmentStatus.faltaJustificada:
        return const ToneBadge(label: 'Falta justificada', tone: Tone.sun, icon: Icons.help_outline_rounded);
      case AppointmentStatus.faltaInjustificada:
        return const ToneBadge(label: 'Falta', tone: Tone.rose, icon: Icons.person_off_rounded);
      case AppointmentStatus.cancelado:
        return const ToneBadge(label: 'Cancelado', tone: Tone.neutral, icon: Icons.cancel_rounded);
    }
  }
}

class QueueStatusBadge extends StatelessWidget {
  final QueueStatus status;
  const QueueStatusBadge({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    switch (status) {
      case QueueStatus.aguardando:
        return const ToneBadge(label: 'Aguardando', tone: Tone.sun, icon: Icons.schedule_rounded);
      case QueueStatus.emAtendimento:
        return const ToneBadge(label: 'Em acompanhamento', tone: Tone.lilac, icon: Icons.play_circle_rounded);
      case QueueStatus.concluido:
        return const ToneBadge(label: 'Concluído', tone: Tone.mint, icon: Icons.check_circle_rounded);
      case QueueStatus.cancelado:
        return const ToneBadge(label: 'Cancelado', tone: Tone.neutral, icon: Icons.cancel_rounded);
    }
  }
}

class ReferralStatusBadge extends StatelessWidget {
  final ReferralStatus status;
  const ReferralStatusBadge({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    switch (status) {
      case ReferralStatus.pendente:
        return const ToneBadge(label: 'Aguardando resposta', tone: Tone.sun, icon: Icons.schedule_rounded);
      case ReferralStatus.aceito:
        return const ToneBadge(label: 'Aceito', tone: Tone.mint, icon: Icons.check_circle_rounded);
      case ReferralStatus.devolvido:
        return const ToneBadge(label: 'Devolvido', tone: Tone.rose, icon: Icons.undo_rounded);
      case ReferralStatus.complementoSolicitado:
        return const ToneBadge(label: 'Complemento pedido', tone: Tone.peach, icon: Icons.help_outline_rounded);
    }
  }
}

class ServiceChip extends StatelessWidget {
  final String name;
  final String? color;
  const ServiceChip({super.key, required this.name, this.color});

  @override
  Widget build(BuildContext context) {
    final tone = Tone.fromName(color);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: tone.soft, borderRadius: BorderRadius.circular(999)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 7, height: 7, decoration: BoxDecoration(color: tone.edge, shape: BoxShape.circle)),
          const SizedBox(width: 5),
          Text(name, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: tone.ink, fontFamily: DefaultTextStyle.of(context).style.fontFamily)),
        ],
      ),
    );
  }
}

