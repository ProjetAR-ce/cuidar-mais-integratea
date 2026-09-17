# Conformidade com o edital e com o tema

Checklist para a entrega do **Hackathon BNB – Desafio Prefeitura de Crateús** (edital FIT 2026) e do tema **"Sistema Informatizado de Gestão do Cuidado a Pessoas com TEA"** (SEPLATI, 13/09/2026).

Legenda: ✅ atendido · 🟡 parcial / depende de validação da Prefeitura · 📄 evidência

---

## 1. Regras gerais do edital (item 7)

| Regra | Situação | Evidência |
|---|---|---|
| 7.1 Solução original, feita durante o hackathon | ✅ | Histórico de commits de 16 e 17/09/2026; todo o código neste repositório |
| 7.2 Protótipo funcional ou simulação de alta fidelidade | ✅ | Sistema web completo em funcionamento, banco real (Supabase), API e bot |
| 7.3 Código-fonte, documentos técnicos e materiais disponibilizados | ✅ | `web/`, `mobile/`, `supabase/`, `bot/`, `docs/` e APK em Releases |
| 7.4 Uso de frameworks, APIs e IA | ✅ | Next.js, Supabase, AWS Strands/Bedrock; IA usada como apoio ao desenvolvimento |
| 7.5 Pitch de até 7 minutos | ✅ | Roteiro em [PITCH.md](PITCH.md) |

## 2. Critérios de avaliação (item 8)

| Critério | Como o projeto responde | Onde ver |
|---|---|---|
| **Inovação e criatividade** | **Digitalização de fichas em papel por foto** com IA e revisão humana lado a lado; fila **explicável** (cada posição mostra o cálculo); detecção de duplicidade por semelhança; 6 alertas automáticos de cuidado fragmentado; linha do tempo gerada por triggers; assistente de WhatsApp que só usa dados agregados | `/fila`, `/alertas`, `/duplicidades`, `bot/` |
| **Aplicabilidade e relevância** | Construído sobre as fichas reais do NASF e do NAPE (Anexo A) e sobre os 5 serviços citados; parâmetros da rede editáveis sem código (D-03, D-04) | `/pacientes/novo`, `/admin?aba=parametros` |
| **Usabilidade e design** | Design system com a marca Cuidar+; busca Ctrl+K; ações em 1 toque; celebrações discretas; responsivo a partir de 320px; WCAG 2.2 AA testado com axe | `/styleguide`, `e2e/` |
| **Qualidade técnica, funcionamento e LGPD** | TypeScript estrito, lint do React Compiler, build de produção, testes E2E dos 10 critérios de aceite, SQL testado em PGlite, RLS por perfil, auditoria imutável, minimização e separação do dado clínico | [LGPD.md](LGPD.md), `supabase/migrations/` |
| **Escalabilidade e impacto** | Monólito modular com regras no banco; serviços, especialidades, capacidade e formulários configuráveis; API versionada para e-SUS, BI e novos canais; mesmo banco do app das famílias | [API.md](API.md), [PLANO_DESENVOLVIMENTO.md](PLANO_DESENVOLVIMENTO.md) |

## 3. Objetivo do desafio (tema, item 3)

| Necessidade | Situação | Evidência |
|---|---|---|
| 1. Gestão informatizada das filas multidisciplinares | ✅ | `/fila`, `v_queue_ranked`, `/capacidade` |
| 2. Identificação de duplicidade de atendimento | ✅ | `search_patients`, `check_patient_duplicates`, AL-01, AL-02, `/duplicidades` |
| 3. Registro sistemático e contínuo do histórico | ✅ | `journey_events` (triggers), `/pacientes/[id]?aba=jornada`, `record_revisions` |
| 4. Integração entre os serviços | ✅ | encaminhamentos, plano compartilhado, linha do tempo única, API v1 |

## 4. Escopo esperado (tema, item 4)

