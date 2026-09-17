import 'package:flutter/material.dart';

import '../../core/auth/auth_repository.dart';
import '../../core/data/care_repository.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import '../../models/patient.dart';
import '../../models/profile.dart';
import '../../widgets/cuidar_ui.dart';
import '../auth/login_screen.dart';
import '../home/home_screen.dart';
import '../medical_record/medical_record_screen.dart';
import '../news/news_screen.dart';
import '../notifications/notifications_screen.dart';
import '../queue/queue_screen.dart';

/// Casca do app autenticado: carrega o perfil + dependentes do responsável
/// uma única vez e distribui para as 5 abas via navegação inferior.
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  final _authRepository = AuthRepository();
  final _careRepository = CareRepository();

  int _tabIndex = 0;
  String? _selectedPatientId;
  late Future<_ShellData> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_ShellData> _load() async {
    final profile = await _authRepository.fetchCurrentProfile();
    final patients = await _careRepository.fetchMyPatients(profile.id);
    if (patients.isNotEmpty && !patients.any((p) => p.id == _selectedPatientId)) {
      _selectedPatientId = patients.first.id;
    }
    return _ShellData(profile: profile, patients: patients);
  }

  Future<void> _signOut() async {
    await _authRepository.signOut();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const LoginScreen()), (_) => false);
  }

  void _pickPatient(List<Patient> patients) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(child: Container(width: 40, height: 5, decoration: BoxDecoration(color: AppColors.lineStrong, borderRadius: BorderRadius.circular(9)))),
              const SizedBox(height: 16),
              Text('Acompanhar quem?', style: AppTextStyles.titleMd),
              const SizedBox(height: 8),
              for (final p in patients)
                ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  tileColor: p.id == _selectedPatientId ? AppColors.primarySoft : null,
                  leading: _Avatar(name: p.displayName),
                  title: Text(p.displayName, style: AppTextStyles.subtitle),
                  trailing: p.id == _selectedPatientId ? const Icon(Icons.check_circle_rounded, color: AppColors.primary) : null,
                  onTap: () {
                    setState(() => _selectedPatientId = p.id);
                    Navigator.pop(context);
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<_ShellData>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Scaffold(body: Center(child: CircularProgressIndicator(color: AppColors.primary)));
        }
        if (snapshot.hasError) {
          return _ErrorScaffold(
            message: snapshot.error is CuidarAuthException
                ? (snapshot.error as CuidarAuthException).message
                : 'Não foi possível conectar ao Cuidar+: ${snapshot.error}',
            onRetry: () => setState(() => _future = _load()),
            onSignOut: _signOut,
          );
        }

        final data = snapshot.data!;
        final patient = data.patients.where((p) => p.id == _selectedPatientId).firstOrNull;

        final tabs = <Widget>[
          patient != null
              ? HomeScreen(
                  key: ValueKey('home-${patient.id}'),
                  patient: patient,
                  profileId: data.profile.id,
                  profileName: data.profile.fullName,
                  onNavigate: (tab) => setState(() => _tabIndex = tab),
                )
              : const _NoPatientLinked(),
          patient != null ? QueueScreen(key: ValueKey('queue-${patient.id}'), patientId: patient.id) : const _NoPatientLinked(),
          patient != null ? MedicalRecordScreen(key: ValueKey('record-${patient.id}'), patientId: patient.id) : const _NoPatientLinked(),
          NotificationsScreen(profileId: data.profile.id),
          const NewsScreen(),
        ];

        return Scaffold(
          backgroundColor: AppColors.background,
          body: SafeArea(
            bottom: false,
            child: Column(
              children: [
                _Header(
                  profile: data.profile,
                  patient: patient,
                  canSwitch: data.patients.length > 1,
                  onSwitch: () => _pickPatient(data.patients),
                  onSignOut: _signOut,
                ),
                Expanded(child: IndexedStack(index: _tabIndex, children: tabs)),
              ],
            ),
          ),
          bottomNavigationBar: _BottomNav(index: _tabIndex, onTap: (i) => setState(() => _tabIndex = i)),
        );
      },
    );
  }
}

class _Header extends StatelessWidget {
  final Profile profile;
  final Patient? patient;
  final bool canSwitch;
  final VoidCallback onSwitch;
  final VoidCallback onSignOut;

