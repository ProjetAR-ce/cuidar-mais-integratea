import 'package:supabase_flutter/supabase_flutter.dart';

import '../../models/appointment.dart';
import '../../models/care_plan.dart';
import '../../models/journey_event.dart';
import '../../models/notification_item.dart';
import '../../models/patient.dart';
import '../../models/post.dart';
import '../../models/queue_entry.dart';
import '../../models/referral.dart';
import '../auth/auth_repository.dart';
import '../supabase/supabase_config.dart';

/// Camada de acesso a dados do Cuidar+, sobre o schema REAL do Supabase
class CareRepository {
  CareRepository();

  SupabaseClient get _client => SupabaseConfig.client;

  Never _fail(String action, Object error) {
    if (error is PostgrestException) {
      throw CuidarAuthException('Falha ao $action (${error.code ?? '?'}): ${error.message}');
    }
    throw CuidarAuthException('Falha ao $action: $error');
  }

  /// Pacientes vinculados ao responsável autenticado (`patients.responsible_id`).
  Future<List<Patient>> fetchMyPatients(String responsibleProfileId) async {
    try {
      final rows = await _client
          .from('patients')
          .select()
          .eq('responsible_id', responsibleProfileId)
          .order('full_name');
      return rows.map(Patient.fromMap).toList();
    } catch (e) {
      _fail('carregar seus dependentes', e);
    }
  }

  /// Jornada mais recente primeiro (a trilha usa as etapas; a lista, os últimos eventos).
  Future<List<JourneyEvent>> fetchJourney(String patientId, {int limit = 300}) async {
    try {
      final rows = await _client
          .from('journey_events')
          .select()
          .eq('patient_id', patientId)
          .order('created_at', ascending: false)
          .limit(limit);
      return rows.map(JourneyEvent.fromMap).toList();
    } catch (e) {
      _fail('carregar a jornada do cuidado', e);
    }
  }

  Future<List<Appointment>> fetchAppointments(String patientId, {bool upcomingOnly = true}) async {
    try {
      var query = _client.from('v_agenda').select().eq('patient_id', patientId);
      if (upcomingOnly) {
        query = query.gte('scheduled_for', DateTime.now().toIso8601String());
      }
      final rows = await query.order('scheduled_for');
      return rows.map(Appointment.fromMap).toList();
    } catch (e) {
      _fail('carregar os atendimentos', e);
    }
  }

  Future<void> confirmAppointment(String appointmentId) async {
    try {
      await _client.rpc('confirm_appointment_attendance', params: {'p_appointment_id': appointmentId});
    } catch (e) {
      _fail('confirmar presença', e);
    }
  }

  Future<List<QueueEntry>> fetchQueueStatus(String patientId) async {
    try {
      final rows = await _client.from('v_queue_ranked').select().eq('patient_id', patientId);
      return rows.map(QueueEntry.fromMap).toList();
    } catch (e) {
      _fail('carregar a posição na fila', e);
    }
  }

  Future<List<CarePlan>> fetchCarePlans(String patientId) async {
    try {
      final planRows = await _client
          .from('care_plans')
          .select()
          .eq('patient_id', patientId)
          .order('created_at', ascending: false);

      final plans = <CarePlan>[];
      for (final planRow in planRows) {
        final itemRows = await _client
            .from('care_plan_items')
            .select()
            .eq('plan_id', planRow['id'] as String)
            .order('due_date');
        final items = itemRows.map(CarePlanItem.fromMap).toList();
        plans.add(CarePlan.fromMap(planRow, items: items));
      }
      return plans;
    } catch (e) {
      _fail('carregar o prontuário', e);
    }
  }

  Future<List<Referral>> fetchReferrals(String patientId) async {
    try {
      final rows = await _client
          .from('referrals')
          .select()
          .eq('patient_id', patientId)
          .order('created_at', ascending: false);
      return rows.map(Referral.fromMap).toList();
    } catch (e) {
      _fail('carregar os encaminhamentos', e);
    }
  }

  Future<List<NotificationItem>> fetchNotifications(String profileId) async {
    try {
      final rows = await _client
          .from('notifications')
          .select()
          .eq('profile_id', profileId)
          .order('created_at', ascending: false);
      return rows.map(NotificationItem.fromMap).toList();
    } catch (e) {
      _fail('carregar notificações', e);
    }
  }

  Future<void> markNotificationRead(String notificationId) async {
    try {
      await _client
          .from('notifications')
          .update({'is_read': true, 'read_at': DateTime.now().toIso8601String()}).eq('id', notificationId);
    } catch (e) {
      _fail('marcar notificação como lida', e);
    }
  }

  Future<List<Post>> fetchPublishedPosts() async {
    try {
      final rows = await _client
          .from('posts')
          .select()
          .eq('status', 'published')
          .order('published_at', ascending: false);
      return rows.map(Post.fromMap).toList();
    } catch (e) {
      _fail('carregar as notícias', e);
    }
  }
}
