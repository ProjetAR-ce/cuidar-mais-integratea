# Cuidar+ Web (IntegraTEA Crateús) — Plano de desenvolvimento

> Versão 1.0 · 16/09/2026
> Fontes: `integratea_requisitos_implementacao.pdf`, `identidade_visual_cuidar_mais_v2.pdf`, mockup `ChatGPT Image … 17_59_05.png` e leitura do Supabase `ccgwifyqlsbklgiuardc`.

---

## 0. Resumo

| Item | Decisão |
|---|---|
| Produto | **Cuidar+** — sistema web do IntegraTEA para coordenar o cuidado de pessoas com TEA (NASF, NAPE, CREAES, Casa Mais Azul, CRASF) |
| O que **não** é | Prontuário hospitalar, diagnóstico, prescrição ou decisão clínica automática (RN-013) |
| Stack | Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui (customizado) + Supabase (Postgres, Auth, RLS) + Vercel |
| Tema | **Apenas claro**, fundo off-white `#FDFBF7` |
| Estilo | **Duolingo × Apple**: estrutura, espaço e vidro fosco da Apple + botões "fofos" em 3D, cores e microcelebrações do Duolingo — sem infantilizar |
| Banco | **Compartilhado com o app mobile** → toda mudança de schema é **aditiva** e combinada com o time do mobile |
| Público web | recepção, profissional, coordenação, gestão e admin (`responsavel` usa o app mobile) |

---

## 1. Como o banco está hoje (lido em 16/09/2026)

**Situação:** 10 tabelas, 6 enums, **nenhum registro**, **nenhum usuário no Auth**, nenhum bucket e nenhuma função RPC. A chave pública (anon) retorna `[]` em tudo, então o RLS provavelmente está ligado (políticas precisam ser conferidas no painel).

### 1.1 Enums

| Enum | Valores |
|---|---|
| `user_role` | recepcao, profissional, coordenacao, gestao, admin, responsavel |
| `priority_level` | P1, P2, P3 |
| `queue_status` | aguardando, em_atendimento, concluido, cancelado |
| `appointment_status` | agendado, presente, falta_justificada, falta_injustificada, cancelado |
| `referral_status` | pendente, aceito, devolvido |
| `alert_severity` / `alert_status` | atencao, critico / pendente, revisado |

### 1.2 Tabelas e relações

```
services (id, name, code, capacity)
   ▲
profiles (id, full_name, role, service_id)          ← provavelmente 1:1 com auth.users
   ▲
patients (id, cns, cpf, full_name, birth_date, mother_name, responsible_id→profiles, aps_reference)
   │
   ├── triages        (service_id, professional_id, priority, clinical_notes)
   ├── queue_entries  (service_id, specialty, priority, status, position, entered_at)
   ├── appointments   (service_id, professional_id, scheduled_for, status, evolution_notes, absence_reason)
   ├── journey_events (service_id, event_type, description, created_by)
   ├── referrals      (origin_service_id, destination_service_id, reason, priority, status, response_notes)
   └── care_alerts    (alert_type, severity, status, action_recommended, reviewed_by, reviewed_at)

audit_logs (user_id [sem FK], action, resource, details jsonb)
```

### 1.3 O que falta no banco para cumprir os requisitos

