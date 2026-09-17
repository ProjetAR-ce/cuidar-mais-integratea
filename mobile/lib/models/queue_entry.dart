import 'enums.dart';

/// Espelha a view `public.v_queue_ranked` (fila de atendimento já com
/// posição calculada, nome do paciente/serviço e tempo de espera).
class QueueEntry {
  final String id;
  final String patientId;
  final String? patientName;
  final String? serviceName;
  final String? serviceColor;
  final String? specialtyName;
  final PriorityLevel priority;
  final QueueStatus status;
  final DateTime enteredAt;
  final int? waitDays;
  final int? queuePosition;
  final String? rankReason;

  const QueueEntry({
    required this.id,
    required this.patientId,
    required this.priority,
    required this.status,
    required this.enteredAt,
    this.patientName,
    this.serviceName,
    this.serviceColor,
    this.specialtyName,
    this.waitDays,
    this.queuePosition,
    this.rankReason,
  });

  factory QueueEntry.fromMap(Map<String, dynamic> map) {
    return QueueEntry(
      id: map['id'] as String,
      patientId: map['patient_id'] as String,
      patientName: map['patient_name'] as String?,
      serviceName: map['service_name'] as String?,
      serviceColor: map['service_color'] as String?,
      specialtyName: map['specialty_name'] as String?,
      priority: PriorityLevelX.fromDb(map['priority'] as String),
      status: QueueStatusX.fromDb(map['status'] as String),
      enteredAt: DateTime.parse(map['entered_at'] as String),
      waitDays: (map['wait_days'] as num?)?.toInt(),
      queuePosition: (map['queue_position'] as num?)?.toInt(),
      rankReason: map['rank_reason'] as String?,
    );
  }
}
