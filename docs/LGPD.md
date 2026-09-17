# Proteção de dados (LGPD) no Cuidar+

O sistema trata **dados pessoais sensíveis de saúde de crianças e adolescentes** (LGPD, arts. 11 e 14). As medidas abaixo estão implementadas no protótipo; as da seção 6 dependem da Prefeitura.

## 1. Finalidade e minimização

- **Finalidade única:** coordenar o cuidado entre os serviços da rede municipal. Não é prontuário hospitalar e não faz decisão clínica automática (RN-013).
- **Coleta mínima:** o cadastro pede só os campos das fichas oficiais do NASF e do NAPE. Documentos (CNS/CPF) são opcionais quando não existem.
- **Separação do dado clínico:** hipótese diagnóstica e medicação ficam em `patient_clinical_info`, fora da identificação, e só a equipe clínica lê.
- **Descrições da linha do tempo** registram o *fato* ("Triagem realizada · P1 · Fonoaudiologia"), nunca o conteúdo clínico.

## 2. Acesso por necessidade (RLS no banco)

| Dado | Recepção | Profissional | Coordenação | Gestão | Admin | Responsável |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Identificação do paciente | ✅ | ✅ | ✅ | — | ✅ | só dependentes |
| Agenda (sem conteúdo clínico) | ✅ via `v_agenda` | ✅ | ✅ | — | ✅ | só dependentes |
| Triagem, sessões, linha do tempo, encaminhamentos, plano | — | ✅ | ✅ | — | ✅ | só dependentes |
| Informação clínica (H.D.) | — | ✅ | ✅ | — | ✅ | — |
| Indicadores | — | — | ✅ | ✅ **agregados** | ✅ | — |
| Auditoria | — | — | — | — | ✅ | — |

- As permissões são aplicadas **no PostgreSQL** (políticas RLS e RPCs com checagem de perfil). A interface só esconde o que o banco já bloqueia.
- Profissionais só triam, encaminham e alteram a fila **do próprio serviço**.
- Tentativas de abrir áreas sem permissão geram `access.denied` na auditoria.

## 3. Rastreabilidade (RF-019, RNF-008)

- `audit_logs` guarda login, logout, buscas de paciente (sem o texto buscado), **consultas sensíveis**, criações, alterações (com os campos alterados), fusões, exportações e acessos negados.
- Logs são **imutáveis**: triggers bloqueiam `UPDATE` e `DELETE` para usuários da aplicação.
- **Nada é apagado** (RN-009): exclusões são bloqueadas e toda alteração gera versão em `record_revisions`.

## 4. Dados expostos para fora do sistema

- **API pública v1** e **WhatsApp:** somente conteúdo público e números **agregados**. Filas com menos de 5 pessoas aparecem como faixa ("menos de 5"), o que reduz o risco de reidentificação.
- O bot **não pede nem recebe** CNS, CPF, laudos ou dados clínicos, e recusa consultas individuais.
- **Exportação de indicadores:** CSV só com agregados; cada exportação é auditada.

## 5. Segurança técnica

- HTTPS; sessão do Supabase Auth renovada no servidor (`proxy.ts`).
- Chave secreta do banco **somente no servidor**. O navegador usa a chave publicável e a RLS limita o acesso.
- O bot usa uma chave de API própria, comparada em tempo constante, com limite de 60 requisições por minuto.
- Senhas geridas pelo Supabase Auth; usuários desativados são bloqueados imediatamente.
- Dados de demonstração **100% fictícios** (RN-014), com CNS e CPF gerados.

## 6. Antes do piloto (responsabilidade da Prefeitura)

- Definir base legal (execução de políticas públicas, art. 7º III e art. 11 II "b") e o encarregado (DPO).
- Validar perfis (D-05), retenção e correção de registros (D-07) e indicadores públicos (D-08).
- Elaborar o RIPD (Relatório de Impacto) e os termos entre Saúde, Educação e Assistência Social.
- Ativar MFA para administradores, backup com teste de restauração e procedimento de incidente.
- **Trocar todas as chaves** usadas no hackathon.