| Requisito | Lacuna | Solução proposta (aditiva) |
|---|---|---|
| RF-004/RN-002 CNS único | Não dá para ver se há `UNIQUE` em `cns` | índice único parcial `WHERE cns IS NOT NULL` |
| RF-003/RF-005 busca e duplicidade | Sem busca por similaridade | extensão `pg_trgm` + `unaccent`, RPC `search_patients`, tabela `patient_duplicate_candidates` |
| Responsável sem conta no app | `responsible_id` só aponta para `profiles` | colunas `guardian_name`, `guardian_phone`, `guardian_relationship` em `patients` |
| RF-006 triagem | Faltam necessidade, especialidade e justificativa (RN-006) | `need_description`, `specialty_id`, `priority_justification` em `triages` |
| RN-005 fila | Falta origem, triagem e motivo | `triage_id`, `origin`, `specialty_id`, `priority_justification`, `cancel_reason` |
| RF-008 ordenação explicável | `position` estático | view `v_queue_ranked` (prioridade + tempo de espera + parâmetros) com coluna `rank_reason` |
| RF-011 atendimento | Falta objetivo e síntese; sem reagendamento | `objective`, `summary`, `specialty_id`, `queue_entry_id`, `rescheduled_from_id`, `cancel_reason`, `updated_at` |
| RN-009 nada é apagado | Sem versões | `record_revisions` (tabela, id, versão, dados antigos, autor) + trigger que bloqueia `DELETE` |
| RF-013 encaminhamento | Falta "solicitar complemento", quem respondeu e prazo | novo valor `complemento_solicitado` no enum, `responded_by`, `responded_at`, `due_at`, `specialty_id` |
| RF-014 plano compartilhado | Não existe | `care_plans` + `care_plan_items` (próximo passo, serviço de referência, responsável, prazo, situação) |
| RF-015 alertas | Falta motivo, serviço e origem | `reason`, `service_id`, `related_table`, `related_id`, `review_notes`, `dedupe_key` (único) |
| RF-017 capacidade | `services.capacity` é um número solto | `specialties` + `service_specialties` (vagas/mês, nº de profissionais) |
| Parâmetros (D-03, D-04) | Não existem | `system_parameters` (chave, valor jsonb, descrição, atualizado por) |
| RF-020 formulários (Could) | Não existem | `form_definitions` + `form_responses` (jsonb) |
| RF-019 auditoria | Sem FK, mutável | FK para `profiles`, triggers automáticos, `REVOKE UPDATE, DELETE` |
| RF-012 linha do tempo | Eventos criados à mão | `source_table`, `source_id`, `metadata` + triggers que geram eventos a partir de triagem, fila, agenda, encaminhamento e alerta |

> ⚠️ Alinhar com o time do mobile **antes** de aplicar: novos valores de enum e colunas `NOT NULL` podem quebrar o app. Regra: colunas novas sempre `NULL` ou com `DEFAULT`.

---

## 2. Arquitetura

Monólito modular (item 8.1 do documento).

```
Navegador ─► Next.js (Vercel)
              ├─ Server Components  → leitura com a sessão do usuário (RLS aplica)
              ├─ Server Actions     → escrita + validação Zod + auditoria
              ├─ /api/v1/*          → API JSON versionada (RF-022)
              └─ proxy.ts           → renova sessão e bloqueia rotas por perfil
                        │
                        ▼
              Supabase ─ Postgres (RLS, views, triggers, pg_cron) · Auth
```

**Regras de segurança (RNF-001, seção 7)**
- `service_role` / `sb_secret_*` **só** em variável de servidor (`SUPABASE_SECRET_KEY`), nunca `NEXT_PUBLIC_`.
- Toda leitura de dados do usuário usa o cliente com sessão → o RLS é a barreira real; esconder botões na tela é só conforto.
- A `service_role` só é usada em scripts de seed e jobs administrativos.
- MFA (TOTP) obrigatório para `admin`.

### 2.1 Estrutura de pastas

```
src/
  app/
    (auth)/login
    (app)/
      inicio/                 painel por perfil
      pacientes/              busca → [id] (resumo, jornada, plano, agenda, encaminhamentos)
      pacientes/novo          só abre depois de uma busca (RN-001)
      duplicidades/
      triagem/
      fila/
      agenda/
      encaminhamentos/        recebidos | enviados
      alertas/
      capacidade/
      indicadores/
      auditoria/
      admin/                  usuarios | servicos | especialidades | parametros | formularios
    api/v1/…
  modules/                    patients, triage, queue, appointments, referrals, alerts, capacity, audit
    <modulo>/{queries.ts, actions.ts, schemas.ts, components/}
  components/ui/              design system Cuidar+
  lib/supabase/{server.ts, client.ts, admin.ts}
  lib/auth/permissions.ts     matriz perfil × ação
  types/database.ts           gerado por `supabase gen types`
supabase/
  migrations/                 SQL versionado
  seed/                       dados fictícios (RN-014)
```

