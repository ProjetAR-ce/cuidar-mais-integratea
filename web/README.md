# Cuidar+ Web

Sistema web do IntegraTEA (Next.js 16). Documentação completa no [README principal](../README.md).

```bash
cp .env.example .env.local
npm install
npm run seed
npm run dev
```

## Variáveis de ambiente

| Variável | Onde | Para quê |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | navegador e servidor | conexão com o Supabase sob RLS |
| `SUPABASE_SECRET_KEY` | só servidor e seed | dados fictícios e rotinas administrativas |
| `INTEGRATEA_API_KEY` | só servidor | API pública v1 consumida pelo bot do WhatsApp |
| `ANTHROPIC_API_KEY` | só servidor | **digitalização de fichas em papel** (Claude com visão) |
| `ANTHROPIC_MODEL` | opcional | modelo da leitura (padrão `claude-sonnet-5`) |

## Digitalização de fichas

- Tela: `src/app/(app)/pacientes/digitalizar/` (captura, leitura e revisão).
- Leitura: `src/lib/actions/scan.ts` (Server Action com checagem de perfil, limite de 4 MB, saída estruturada por ferramenta e validação de CNS, CPF e datas).
- Revisão: reaproveita `pacientes/novo/new-patient-form.tsx` no modo `review`, com a mesma validação e checagem de duplicidade.
- Fichas simuladas: [`../docs/demonstracao`](../docs/demonstracao).
