import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'core/supabase/supabase_config.dart';
import 'core/theme/app_theme.dart';
import 'screens/splash/splash_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('pt_BR', null);

  try {
    await SupabaseConfig.initialize();
  } catch (e) {
    // initialize() só configura o cliente local; se isso falhar, algo está
    // seriamente errado com a URL/anon key — deixa visível no console em vez
    // de esconder o problema.
    debugPrint('Falha ao inicializar Supabase: $e');
  }

  runApp(const CuidarApp());
}

class CuidarApp extends StatelessWidget {
  const CuidarApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Cuidar+',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      home: const SplashScreen(),
    );
  }
}