### 2.2 Bibliotecas

`@supabase/ssr`, `zod`, `react-hook-form`, `@tanstack/react-table`, `recharts`, `motion` (animações), `lucide-react`, `date-fns` (pt-BR), `sonner` (avisos), `cmdk` (busca Ctrl+K), `vitest`, `@playwright/test`, `@axe-core/playwright`.

---

## 3. Identidade visual: Duolingo × Apple (tema claro)

### 3.1 O que pegar de cada um

| Da **Apple** | Do **Duolingo** |
|---|---|
| Muito espaço em branco, pouca informação por vez | Botões grossos em "3D" que afundam ao clicar |
| Títulos grandes (Large Title) que encolhem ao rolar | Cores cheias e alegres por categoria |
| Barra superior e lateral com vidro fosco (`backdrop-blur`) | Ícones grandes dentro de "bolhas" coloridas |
| Listas agrupadas com cantos arredondados (inset grouped) | Barras de progresso grossas e arredondadas |
| Controles segmentados, sheets que sobem no celular | Microcelebração ao concluir (check que "pula", confete leve) |
| Animações de mola discretas, sombras suaves | Personagens/ilustrações acolhedoras (como no mockup) |
| Anéis de progresso (estilo Atividade do Apple Watch) | Metas do dia e sequência da equipe |

**Limite:** é um sistema de saúde pública. A gamificação vale **só para a equipe** (ex.: "fila revisada hoje", "encaminhamentos respondidos") e nunca para pacientes, prioridades ou dados clínicos. Nada de linguagem infantil (manual, seção 08).

### 3.2 Tokens de cor

Cores da marca + tons escuros (`-ink`) para texto e bordas, porque os pastéis sozinhos **não** passam em contraste WCAG AA (RNF-006).

```css
@theme {
  /* Estrutura */
  --color-ink:        #344054;  /* azul ardósia: textos, títulos, navegação */
  --color-ink-strong: #1D2939;
  --color-ink-muted:  #667085;
  --color-bg:         #FDFBF7;  /* off-white */
  --color-surface:    #FFFFFF;
  --color-surface-2:  #F5F6F8;
  --color-line:       #EAECF0;

  /* Marca (fundo / 3D / texto) */
  --color-mint:   #91DCC1;  --color-mint-soft:   #E6F7F0;  --color-mint-edge:   #5FBF9D;  --color-mint-ink:   #1B6B50;
  --color-peach:  #F6B978;  --color-peach-soft:  #FDF0E2;  --color-peach-edge:  #D9924A;  --color-peach-ink:  #9A4F0C;
  --color-lilac:  #B99BCB;  --color-lilac-soft:  #F3ECF7;  --color-lilac-edge:  #9575AC;  --color-lilac-ink:  #5E3F78;
  --color-sun:    #F6D76F;  --color-sun-soft:    #FDF7DC;  --color-sun-edge:    #D4B341;  --color-sun-ink:    #7A5E00;
  --color-rose:   #F2B9C5;  --color-rose-soft:   #FCEBEF;  --color-rose-edge:   #D98898;  --color-rose-ink:   #A3213F;
}
```

| Significado | Cor | Sempre junto com |
|---|---|---|
| Sucesso / presente / aceito | menta | ícone ✓ + texto |
| Atenção / P2 / pendente | amarelo ou pêssego | ícone ⏱ + texto |
| Crítico / P1 / falta | rosa (`rose-ink` no texto) | ícone ! + texto |
| Informação / fila / em atendimento | lavanda | ícone + texto |
| Botão principal | ardósia `#344054` com borda 3D `#1D2939` e texto branco | — |

