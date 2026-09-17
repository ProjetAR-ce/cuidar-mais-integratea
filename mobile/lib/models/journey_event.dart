/// Espelha `public.journey_events` — histórico usado na "Jornada do Cuidado".
class JourneyEvent {
  final String id;
  final String patientId;
  final String eventType;
  final String? stage;
  final String? description;
  final DateTime createdAt;

  const JourneyEvent({
    required this.id,
    required this.patientId,
    required this.eventType,
    required this.createdAt,
    this.stage,
    this.description,
  });

  factory JourneyEvent.fromMap(Map<String, dynamic> map) {
    return JourneyEvent(
      id: map['id'] as String,
      patientId: map['patient_id'] as String,
      eventType: map['event_type'] as String,
      stage: map['stage'] as String?,
      description: map['description'] as String?,
      createdAt: DateTime.parse(map['created_at'] as String),
    );
  }

  /// `stage` é uma taxonomia fixa no banco (`entrada`, `triagem`, `fila`,
  /// `continuidade`, `alerta`) — mapeada aqui para rótulo legível.
  String get label {
    switch (stage) {
      case 'entrada':
        return 'Entrada';
      case 'triagem':
        return 'Triagem';
      case 'fila':
        return 'Fila de espera';
      case 'continuidade':
        return 'Continuidade do cuidado';
      case 'alerta':
        return 'Alerta';
      default:
        return eventType;
    }
  }
}
