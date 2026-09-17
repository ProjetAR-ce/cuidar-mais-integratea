/// Espelha `public.patients` (colunas relevantes para o app do responsável).
class Patient {
  final String id;
  final String fullName;
  final String? socialName;
  final DateTime? birthDate;
  final String? guardianName;
  final String? guardianPhone;
  final String? guardianRelationship;
  final String? schoolName;
  final String? status;
  final String? apsReference;

  const Patient({
    required this.id,
    required this.fullName,
    this.socialName,
    this.birthDate,
    this.guardianName,
    this.guardianPhone,
    this.guardianRelationship,
    this.schoolName,
    this.status,
    this.apsReference,
  });

  factory Patient.fromMap(Map<String, dynamic> map) {
    return Patient(
      id: map['id'] as String,
      fullName: map['full_name'] as String,
      socialName: map['social_name'] as String?,
      birthDate: map['birth_date'] != null ? DateTime.tryParse(map['birth_date'] as String) : null,
      guardianName: map['guardian_name'] as String?,
      guardianPhone: map['guardian_phone'] as String?,
      guardianRelationship: map['guardian_relationship'] as String?,
      schoolName: map['school_name'] as String?,
      status: map['status'] as String?,
      apsReference: map['aps_reference'] as String?,
    );
  }

  String get displayName => (socialName != null && socialName!.trim().isNotEmpty) ? socialName! : fullName;
}
