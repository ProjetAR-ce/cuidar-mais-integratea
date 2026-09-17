/// Espelha `public.care_plans` — usado no Prontuário.
class CarePlan {
  final String id;
  final String patientId;
  final String? goal;
  final String status;
  final DateTime? reviewDueAt;
  final List<CarePlanItem> items;

  const CarePlan({
    required this.id,
    required this.patientId,
    required this.status,
    this.goal,
    this.reviewDueAt,
    this.items = const [],
  });

  factory CarePlan.fromMap(Map<String, dynamic> map, {List<CarePlanItem> items = const []}) {
    return CarePlan(
      id: map['id'] as String,
      patientId: map['patient_id'] as String,
      goal: map['goal'] as String?,
      status: map['status'] as String? ?? 'ativo',
      reviewDueAt: map['review_due_at'] != null ? DateTime.tryParse(map['review_due_at'] as String) : null,
      items: items,
    );
  }
}

/// Espelha `public.care_plan_items`.
class CarePlanItem {
  final String id;
  final String planId;
  final String? description;
  final String status;
  final DateTime? dueDate;
  final DateTime? completedAt;

  const CarePlanItem({
    required this.id,
    required this.planId,
    required this.status,
    this.description,
    this.dueDate,
    this.completedAt,
  });

  factory CarePlanItem.fromMap(Map<String, dynamic> map) {
    return CarePlanItem(
      id: map['id'] as String,
      planId: map['plan_id'] as String,
      description: map['description'] as String?,
      status: map['status'] as String? ?? 'pendente',
      dueDate: map['due_date'] != null ? DateTime.tryParse(map['due_date'] as String) : null,
      completedAt: map['completed_at'] != null ? DateTime.tryParse(map['completed_at'] as String) : null,
    );
  }

  bool get isDone => completedAt != null || status == 'concluido';
}