> Estados **nunca** só por cor (manual seção 07 e RNF-006). Conferir os `-ink` com um verificador de contraste antes de fechar.

**Cor fixa por serviço** (chips, gráficos, linha do tempo): NASF = menta · NAPE = lavanda · CREAES = pêssego · Casa Mais Azul = amarelo · CRASF = rosa.

### 3.3 Tipografia

- **Baloo 2** (`next/font/google`, pesos 400/500/600/700/800) em tudo, como pede o manual.
- Números em tabelas e indicadores: `font-variant-numeric: tabular-nums`. Se a Baloo 2 não alinhar bem, usar **Inter** só nos números (validar com a marca).
- Escala estilo Apple: Large Title 34/700 · Title 1 28/700 · Title 2 22/700 · Headline 17/600 · Body 16/400 · Callout 15/500 · Footnote 13/500.

### 3.4 Forma, sombra e movimento

```css
--radius-sm: 10px;   /* chips, inputs pequenos */
--radius-md: 14px;   /* inputs, botões */
--radius-lg: 20px;   /* cards */
--radius-xl: 28px;   /* hero, modais */

--shadow-card:  0 1px 2px rgb(16 24 40 / .04), 0 8px 24px rgb(16 24 40 / .06);
--shadow-float: 0 12px 40px rgb(16 24 40 / .12);
--blur-glass:   saturate(180%) blur(20px);   /* bg-white/70 */

/* Botão Duolingo */
.btn-3d { box-shadow: 0 4px 0 var(--edge); transition: transform .08s, box-shadow .08s; }
.btn-3d:active { transform: translateY(4px); box-shadow: 0 0 0 var(--edge); }

/* Mola Apple (motion) */
spring = { type: "spring", stiffness: 400, damping: 30 }
```

- Respeitar `prefers-reduced-motion` (desliga confete e molas).
- Foco visível: anel de 3px em lavanda-ink com 2px de afastamento.
- Área de toque mínima: 44×44px (padrão Apple).
- "Conexões Orgânicas" (bolhas do padrão) só em hero, estados vazios, login e cantos da lateral, com 1 a 3 cores e bastante respiro.

### 3.5 Componentes do design system

`Button` (primário 3D, secundário, fantasma, perigo) · `IconBubble` · `Card` / `StatCard` com bolha no canto · `PriorityBadge` (P1/P2/P3 com ícone) · `StatusPill` · `ServiceChip` · `SegmentedControl` · `SearchCommand` (Ctrl+K) · `Sheet` (sobe no celular, lateral no desktop) · `Timeline` · `JourneyStepper` (Entrada → Triagem → Fila → Atendimento → Continuidade) · `ProgressRing` · `ProgressBar` · `DataTable` · `EmptyState` com ilustração · `AlertCard` com motivo + ação recomendada · `Celebrate` (check animado) · `GlassHeader` · `Sidebar` / `TabBar` inferior no celular.

### 3.6 Layout

- **Desktop:** lateral fixa de vidro (como no mockup), cabeçalho com busca global, sino de alertas e usuário.
- **Tablet:** lateral só com ícones.
- **Celular (a partir de 320px, RNF-007):** barra inferior com 5 abas (Início, Pacientes, Fila, Agenda, Mais) e ações abrindo em sheet.

---

## 4. Perfis e permissões (RF-002, CA-08)