| Item | Situação | Evidência |
|---|---|---|
| 4.1 Filas com transparência, eficiência e rastreabilidade | ✅ | posição explicada; mudança de prioridade exige justificativa e gera versão e auditoria |
| 4.2 Protocolo padronizado de duplicidades | ✅ | busca obrigatória antes do cadastro (RN-001), CNS/CPF únicos (RN-002), semelhança gera alerta e nunca fusão automática (RN-003), fusão só por coordenação ou admin (RN-004), sobreposição entre serviços (AL-02) |
| 4.3 Primeiro atendimento e encaminhamentos | ✅ | cadastro → triagem → fila → encaminhamento, tudo na linha do tempo |
| 4.3 Histórico de atendimentos, consultas e intervenções | ✅ | registro de sessão com objetivo, síntese, evolução e nº da sessão; plano com passos |
| 4.3 Confirmação de comparecimento ou ausência | ✅ | presente / falta justificada / falta sem justificativa; 3 faltas seguidas geram AL-04 |
| 4.4 Interoperabilidade entre NASF, CREAES, NAPE, Casa Mais Azul e CRASF | ✅ | mesmo cadastro, encaminhamentos com aceite, plano compartilhado, API v1 |

## 5. Requisitos funcionais mínimos (tema, item 6)

| Requisito | Situação |
|---|---|
| Cadastro único evitando duplicidade | ✅ inclusive fichas digitalizadas por foto, que passam pela mesma checagem (`/pacientes/digitalizar`) |
| Fila visível e priorizável por serviço | ✅ |
| Linha do tempo por paciente | ✅ |
| Comparecimento/falta em cada atendimento | ✅ |
| Painel com nº de atendimentos, faltas e encaminhamentos ativos | ✅ `/inicio`, `/indicadores` |
| Compartilhamento entre serviços respeitando sigilo e LGPD | ✅ RLS por perfil; recepção não vê conteúdo clínico; gestão só agregados |

## 6. Fichas usadas hoje pelos serviços (Anexo)

| Ficha | Campos atendidos | Observação |
|---|---|---|
| **A.1 NASF – Prontuário** | nº do prontuário (automático), H.D. (em tabela clínica protegida), data de abertura, nome, CNS, nascimento, mãe, telefone, sexo, raça/cor, endereço, bairro, APS, município/UF, responsável (nome, CNS, nascimento) | ✅ completo |
| **A.2 NAPE – Anamnese psicológica** | identificação, escola, série, turno, zona, dados familiares básicos, queixa/necessidade (triagem), classificação de prioridade e encaminhamento | 🟡 campos extensos de anamnese previstos em `form_definitions` (formulários configuráveis por serviço, RF-020) |
| **A.3 NAPE – Anamnese psicopedagógica** | identificação escolar, queixa, prioridade **urgente / curto prazo / lista de espera** (P1/P2/P3), encaminhamentos internos | 🟡 idem A.2 |
| **A.4 NAPE – Educação física** | identificação, tipo de transtorno, **atendimentos concomitantes** (a própria rede mostra todas as filas e agendas; AL-02 aponta sobreposição) | 🟡 avaliação motora em formulário configurável |
| **A.5 NAPE – Síntese de acompanhamento** | nome, nascimento, **nº da sessão**, data, objetivo, profissional responsável | ✅ completo |

## 7. Checklist da entrega no GitHub

- [x] README com problema, solução, arquitetura, como rodar, contas de demonstração e critérios de aceite
- [x] Código do sistema web (`web/`)
- [x] Código do app das famílias (`mobile/`) e APK publicado em Releases
- [x] Fichas simuladas (preenchida e em branco) para demonstrar a digitalização (`docs/demonstracao/`)
- [x] Scripts SQL versionados e idempotentes (`supabase/migrations/`)
- [x] Script de dados fictícios (`web/scripts/seed.ts`)
- [x] Assistente de WhatsApp (`bot/`) integrado à API pública
- [x] Documentação técnica: plano, API, LGPD, conformidade
- [x] Roteiro do pitch de 7 minutos (`docs/PITCH.md`)
- [x] Testes automatizados (E2E, acessibilidade, bot)
- [x] Nenhum segredo versionado (`.env*` ignorados; só `.env.example`)
- [x] Nomes da equipe no README
- [x] Sistema publicado em https://cuidarmais.projetarsolucoes.com
- [ ] Link do vídeo/demonstração, se a organização pedir
