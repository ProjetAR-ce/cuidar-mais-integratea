import 'package:flutter/material.dart';

import '../../core/auth/auth_repository.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import '../../widgets/cuidar_ui.dart';
import '../shell/app_shell.dart';

/// Login com e-mail/senha (Supabase Auth). Sem isso, a RLS bloqueia
/// qualquer leitura — o app não tem nenhum dado público.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _authRepository = AuthRepository();

  bool _loading = false;
  bool _obscure = true;
  String? _errorMessage;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _errorMessage = null;
    });

    try {
      await _authRepository.signInWithPassword(
        email: _emailController.text.trim(),
        password: _passwordController.text,
      );
      if (!mounted) return;
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const AppShell()));
    } on CuidarAuthException catch (e) {
      setState(() => _errorMessage = e.message == 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SingleChildScrollView(
        child: Column(
          children: [
            // Hero com a ilustração da família, como na tela de entrada do site
            Container(
              height: 300,
              width: double.infinity,
              color: AppColors.primarySoft,
              child: Stack(
                children: [
                  const Positioned(right: -50, top: -40, child: OrganicBlob(color: Color(0x33FDB022), size: 200, variant: 1)),
                  const Positioned(left: -60, bottom: -30, child: OrganicBlob(color: Color(0x3375E0A7), size: 180, variant: 2)),
                  Positioned.fill(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 70),
                      child: Image.asset('assets/brand/hero-family.jpg', fit: BoxFit.contain, colorBlendMode: BlendMode.multiply, color: AppColors.primarySoft),
                    ),
                  ),
                  const SafeArea(
                    child: Padding(padding: EdgeInsets.fromLTRB(20, 16, 20, 0), child: BrandLogo(symbolSize: 44)),
                  ),
                ],
              ),
            ),
            Transform.translate(
              offset: const Offset(0, -28),
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 16),
                padding: const EdgeInsets.all(22),
                decoration: cardDecoration().copyWith(
                  borderRadius: BorderRadius.circular(28),
                  boxShadow: const [BoxShadow(color: Color(0x14101828), blurRadius: 24, offset: Offset(0, 10))],
                ),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Que bom ter você aqui!', style: AppTextStyles.titleLg.copyWith(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 4),
                      Text('Acompanhe a jornada de cuidado da sua criança: consultas, fila e plano.',
                          style: AppTextStyles.body.copyWith(color: AppColors.secondaryText)),
                      const SizedBox(height: 20),
                      _label('E-mail'),
                      TextFormField(
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                        autofillHints: const [AutofillHints.email],
                        textInputAction: TextInputAction.next,
                        decoration: _decoration('seu@email.com', Icons.mail_outline_rounded),
                        validator: (value) => (value == null || !value.contains('@')) ? 'Informe um e-mail válido' : null,
                      ),
                      const SizedBox(height: 14),
                      _label('Senha'),
                      TextFormField(
                        controller: _passwordController,
                        obscureText: _obscure,
                        autofillHints: const [AutofillHints.password],
                        decoration: _decoration('••••••••', Icons.lock_outline_rounded).copyWith(
                          suffixIcon: IconButton(
                            tooltip: _obscure ? 'Mostrar senha' : 'Ocultar senha',
                            onPressed: () => setState(() => _obscure = !_obscure),
                            icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined, color: AppColors.secondaryText),
                          ),
                        ),
                        validator: (value) => (value == null || value.isEmpty) ? 'Informe sua senha' : null,
                        onFieldSubmitted: (_) => _submit(),
                      ),
                      if (_errorMessage != null) ...[
                        const SizedBox(height: 14),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(color: AppColors.roseLight, borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFFECDCA))),
                          child: Row(
                            children: [
                              const Icon(Icons.error_outline_rounded, color: AppColors.rose, size: 20),
                              const SizedBox(width: 8),
                              Expanded(child: Text(_errorMessage!, style: AppTextStyles.bodySm.copyWith(color: const Color(0xFFB42318), fontWeight: FontWeight.w600))),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 20),
                      SizedBox(
                        width: double.infinity,
                        height: 54,
                        child: ElevatedButton(
                          onPressed: _loading ? null : _submit,
                          child: _loading
                              ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                              : const Text('Entrar'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.lock_rounded, size: 14, color: AppColors.secondaryText),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text('Seus dados são protegidos conforme a LGPD.',
                        style: AppTextStyles.bodySm.copyWith(color: AppColors.secondaryText)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(text, style: AppTextStyles.label.copyWith(fontWeight: FontWeight.w700)),
      );

  InputDecoration _decoration(String hint, IconData icon) => InputDecoration(
        hintText: hint,
        prefixIcon: Icon(icon, color: AppColors.inkFaint),
      );
}