| Tela / ação | Recepção | Profissional | Coordenação | Gestão | Admin |
|---|:-:|:-:|:-:|:-:|:-:|
| Buscar e cadastrar paciente | ✅ | ✅ | ✅ | — | ✅ |
| Ver dados de identificação | ✅ | ✅ | ✅ | — | ✅ |
| Ver notas clínicas e síntese | — | ✅ do serviço/vínculo | ✅ | — | 🔍 auditado |
| Triagem e prioridade | — | ✅ | ✅ | — | — |
| Fila | 👁 ver | ✅ do serviço | ✅ todos | — | — |
| Agenda e presença | ✅ | ✅ | ✅ | — | — |
| Registrar atendimento | — | ✅ | — | — | — |
| Encaminhar / responder | — | ✅ | ✅ | — | — |
| Plano compartilhado | — | ✅ | ✅ | — | — |
| Revisar alertas | — | ✅ do serviço | ✅ | — | — |
| Confirmar duplicidade/fusão (RN-004) | — | — | ✅ | — | ✅ |
| Capacidade e indicadores | — | — | ✅ | ✅ só agregados | ✅ |
| Auditoria | — | — | — | — | ✅ |
| Usuários, serviços, parâmetros | — | — | — | — | ✅ |

Implementação em três camadas: **(1)** políticas RLS com funções `auth_role()` e `auth_service_id()`; **(2)** `permissions.ts` para decidir o que aparece na tela; **(3)** `proxy.ts` para bloquear rotas. Notas clínicas ficam em colunas lidas só por views com filtro de perfil, para a recepção não recebê-las nem pela API.

---

## 5. Telas e fluxos

| Rota | Conteúdo | Toque Duolingo × Apple | Req. |
|---|---|---|---|
| `/login` | e-mail + senha, MFA para admin | bolhas orgânicas ao fundo, card de vidro | RF-001 |
| `/inicio` | painel por perfil: saudação, 4 indicadores, jornada, próximos atendimentos, alertas, rede de serviços (como no mockup) | anéis de progresso das metas do dia | — |
| `/pacientes` | **busca primeiro** (CNS, nome, nascimento, mãe/responsável); botão "Cadastrar" só aparece depois de buscar | busca grande estilo Spotlight | RF-003, RN-001 |
| `/pacientes/novo` | formulário em etapas (identificação → responsável → APS); a cada campo checa semelhança e avisa possível duplicidade | stepper com barra de progresso | RF-004, RF-005 |
| `/pacientes/[id]` | cabeçalho com etapa atual da jornada; abas: Resumo · Linha do tempo · Plano · Agenda · Encaminhamentos · Alertas | Large Title + segmented control | RF-012, RF-014 |
| `/duplicidades` | comparação lado a lado com campos iguais destacados; confirmar ou rejeitar | cartões que deslizam | RF-005, RN-003/004 |
| `/triagem` | necessidade, serviço, especialidade, prioridade + justificativa obrigatória → gera entrada na fila | celebração ao inserir na fila | RF-006, RN-006 |
| `/fila` | filtros por serviço/especialidade/situação; lista ordenada com "por que está nesta posição?" | badge P1/P2/P3 + tempo de espera em barra | RF-007, RF-008 |
| `/agenda` | dia/semana por profissional; criar, reagendar, cancelar; check-in de presença ou falta com justificativa | marcar presença com um toque e check animado | RF-009, RF-010 |
| `/atendimentos/[id]` | objetivo, síntese, evolução; correção gera nova versão | — | RF-011, RN-009 |
| `/encaminhamentos` | abas Recebidos / Enviados; aceitar, devolver ou pedir complemento; prazo visível | contador de prazo | RF-013, RN-008 |
| `/alertas` | lista por tipo e gravidade, com motivo e ação recomendada; marcar como revisado com nota | "caixa zerada" com celebração | RF-015, RF-016 |
| `/capacidade` | demanda × vagas × espera × profissionais por serviço e especialidade; gargalos em destaque | barras cheias estilo Duolingo | RF-017 |
| `/indicadores` | indicadores da seção 9 com filtros por período e serviço; exportar CSV/PDF agregado | gráficos limpos estilo Apple Health | RF-018, RF-021 |
| `/auditoria` | busca por usuário, ação, recurso e data | — | RF-019 |
| `/admin/*` | usuários, serviços, especialidades, parâmetros (P1/P2/P3, prazos, faltas), formulários | — | RF-020 |

---

## 6. Regras no banco

