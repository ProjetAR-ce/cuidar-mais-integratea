# Banco de dados (Supabase / PostgreSQL)

O banco é **compartilhado** pelo sistema web, pelo app mobile das famílias e (via API) pelo assistente de WhatsApp. Todas as migrações são **aditivas** e **idempotentes**.

## Ordem de execução

Supabase → SQL Editor → colar o arquivo → Run.

| Arquivo | O que faz |
|---|---|
| `20260916_001_cuidar_mais_web.sql` | Novas colunas e tabelas (especialidades, capacidade, plano compartilhado, duplicidades, parâmetros, versões, formulários); funções de perfil; **RLS**; triggers de normalização, bloqueio de exclusão, versões, **auditoria**, **linha do tempo** e **alertas AL-01 a AL-06**; views `v_queue_ranked` e `v_agenda`; RPCs de negócio; indicadores; dados de referência |
| `20260916_002_ajustes_fase3.sql` | Indicadores no fuso de Crateús; nomes dos serviços no fluxo de encaminhamentos; versão do atendimento só em correções |
| `20260917_003_edital_api_publica.sql` | Campos das fichas NASF/NAPE; informação clínica separada; `create_patient` atualizado; base pública do WhatsApp; visão agregada para a API |
| `20260917_004_app_familias.sql` | App das famílias: agenda visível ao responsável, **notificações automáticas** (consulta agendada/cancelada, encaminhamento, entrada na fila) e avisos/notícias |

## Dados de demonstração

```bash
cd web && npm run seed
```

Cria 30 usuários fictícios (senha `Cuidar+2026`), cerca de 160 pacientes, 1.500 atendimentos em 6 meses, encaminhamentos, planos e **casos montados para cada alerta**.

## Testes das migrações

As migrações foram validadas em PostgreSQL 17 embutido (PGlite), simulando `auth.uid()`, os papéis `authenticated`/`service_role` e o schema original. Os testes cobriram cadastro, duplicidade, RLS por perfil, bloqueio de exclusão, triagem, fila, agenda, versões, encaminhamento com complemento, plano, alertas, fusão, indicadores e acesso do responsável.

## Regras principais

| Regra | Implementação |
|---|---|
| RN-001 busca antes do cadastro | `create_patient` exige `patient.search` do mesmo usuário nos últimos 30 min |
| RN-002 CNS único | índice único parcial + normalização |
| RN-003/004 duplicidade | trigger cria candidato e alerta; `resolve_duplicate` só para coordenação/admin |
| RN-005/007 fila | colunas obrigatórias + `v_queue_ranked` (pontos de prioridade + dias de espera) |
| RN-006 justificativa | `create_triage` e `update_queue_priority` exigem texto |
| RN-008 encaminhamento | `respond_referral` só pelo serviço de destino |
| RN-009 sem exclusão | trigger `tg_block_delete` + `record_revisions` |
| RN-010 três faltas | trigger `tg_detect_absences` (AL-04) |
| RN-011 sobreposição | trigger `tg_detect_overlap` (AL-02) |
| AL-03/05/06 | `run_care_alert_checks()` (pg_cron a cada 30 min, se disponível, ou pelas telas) |
