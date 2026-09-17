import 'dart:io';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../../models/profile.dart';
import '../supabase/supabase_config.dart';

/// Erro amigável de autenticação/conexão, para exibir na UI em vez de
/// mascarar o problema com dados falsos.
class CuidarAuthException implements Exception {
  final String message;
  const CuidarAuthException(this.message);

  @override
  String toString() => message;
}

class AuthRepository {
  SupabaseClient get _client => SupabaseConfig.client;

  Session? get currentSession => _client.auth.currentSession;
  bool get isLoggedIn => currentSession != null;

  Stream<AuthState> get onAuthStateChange => _client.auth.onAuthStateChange;

  Future<void> signInWithPassword({required String email, required String password}) async {
    try {
      await _client.auth.signInWithPassword(email: email, password: password);
    } on AuthException catch (e) {
      throw CuidarAuthException(e.message);
    } on SocketException catch (_) {
      throw const CuidarAuthException('Sem conexão com a internet. Verifique sua rede e tente novamente.');
    } catch (e) {
      throw CuidarAuthException('Não foi possível conectar ao Cuidar+: $e');
    }
  }

  Future<void> signOut() => _client.auth.signOut();

  /// Busca o perfil (profiles) do usuário autenticado.
  /// Lança [CuidarAuthException] se a conexão/consulta falhar de verdade —
  /// não retorna dado fictício para não mascarar problema de conexão.
  Future<Profile> fetchCurrentProfile() async {
    final userId = currentSession?.user.id;
    if (userId == null) {
      throw const CuidarAuthException('Nenhum usuário autenticado.');
    }
    try {
      final row = await _client.from('profiles').select().eq('id', userId).single();
      return Profile.fromMap(row);
    } on PostgrestException catch (e) {
      throw CuidarAuthException('Erro ao carregar perfil (${e.code}): ${e.message}');
    } catch (e) {
      throw CuidarAuthException('Erro ao carregar perfil: $e');
    }
  }
}
