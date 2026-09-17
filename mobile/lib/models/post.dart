/// Espelha `public.posts` (migration 0005, aditiva) — mural de notícias
/// público, no espírito do Instagram da prefeitura.
class Post {
  final String id;
  final String title;
  final String? subtitle;
  final String? coverImageUrl;
  final String body;
  final String category;
  final DateTime? publishedAt;

  const Post({
    required this.id,
    required this.title,
    required this.body,
    required this.category,
    this.subtitle,
    this.coverImageUrl,
    this.publishedAt,
  });

  factory Post.fromMap(Map<String, dynamic> map) {
    return Post(
      id: map['id'] as String,
      title: map['title'] as String,
      subtitle: map['subtitle'] as String?,
      coverImageUrl: map['cover_image_url'] as String?,
      body: map['body'] as String,
      category: map['category'] as String? ?? 'aviso',
      publishedAt: map['published_at'] != null ? DateTime.tryParse(map['published_at'] as String) : null,
    );
  }

  String get categoryLabel {
    switch (category) {
      case 'noticia':
        return 'Notícia';
      case 'evento':
        return 'Evento';
      case 'servico':
        return 'Serviço';
      default:
        return 'Aviso';
    }
  }
}
