import 'enums.dart';

/// Espelha a view `public.v_agenda` (appointments já com os nomes
/// resolvidos de paciente/serviço/profissional/especialidade).
class Appointment {
  final String id;
  final String patientId;
  final String? patientName;
  final String? serviceName;
  final String? serviceColor;
  final String? professionalName;
  final String? specialtyName;
  final DateTime scheduledFor;
  final int? durationMinutes;
  final AppointmentStatus status;
  final DateTime? confirmedByGuardianAt;

  const Appointment({
    required this.id,
    required this.patientId,
    required this.scheduledFor,
    required this.status,
    this.patientName,
    this.serviceName,
    this.serviceColor,
    this.professionalName,
    this.specialtyName,
    this.durationMinutes,
    this.confirmedByGuardianAt,
  });

  factory Appointment.fromMap(Map<String, dynamic> map) {
    return Appointment(
      id: map['id'] as String,
      patientId: map['patient_id'] as String,
      patientName: map['patient_name'] as String?,
      serviceName: map['service_name'] as String?,
      serviceColor: map['service_color'] as String?,
      professionalName: map['professional_name'] as String?,
      specialtyName: map['specialty_name'] as String?,
      scheduledFor: DateTime.parse(map['scheduled_for'] as String),
      durationMinutes: map['duration_minutes'] as int?,
      status: AppointmentStatusX.fromDb(map['status'] as String),
      confirmedByGuardianAt: map['confirmed_by_guardian_at'] != null
          ? DateTime.tryParse(map['confirmed_by_guardian_at'] as String)
          : null,
    );
  }

  bool get needsGuardianConfirmation =>
      confirmedByGuardianAt == null && status == AppointmentStatus.agendado && scheduledFor.isAfter(DateTime.now());
}
