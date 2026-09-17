import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/data/care_repository.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import '../../models/post.dart';
import '../../widgets/cuidar_ui.dart';
import '../../widgets/error_state.dart';

/// Mural de notícias da rede (`public.posts` publicados).
class NewsScreen extends StatefulWidget {
  const NewsScreen({super.key});

  @override
  State<NewsScreen> createState() => _NewsScreenState();
}

class _NewsScreenState extends State<NewsScreen> {
  final _repository = CareRepository();
  late Future<List<Post>> _future;

  /// Publicações reais da Casa Mais Azul no Instagram, ligadas pelo título do post.
  static const _instagram = {
    'Projeto Laços de Amor': 'https://www.instagram.com/p/DTxud4BACVF/',
    'Atividades Sensoriais': 'https://www.instagram.com/p/DSVuQWEAZG3/',
    'Inauguração do Novo Bloco': 'https://www.instagram.com/p/DGDgbojRHWL/',
  };

  @override
  void initState() {
    super.initState();
    _future = _repository.fetchPublishedPosts();
  }

  String? _instagramFor(Post post) {
    for (final e in _instagram.entries) {
      if (post.title.startsWith(e.key)) return e.value;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Post>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator(color: AppColors.primary));
        }
        if (snapshot.hasError) {
          return ErrorState(error: snapshot.error, onRetry: () => setState(() => _future = _repository.fetchPublishedPosts()));
        }
        final posts = snapshot.data!;
        return RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async => setState(() => _future = _repository.fetchPublishedPosts()),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
            children: [
              Text('Notícias da rede', style: AppTextStyles.displayLg.copyWith(fontSize: 28, fontWeight: FontWeight.w800)),
              const SizedBox(height: 2),
              Text('Campanhas, eventos e avisos da rede de cuidado de Crateús.', style: AppTextStyles.body.copyWith(color: AppColors.secondaryText)),
              const SizedBox(height: 16),
              if (posts.isEmpty)
                const EmptyCard(title: 'Nenhuma notícia publicada')
              else
                for (var i = 0; i < posts.length; i++) ...[
                  _PostCard(post: posts[i], variant: i, instagramUrl: _instagramFor(posts[i])),
                  const SizedBox(height: 14),
                ],
            ],
          ),
        );
      },
    );
  }
}

class _PostCard extends StatelessWidget {
  final Post post;
  final int variant;
  final String? instagramUrl;
  const _PostCard({required this.post, required this.variant, this.instagramUrl});

  (Tone, IconData) get _style => switch (post.category) {
        'evento' => (Tone.lilac, Icons.celebration_rounded),
        'noticia' => (Tone.mint, Icons.auto_awesome_rounded),
        _ => (Tone.sun, Icons.campaign_rounded),
      };

  String get _label => switch (post.category) {
        'evento' => 'Evento',
        'noticia' => 'Notícia',
        _ => 'Aviso',
      };

  @override
  Widget build(BuildContext context) {
    final (tone, icon) = _style;
    return Container(
      decoration: cardDecoration(),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: 150,
            child: post.coverImageUrl != null
                ? Image.network(post.coverImageUrl!, fit: BoxFit.cover, errorBuilder: (_, _, _) => _Cover(tone: tone, icon: icon, variant: variant))
                : _Cover(tone: tone, icon: icon, variant: variant),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    ToneBadge(label: _label, tone: tone, icon: icon),
                    const Spacer(),
                    if (post.publishedAt != null)
                      Text(DateFormat("d 'de' MMM", 'pt_BR').format(post.publishedAt!.toLocal()),
                          style: AppTextStyles.bodySm.copyWith(color: AppColors.secondaryText)),
                  ],
                ),
                const SizedBox(height: 10),
                Text(post.title, style: AppTextStyles.titleMd.copyWith(fontWeight: FontWeight.w800)),
                if (post.subtitle != null)
                  Text(post.subtitle!, style: AppTextStyles.subtitle.copyWith(color: AppColors.primary, fontSize: 14)),
                const SizedBox(height: 6),
                Text(post.body.replaceAll(' [Conteúdo de demonstração.]', ''), style: AppTextStyles.body.copyWith(color: AppColors.ink)),
                if (instagramUrl != null) ...[
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.primary,
                      side: const BorderSide(color: AppColors.line, width: 1.5),
                    ),
                    onPressed: () => launchUrl(Uri.parse(instagramUrl!), mode: LaunchMode.externalApplication),
                    icon: const Icon(Icons.open_in_new_rounded, size: 18),
                    label: const Text('Ver no Instagram'),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Cover extends StatelessWidget {
  final Tone tone;
  final IconData icon;
  final int variant;
  const _Cover({required this.tone, required this.icon, required this.variant});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: tone.soft,
      child: Stack(
        children: [
          Positioned(right: -30, top: -40, child: OrganicBlob(color: tone.base.withValues(alpha: 0.55), size: 170, variant: variant)),
          Positioned(left: -20, bottom: -50, child: OrganicBlob(color: AppColors.primary.withValues(alpha: 0.12), size: 140, variant: variant + 1)),
          Center(child: IconBubble(icon: icon, tone: tone, size: 72, solid: true)),
        ],
      ),
    );
  }
}
