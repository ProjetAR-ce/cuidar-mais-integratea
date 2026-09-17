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
      case 'atendimento':
        return 'Atendimento';
      default:
        return _humanize(eventType);
    }
  }

  /// Tipos gravados pelo sistema web (ex.: `atendimento_realizado`) viram texto legível.
  static String _humanize(String type) {
    const known = {
      'atendimento_realizado': 'Atendimento realizado',
      'agendamento': 'Agendamento',
      'confirmacao_familia': 'Presença confirmada',
      'falta': 'Falta registrada',
      'encaminhamento': 'Encaminhamento',
      'triagem': 'Triagem',
      'cadastro': 'Cadastro',
      'plano_cuidado': 'Plano de cuidado',
      'nota': 'Anotação da equipe',
    };
    final t = known[type] ?? type.replaceAll('_', ' ');
    return t.isEmpty ? 'Registro' : t[0].toUpperCase() + t.substring(1);
  }
}
