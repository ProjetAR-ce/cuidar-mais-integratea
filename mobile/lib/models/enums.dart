import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';

/// Espelha o enum `public.user_role` do banco real.
enum UserRole { recepcao, profissional, coordenacao, gestao, admin, responsavel }

extension UserRoleX on UserRole {
  static UserRole fromDb(String value) => UserRole.values.firstWhere(
        (r) => r.name == value,
        orElse: () => UserRole.responsavel,
      );

  bool get isStaff => this != UserRole.responsavel;
}

/// Espelha `public.appointment_status`.
enum AppointmentStatus { agendado, presente, faltaJustificada, faltaInjustificada, cancelado }

extension AppointmentStatusX on AppointmentStatus {
  static AppointmentStatus fromDb(String value) {
    switch (value) {
      case 'agendado':
        return AppointmentStatus.agendado;
      case 'presente':
        return AppointmentStatus.presente;
      case 'falta_justificada':
        return AppointmentStatus.faltaJustificada;
      case 'falta_injustificada':
        return AppointmentStatus.faltaInjustificada;
      case 'cancelado':
        return AppointmentStatus.cancelado;
      default:
        return AppointmentStatus.agendado;
    }
  }

  String get label {
    switch (this) {
      case AppointmentStatus.agendado:
        return 'Agendado';
      case AppointmentStatus.presente:
        return 'Compareceu';
      case AppointmentStatus.faltaJustificada:
        return 'Falta justificada';
      case AppointmentStatus.faltaInjustificada:
        return 'Falta não justificada';
      case AppointmentStatus.cancelado:
        return 'Cancelado';
    }
  }

  Color get color {
    switch (this) {
      case AppointmentStatus.agendado:
        return AppColors.lavender;
      case AppointmentStatus.presente:
        return AppColors.mint;
      case AppointmentStatus.faltaJustificada:
        return AppColors.pastelYellow;
      case AppointmentStatus.faltaInjustificada:
        return AppColors.peach;
      case AppointmentStatus.cancelado:
        return AppColors.primaryText;
    }
  }
}

/// Espelha `public.priority_level` (usado em triagem, fila e encaminhamentos).
enum PriorityLevel { p1, p2, p3 }

extension PriorityLevelX on PriorityLevel {
  static PriorityLevel fromDb(String value) {
    switch (value) {
      case 'P1':
        return PriorityLevel.p1;
      case 'P2':
        return PriorityLevel.p2;
      default:
        return PriorityLevel.p3;
    }
  }

  String get dbValue => switch (this) { PriorityLevel.p1 => 'P1', PriorityLevel.p2 => 'P2', PriorityLevel.p3 => 'P3' };

  String get label {
    switch (this) {
      case PriorityLevel.p1:
        return 'Prioridade alta';
      case PriorityLevel.p2:
        return 'Prioridade média';
      case PriorityLevel.p3:
        return 'Prioridade normal';
    }
  }

  Color get color {
    switch (this) {
      case PriorityLevel.p1:
        return AppColors.peach;
      case PriorityLevel.p2:
        return AppColors.pastelYellow;
      case PriorityLevel.p3:
        return AppColors.mint;
    }
  }
}

/// Espelha `public.queue_status`.
enum QueueStatus { aguardando, emAtendimento, concluido, cancelado }

extension QueueStatusX on QueueStatus {
  static QueueStatus fromDb(String value) {
    switch (value) {
      case 'aguardando':
        return QueueStatus.aguardando;
      case 'em_atendimento':
        return QueueStatus.emAtendimento;
      case 'concluido':
        return QueueStatus.concluido;
      default:
        return QueueStatus.cancelado;
    }
  }

  String get label {
    switch (this) {
      case QueueStatus.aguardando:
        return 'Aguardando';
      case QueueStatus.emAtendimento:
        return 'Em atendimento';
      case QueueStatus.concluido:
        return 'Concluído';
      case QueueStatus.cancelado:
        return 'Cancelado';
    }
  }
}

/// Espelha `public.referral_status`.
enum ReferralStatus { pendente, aceito, devolvido, complementoSolicitado }

extension ReferralStatusX on ReferralStatus {
  static ReferralStatus fromDb(String value) {
    switch (value) {
      case 'pendente':
        return ReferralStatus.pendente;
      case 'aceito':
        return ReferralStatus.aceito;
      case 'devolvido':
        return ReferralStatus.devolvido;
      default:
        return ReferralStatus.complementoSolicitado;
    }
  }

  String get label {
    switch (this) {
      case ReferralStatus.pendente:
        return 'Pendente';
      case ReferralStatus.aceito:
        return 'Aceito';
      case ReferralStatus.devolvido:
        return 'Devolvido';
      case ReferralStatus.complementoSolicitado:
        return 'Complemento solicitado';
    }
  }
}
