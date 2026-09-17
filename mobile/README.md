# Cuidar+ · App das famílias (Flutter)

Aplicativo Android/iOS para **responsáveis** acompanharem o cuidado da criança na rede IntegraTEA de Crateús. Usa o **mesmo banco** do sistema web (Supabase), com a mesma identidade visual.

**📱 Baixar o APK:** [Releases](https://github.com/ProjetAR-ce/cuidar-mais-integratea/releases/latest)
**Login de demonstração:** `responsavel@cuidarmais.demo` · senha `Cuidar+2026` (dados fictícios)
**Telas:** [prints em alta resolução](../docs/app/telas) e [guia das telas em PDF](../docs/app/Cuidar+_App_das_Familias_Telas.pdf)

## Telas

| Aba | O que mostra | Fonte no banco |
|---|---|---|
| **Início** | saudação, 4 indicadores (consultas, posição na fila, encaminhamentos, avisos), trilha da jornada em 5 etapas, próximas consultas com **confirmação de presença** e filas ativas | `journey_events`, `v_agenda`, `v_queue_ranked`, `referrals`, `notifications` |
| **Fila** | posição, prioridade, dias de espera e **"Por que esta posição?"** | `v_queue_ranked` |
| **Prontuário** | plano de cuidado com progresso, encaminhamentos e linha do tempo | `care_plans`, `care_plan_items`, `referrals`, `journey_events` |
| **Avisos** | notificações geradas automaticamente pelo sistema web (consulta agendada/cancelada, encaminhamento, fila) | `notifications` |
| **Notícias** | mural da rede com campanhas, eventos e avisos | `posts` |
| **Consultas** | próximas e anteriores, com status | `v_agenda` |

Se o responsável tiver mais de um dependente, ele troca a criança pelo seletor no topo.

## Segurança e LGPD

- Login pelo Supabase Auth. Sem sessão, a **RLS** bloqueia qualquer leitura.
- O responsável vê **somente os próprios dependentes** (`patients.responsible_id`), e nunca notas clínicas internas da equipe.
- Confirmar presença usa a RPC `confirm_appointment_attendance`, que valida o vínculo, registra na jornada e na auditoria.
- O app usa apenas a **chave publicável** do Supabase. A chave secreta nunca entra no aplicativo.

## Como rodar

Requisitos: Flutter 3.44+ (Dart 3.12+) e Android SDK.

```bash
cd mobile
cp .env.example .env        # preencha SUPABASE_URL e a chave publicável (SUPABASE_DB)
flutter pub get
flutter test
flutter run                 # celular ou emulador conectado
flutter build apk --release # gera build/app/outputs/flutter-apk/app-release.apk
```

O banco precisa das migrações de [`../supabase/migrations`](../supabase/migrations), inclusive a `004` (avisos e notícias) e a `005` (confirmação de presença).

## Estrutura

```
lib/
├── core/        autenticação, repositório de dados (Supabase) e tema (cores e tipografia do site)
├── models/      espelho das tabelas e views do banco
├── screens/     splash, login, shell com navegação e as 5 abas
└── widgets/     componentes visuais (cartões, badges, anel de progresso, celebração)
```

Projeto iniciado pela equipe em [JoaoAugusto1374/IntegraTEA](https://github.com/JoaoAugusto1374/IntegraTEA) e integrado a este repositório para a entrega do hackathon.
