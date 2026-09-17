import 'package:flutter_test/flutter_test.dart';

import 'package:projeto/core/theme/app_colors.dart';
import 'package:projeto/models/appointment.dart';
import 'package:projeto/models/enums.dart';
import 'package:projeto/models/queue_entry.dart';

void main() {
  test('cor do serviço gravada no banco vira o mesmo tom do sistema web', () {
    expect(Tone.fromName('mint'), Tone.mint);
    expect(Tone.fromName('lilac'), Tone.lilac);
    expect(Tone.fromName('cor-desconhecida'), Tone.neutral);
    expect(Tone.fromName(null), Tone.neutral);
  });

  test('confirmação de presença só aparece para consulta futura, agendada e não confirmada', () {
    Appointment build({required DateTime at, AppointmentStatus status = AppointmentStatus.agendado, DateTime? confirmed}) =>
        Appointment(id: '1', patientId: 'p', scheduledFor: at, status: status, confirmedByGuardianAt: confirmed);

    final amanha = DateTime.now().add(const Duration(days: 1));
    final ontem = DateTime.now().subtract(const Duration(days: 1));

    expect(build(at: amanha).needsGuardianConfirmation, isTrue);
    expect(build(at: ontem).needsGuardianConfirmation, isFalse);
    expect(build(at: amanha, status: AppointmentStatus.cancelado).needsGuardianConfirmation, isFalse);
    expect(build(at: amanha, confirmed: DateTime.now()).needsGuardianConfirmation, isFalse);
  });

  test('fila lê a view v_queue_ranked com posição e motivo', () {
    final entry = QueueEntry.fromMap({
      'id': 'q1',
      'patient_id': 'p1',
      'priority': 'P1',
      'status': 'aguardando',
      'entered_at': '2026-09-01T10:00:00Z',
      'wait_days': 16,
      'queue_position': 2,
      'rank_reason': 'P1 Urgente (+300) + 16 dias de espera',
    });
    expect(entry.priority, PriorityLevel.p1);
    expect(entry.status, QueueStatus.aguardando);
    expect(entry.queuePosition, 2);
    expect(entry.waitDays, 16);
  });
}
