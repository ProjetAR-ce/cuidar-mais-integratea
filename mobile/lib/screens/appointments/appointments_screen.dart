import 'package:flutter/material.dart';

import '../../core/data/care_repository.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import '../../models/appointment.dart';
import '../../widgets/cuidar_ui.dart';
import '../../widgets/error_state.dart';
import 'widgets/appointment_card.dart';

/// Histórico completo de consultas do paciente (próximas e anteriores),
/// a partir da view `v_agenda`.
class AppointmentsScreen extends StatefulWidget {
  final String patientId;

  const AppointmentsScreen({super.key, required this.patientId});

  @override
  State<AppointmentsScreen> createState() => _AppointmentsScreenState();
}

class _AppointmentsScreenState extends State<AppointmentsScreen> {
  final _repository = CareRepository();
  late Future<List<Appointment>> _future;

  @override
  void initState() {
    super.initState();
    _future = _fetch();
  }

  Future<List<Appointment>> _fetch() => _repository.fetchAppointments(widget.patientId, upcomingOnly: false);

  Future<void> _confirm(Appointment appointment) async {
    try {
      await _repository.confirmAppointment(appointment.id);
      if (!mounted) return;
      showCelebration(context, 'Presença confirmada!');
      setState(() => _future = _fetch());
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        title: Text('Consultas', style: AppTextStyles.titleLg.copyWith(fontWeight: FontWeight.w800)),
      ),
      body: FutureBuilder<List<Appointment>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator(color: AppColors.primary));
          }
          if (snapshot.hasError) {
            return ErrorState(error: snapshot.error, onRetry: () => setState(() => _future = _fetch()));
          }
          final all = snapshot.data!;
          final now = DateTime.now();
          final upcoming = all.where((a) => a.scheduledFor.isAfter(now)).toList();
          final past = all.where((a) => !a.scheduledFor.isAfter(now)).toList().reversed.toList();

          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async => setState(() => _future = _fetch()),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
              children: [
                _heading('Próximas', upcoming.length),
                if (upcoming.isEmpty)
                  const EmptyCard(title: 'Nenhuma consulta agendada', description: 'Quando o serviço agendar, ela aparece aqui.')
                else
                  for (final a in upcoming) ...[AppointmentCard(appointment: a, onConfirm: () => _confirm(a)), const SizedBox(height: 12)],
                const SizedBox(height: 12),
                _heading('Anteriores', past.length),
                if (past.isEmpty)
                  const EmptyCard(title: 'Sem histórico ainda')
                else
                  for (final a in past) ...[AppointmentCard(appointment: a, onConfirm: () => _confirm(a)), const SizedBox(height: 12)],
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _heading(String title, int count) => Padding(
        padding: const EdgeInsets.only(bottom: 10, top: 4),
        child: Row(
          children: [
            Text(title, style: AppTextStyles.titleMd.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(width: 8),
            ToneBadge(label: '$count', tone: Tone.lilac),
          ],
        ),
      );
}
