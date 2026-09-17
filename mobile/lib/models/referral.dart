import 'enums.dart';

/// Espelha `public.referrals` (encaminhamentos entre serviços/especialidades).
class Referral {
  final String id;
  final String patientId;
  final String? reason;
  final PriorityLevel priority;
  final ReferralStatus status;
  final DateTime createdAt;

  const Referral({
    required this.id,
    required this.patientId,
    required this.priority,
    required this.status,
    required this.createdAt,
    this.reason,
  });

  factory Referral.fromMap(Map<String, dynamic> map) {
    return Referral(
      id: map['id'] as String,
      patientId: map['patient_id'] as String,
      reason: map['reason'] as String?,
      priority: PriorityLevelX.fromDb(map['priority'] as String),
      status: ReferralStatusX.fromDb(map['status'] as String),
      createdAt: DateTime.parse(map['created_at'] as String),
    );
  }
}