| Regra | Onde |
|---|---|
| RN-001 busca antes de cadastrar | a tela só libera "Cadastrar" com `search_session_id` recente; a action valida e registra no log (indicador ≥ 95%) |
| RN-002 CNS único | índice único parcial + validação do dígito verificador do CNS |
| RN-003 semelhança gera alerta | trigger `AFTER INSERT` em `patients` usando `similarity(full_name) + birth_date + mother_name` → candidato de duplicidade + alerta AL-01 |
| RN-007 posição na fila | view `v_queue_ranked`: `ORDER BY peso_prioridade DESC, entered_at ASC`, pesos em `system_parameters` |
| RN-008 encaminhamento | só vai para "concluído" com `aceito` ou `devolvido` + `responded_by` |
| RN-009 sem exclusão | trigger `BEFORE DELETE` bloqueia; `BEFORE UPDATE` grava a versão antiga em `record_revisions` |
| RN-010 três faltas seguidas | trigger em `appointments` → alerta AL-04 |
| RN-011 sobreposição | trigger em `queue_entries`/`appointments`: mesma especialidade ativa em outro serviço → AL-02 |
| AL-03 encaminhamento parado | `pg_cron` a cada hora: `pendente` com `created_at` acima do prazo |
| AL-05 cuidado sem atualização | `pg_cron` diário: sem `journey_events` dentro do prazo do plano |
| AL-06 fila acima da capacidade | `pg_cron` diário: demanda do mês > vagas em `service_specialties` |
| Alertas sem repetição | `dedupe_key` único (ex.: `AL-04:<patient_id>`) + `ON CONFLICT DO NOTHING` |
| Linha do tempo automática | triggers em triagem, fila, agenda, encaminhamento, plano e alerta → `journey_events` |
| Auditoria | triggers + `log_sensitive_read()` chamada ao abrir dados clínicos ou exportar |

---

## 7. Dados fictícios para a demonstração (RN-014)

Script `supabase/seed/seed.ts`, rodado com a chave secreta **só na máquina local**:

- 5 serviços com cores e capacidade; ~12 especialidades (fonoaudiologia, TO, psicologia, neuropediatria, psicopedagogia, fisioterapia, serviço social, música…);
- 1 usuário de demonstração por perfil (`recepcao@demo.cuidarmais`, etc.) + ~15 profissionais;
- ~150 pacientes com nomes gerados, CNS válidos e fictícios, e idades de 2 a 21 anos;
- histórico de 6 meses: triagens, filas, ~1.500 agendamentos (≈80% presença), encaminhamentos em todos os estados;
- **casos montados para cada alerta**: 3 pares de duplicidade, 2 sobreposições, 1 encaminhamento parado, 4 pacientes com 3 faltas, 1 serviço acima da capacidade;
- 1 "paciente vitrine" com jornada completa passando por 3 serviços (CA-04).

---

## 8. Fases de implementação

Ordem pensada para ter algo **demonstrável o quanto antes**. Cada fase fecha critérios de aceite.

### Fase 0 — Preparação
- [ ] Combinar com o time do mobile as migrações da seção 1.3
- [ ] Revisar as chaves de acesso do Supabase (ver seção 10)
- [ ] Conferir no painel do Supabase: RLS, políticas, triggers e se `profiles.id` referencia `auth.users`
- [ ] `git init`, repositório, projeto na Vercel, `.env.local` / `.env.example`

### Fase 1 — Fundação
- [ ] `create-next-app` (TS, Tailwind, App Router, `src/`), shadcn/ui, Baloo 2
- [ ] Tokens da seção 3 + componentes base (Button 3D, Card, Badge, Sheet, SegmentedControl, GlassHeader)
- [ ] Página `/styleguide` interna com todos os componentes
- [ ] Clientes Supabase (server, browser, admin), `proxy.ts`, login e logout
- [ ] Migrações 001–003: extensões, colunas novas, `specialties`, `system_parameters`, funções de perfil, RLS
- [ ] Auditoria base (triggers + `REVOKE`)
- [ ] Layout: lateral, cabeçalho, barra inferior no celular
- [ ] `supabase gen types` + seed
- **Aceite:** CA-08 e CA-09 começam a ser atendidos