  const _Header({required this.profile, required this.patient, required this.canSwitch, required this.onSwitch, required this.onSignOut});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 8, 10),
      decoration: const BoxDecoration(color: Colors.white, border: Border(bottom: BorderSide(color: AppColors.line))),
      child: Row(
        children: [
          Image.asset('assets/brand/symbol.png', width: 34),
          const SizedBox(width: 8),
          Text('Cuidar+', style: AppTextStyles.titleLg.copyWith(color: AppColors.primary, fontWeight: FontWeight.w800, fontSize: 22)),
          const Spacer(),
          if (patient != null)
            Flexible(
              child: InkWell(
                borderRadius: BorderRadius.circular(999),
                onTap: canSwitch ? onSwitch : null,
                child: Container(
                  padding: const EdgeInsets.fromLTRB(4, 4, 10, 4),
                  decoration: BoxDecoration(color: AppColors.surface2, borderRadius: BorderRadius.circular(999)),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _Avatar(name: patient!.displayName, size: 26),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(patient!.displayName.split(' ').first,
                            overflow: TextOverflow.ellipsis, style: AppTextStyles.label.copyWith(fontWeight: FontWeight.w700)),
                      ),
                      if (canSwitch) const Icon(Icons.unfold_more_rounded, size: 16, color: AppColors.secondaryText),
                    ],
                  ),
                ),
              ),
            ),
          PopupMenuButton<String>(
            tooltip: 'Conta',
            icon: const Icon(Icons.more_vert_rounded, color: AppColors.secondaryText),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            color: Colors.white,
            onSelected: (v) {
              if (v == 'sair') onSignOut();
            },
            itemBuilder: (_) => [
              PopupMenuItem(
                enabled: false,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(profile.fullName, style: AppTextStyles.subtitle),
                    Text('Responsável', style: AppTextStyles.bodySm.copyWith(color: AppColors.secondaryText)),
                  ],
                ),
              ),
              const PopupMenuDivider(),
              PopupMenuItem(
                value: 'sair',
                child: Row(children: [
                  const Icon(Icons.logout_rounded, size: 18, color: AppColors.rose),
                  const SizedBox(width: 8),
                  Text('Sair da conta', style: AppTextStyles.subtitle.copyWith(color: AppColors.rose)),
                ]),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  final String name;
  final double size;
  const _Avatar({required this.name, this.size = 40});

  @override
  Widget build(BuildContext context) {
    final parts = name.trim().split(RegExp(r'\s+'));
    final initials = (parts.first[0] + (parts.length > 1 ? parts.last[0] : '')).toUpperCase();
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
      child: Text(initials, style: AppTextStyles.label.copyWith(color: Colors.white, fontSize: size * 0.38, fontWeight: FontWeight.w800, height: 1)),
    );
  }
}

/// Barra inferior no estilo do site: ícone em pílula lilás quando ativo.
class _BottomNav extends StatelessWidget {
  final int index;
  final ValueChanged<int> onTap;
  const _BottomNav({required this.index, required this.onTap});

  static const _items = [
    (Icons.home_outlined, Icons.home_rounded, 'Início'),
    (Icons.format_list_numbered_rounded, Icons.format_list_numbered_rounded, 'Fila'),
    (Icons.folder_shared_outlined, Icons.folder_shared_rounded, 'Prontuário'),
    (Icons.notifications_none_rounded, Icons.notifications_rounded, 'Avisos'),
    (Icons.newspaper_outlined, Icons.newspaper_rounded, 'Notícias'),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: AppColors.line))),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
          child: Row(
            children: [
              for (var i = 0; i < _items.length; i++)
                Expanded(
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () => onTap(i),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          AnimatedContainer(
                            duration: const Duration(milliseconds: 220),
                            curve: Curves.easeOutBack,
                            padding: EdgeInsets.symmetric(horizontal: i == index ? 18 : 10, vertical: 5),
                            decoration: BoxDecoration(color: i == index ? AppColors.primarySoft : Colors.transparent, borderRadius: BorderRadius.circular(999)),
                            child: Icon(i == index ? _items[i].$2 : _items[i].$1, size: 24, color: i == index ? AppColors.primary : AppColors.inkFaint),
                          ),
                          const SizedBox(height: 2),
                          Text(_items[i].$3,
                              maxLines: 1,
                              style: AppTextStyles.label.copyWith(
                                fontSize: 11.5,
                                color: i == index ? AppColors.primary : AppColors.secondaryText,
                                fontWeight: i == index ? FontWeight.w800 : FontWeight.w600,
                              )),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ShellData {
  final Profile profile;
  final List<Patient> patients;
  const _ShellData({required this.profile, required this.patients});
}

class _NoPatientLinked extends StatelessWidget {
  const _NoPatientLinked();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(16),
      child: Center(
        child: EmptyCard(
          title: 'Nenhum dependente vinculado',
          description: 'Procure a unidade de saúde para associar o cadastro da criança à sua conta.',
        ),
      ),
    );
  }
}

class _ErrorScaffold extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  final VoidCallback onSignOut;

  const _ErrorScaffold({required this.message, required this.onRetry, required this.onSignOut});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const IconBubble(icon: Icons.wifi_off_rounded, tone: Tone.rose, size: 72),
              const SizedBox(height: 16),
              Text('Não foi possível conectar', style: AppTextStyles.titleMd, textAlign: TextAlign.center),
              const SizedBox(height: 8),
              Text(message, style: AppTextStyles.bodySm.copyWith(color: AppColors.secondaryText), textAlign: TextAlign.center),
              const SizedBox(height: 20),
              ElevatedButton(onPressed: onRetry, child: const Text('Tentar novamente')),
              TextButton(onPressed: onSignOut, child: const Text('Sair da conta')),
            ],
          ),
        ),
      ),
    );
  }
}
