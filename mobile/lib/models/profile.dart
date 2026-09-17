import 'enums.dart';

/// Espelha `public.profiles`.
class Profile {
  final String id;
  final String fullName;
  final UserRole role;
  final String? email;
  final String? phone;

  const Profile({
    required this.id,
    required this.fullName,
    required this.role,
    this.email,
    this.phone,
  });

  factory Profile.fromMap(Map<String, dynamic> map) {
    return Profile(
      id: map['id'] as String,
      fullName: map['full_name'] as String,
      role: UserRoleX.fromDb(map['role'] as String? ?? 'responsavel'),
      email: map['email'] as String?,
      phone: map['phone'] as String?,
    );
  }
}