### Fase 2 — Núcleo do MVP
- [ ] Pacientes: busca, cadastro em etapas, página do paciente → **CA-01**
- [ ] Duplicidades: detecção + tela de revisão
- [ ] Triagem → fila priorizada com motivo → **CA-02**
- [ ] Agenda, presença e falta, atendimento com versões → **CA-03**
- [ ] Linha do tempo automática → **CA-04**
- [ ] Encaminhamentos (enviar, aceitar, devolver, pedir complemento) → **CA-05**
- [ ] Plano compartilhado

### Fase 3 — Inteligência operacional
- [ ] Triggers e jobs AL-01 a AL-06 + tela de alertas → **CA-06**
- [ ] Views de capacidade e tela → **CA-07**
- [ ] Indicadores + exportação agregada
- [ ] Painel `/inicio` por perfil (igual ao mockup)
- [ ] Admin: usuários, serviços, especialidades, parâmetros

### Fase 4 — Qualidade e demonstração
- [ ] Playwright: um teste por critério CA-01…CA-10, rodando com os 5 perfis
- [ ] Teste de RLS: cada perfil tenta ler e gravar o que não pode (deve falhar)
- [ ] axe + navegação só por teclado + telas de 320px → **CA-10**
- [ ] Lighthouse: telas principais em até 2s (RNF-004)
- [ ] Roteiro de demo de 5 minutos com a "paciente vitrine"

### Fase 5 — Depois do hackathon (Could / posterior)
Formulários configuráveis (RF-020), API `/api/v1` documentada em OpenAPI (RF-022), notificações, PWA/offline, integração e-SUS.

---

## 9. Roteiro sugerido para a demonstração

1. **Recepção** busca "Ana", não encontra, cadastra → sistema avisa possível duplicidade → mostra alerta.
2. **Profissional (NASF)** faz a triagem P1 com justificativa → paciente entra na fila e aparece o motivo da posição.
3. Agenda → marca presença → registra atendimento → encaminha para CREAES.
4. **Profissional (CREAES)** aceita o encaminhamento → a linha do tempo mostra dois serviços.
5. **Coordenação** vê um alerta de sobreposição e de 3 faltas, revisa, e a caixa fica zerada 🎉.
6. **Gestão** vê capacidade × demanda e o gargalo de fonoaudiologia.
7. **Recepção** tenta abrir notas clínicas → acesso negado (CA-08) → **Admin** mostra isso na auditoria (CA-09).

---

## 10. Segurança das chaves

A chave `service_role` (JWT) e a `sb_secret_*` **ignoram todo o RLS** e dão acesso total ao banco.

- Não colocar em repositório, print, documento, app mobile nem variável `NEXT_PUBLIC_`.
- **Rotacionar as chaves** no painel do Supabase (Settings → API) antes de qualquer uso com dados reais.
- `.env.local` (fora do git):

```env
NEXT_PUBLIC_SUPABASE_URL=https://ccgwifyqlsbklgiuardc.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...        # só servidor e seed
```

---

## 11. Decisões pendentes (seção 12 do documento)

Enquanto a Prefeitura não definir, usar valores padrão **editáveis em `system_parameters`**:

| ID | Pergunta | Padrão provisório |
|---|---|---|
| D-02 | Identificador sem CNS | CPF ou, sem ele, nome + nascimento + nome da mãe |
| D-03 | Critérios de P1/P2/P3 | texto de apoio editável; P1 peso 3, P2 peso 2, P3 peso 1 |
| D-04 | Prazo de encaminhamento parado | 7 dias |
| — | Cuidado sem atualização | 30 dias |
| D-05 | O que cada serviço vê | matriz da seção 4 |
| D-08 | Indicadores públicos | todos internos até decisão |
