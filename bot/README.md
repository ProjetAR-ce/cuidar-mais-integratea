# Agente IntegraTEA em Python com AWS Strands e WhatsApp

Esta implementação recebe mensagens do WhatsApp, executa um agente criado com a
biblioteca Python `strands-agents`, permite que o agente consulte uma base
pública no Supabase por meio de uma `@tool` e envia a resposta ao usuário.

## Arquitetura

```text
Usuário no WhatsApp
        |
        v
Meta WhatsApp Cloud API
        |
        v
API Gateway -> Lambda webhook -> SQS -> Lambda worker
                                      |       |
                                      |       +-> Strands + Amazon Bedrock
                                      |                 |
                                      |                 +-> tool buscar_base_integratea
                                      |                            |
                                      |                            +-> Supabase RPC
                                      |
                                      +-----------------------------> resposta pela Graph API
```

A Lambda do webhook valida `X-Hub-Signature-256`, coloca a mensagem na fila e
retorna HTTP 200 rapidamente. A Lambda worker processa uma mensagem por vez. Uma
tabela DynamoDB evita responder duas vezes ao mesmo `message_id` quando a Meta ou
o SQS repetirem uma entrega.

## Integração com o sistema web (recomendado)

O bot consome a **API pública versionada** do sistema web (`web/src/app/api/v1`),
em vez de acessar o banco diretamente. Assim a Lambda **não precisa de nenhuma
chave do Supabase**: ela usa só uma chave de API com escopo de leitura pública.

| Tool Strands | Endpoint | O que devolve |
| --- | --- | --- |
| `buscar_base_integratea` | `GET /api/v1/publico/conhecimento?q=` | orientações públicas validadas |
| `consultar_rede_integratea` | `GET /api/v1/publico/rede?servico=` | especialidades, vagas e espera **agregada** |

Variáveis: `INTEGRATEA_API_URL` (ex.: `https://seu-dominio/api/v1`) e
`INTEGRATEA_API_KEY` (a mesma definida no servidor web). Filas com menos de
5 pessoas são devolvidas como faixa ("menos de 5") para evitar reidentificação.
Sem essas variáveis, o bot volta ao modo legado (RPC do Supabase).

Testes: `python -m unittest discover -s tests -v` (7 testes, sem rede).

## Arquivos

- `src/prompt.py`: prompt de sistema do agente;
- `src/tools.py`: tool Strands `buscar_base_integratea`;
- `src/database.py`: cliente somente leitura para a RPC do Supabase;
- `src/agent.py`: criação e execução do `Agent` e do `BedrockModel`;
- `src/webhook_handler.py`: verificação e recebimento do webhook;
- `src/worker_handler.py`: processamento assíncrono e deduplicação;
- `src/whatsapp.py`: assinatura, leitura do payload e envio pela Graph API;
- `template.yaml`: infraestrutura AWS SAM;
- `agent_knowledge.sql.referencia`: versão original da base pública (a versão aplicada está em `supabase/migrations/20260917_003_edital_api_publica.sql`).

O prompt segue os limites do edital: o agente acolhe e orienta, mas não realiza
diagnóstico, prescrição ou decisão clínica. Ele não consulta prontuários ou dados
pessoais pelo WhatsApp.

## 1. Preparar o Supabase

No SQL Editor do projeto Supabase, execute:

```sql
-- conteúdo de supabase/agent_knowledge.sql
```

Depois, revise os três registros iniciais e cadastre informações oficialmente
validadas, como endereço, telefone, horário, documentos e fluxo de acesso de cada
serviço. Só conteúdo com `published = true` aparece para o agente.

Exemplo:

```sql
insert into public.agent_knowledge
  (title, content, service, audience, published)
values
  (
    'Como acessar o NAPE',
    'Substitua este texto pelo fluxo oficial validado pela Prefeitura.',
    'NAPE',
    'publico',
    false
  );
```

Não coloque CNS, CPF, laudos, prontuários, situação individual de fila ou outros
dados pessoais nessa tabela. A RPC só pode ser executada com a `service_role`.

## 2. Preparar AWS e Bedrock

Pré-requisitos:

- Python 3.12;
- AWS CLI autenticada;
- AWS SAM CLI;
- acesso ao modelo escolhido habilitado no Amazon Bedrock;
- permissão para criar Lambda, API Gateway, SQS, DynamoDB e papéis IAM.

Para conferir os helpers sem chamar serviços externos:

```bash
cd aws/whatsapp-agent
python3 -m unittest discover -s tests -v
```

Para conversar localmente com o mesmo agente, configure credenciais AWS e as
variáveis do Supabase, depois execute:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export AWS_REGION=us-east-1
export BEDROCK_MODEL_ID=global.anthropic.claude-haiku-4-5-20251001-v1:0
export SUPABASE_URL=https://SEU-PROJETO.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=SUA_CHAVE_SERVER_SIDE
python -m src.agent
```

Use `aws configure`, uma role AWS ou outro método suportado pelo SDK para as
credenciais do Bedrock. Não grave chaves reais no repositório.

Para implantar:

```bash
cd aws/whatsapp-agent
sam build
sam deploy --guided
```

Durante `sam deploy --guided`, informe:

| Parâmetro | Origem |
| --- | --- |
| `MetaVerifyToken` | uma senha longa criada por você |
| `MetaAppSecret` | Meta App Dashboard > App settings > Basic |
| `WhatsAppAccessToken` | token permanente de System User da Meta |
| `WhatsAppPhoneNumberId` | WhatsApp > API Setup > Phone number ID |
| `WhatsAppApiVersion` | versão vigente da Graph API, por exemplo `v24.0` |
| `SupabaseUrl` | URL do projeto Supabase |
| `SupabaseServiceRoleKey` | chave server-side `service_role` |
| `BedrockModelId` | model ID habilitado no Bedrock |

Ao fim do deploy, copie o output `WebhookUrl`.

Para produção, mova `MetaAppSecret`, `WhatsAppAccessToken` e
`SupabaseServiceRoleKey` para AWS Secrets Manager e restrinja quem pode ler as
variáveis das Lambdas. `NoEcho` apenas mascara os parâmetros na interface; não é
um cofre de segredos.

## 3. Configurar o WhatsApp Cloud API

1. Crie ou abra um app do tipo Business no
   [Meta for Developers](https://developers.facebook.com/apps/).
2. Adicione o produto **WhatsApp** e conclua o **API Setup**.
3. Em **WhatsApp > Configuration > Webhook**, informe:
   - Callback URL: o `WebhookUrl` gerado pelo SAM;
   - Verify token: exatamente o valor usado em `MetaVerifyToken`.
4. Valide o webhook. A Meta fará um `GET`; a Lambda devolverá `hub.challenge`.
5. Assine o campo **messages** para a WhatsApp Business Account.
6. Para teste, adicione o telefone destinatário permitido e mande uma mensagem
   ao número de teste fornecido pela Meta.
7. Antes de produção, vincule o número definitivo, conclua a verificação do
   negócio e gere um token permanente de System User com as permissões exigidas
   pela WhatsApp Business Platform.

O `MetaAppSecret` é usado para conferir a assinatura de todos os `POST`s. Não
desative essa verificação. A documentação de referência está em
[Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/),
[Webhooks](https://developers.facebook.com/docs/graph-api/webhooks/getting-started)
e [Strands em AWS Lambda](https://strandsagents.com/docs/user-guide/deploy/deploy_to_aws_lambda/).

## 4. Como o agente chama a busca

A tool é uma função Python comum decorada pelo Strands:

```python
from strands import tool

@tool
def buscar_base_integratea(pergunta: str) -> dict:
    """Busca informações públicas da rede IntegraTEA."""
    ...
```

O prompt instrui o modelo a chamar a tool quando a pergunta tratar de serviços,
acesso, contatos, horários, documentos ou encaminhamentos. A função chama
`/rest/v1/rpc/search_agent_knowledge`; não entrega SQL ao modelo e não permite
que ele escolha tabelas ou comandos.

Cada mensagem cria uma nova instância de `Agent`. Isso é intencional: reutilizar
uma instância global faria o histórico de um telefone vazar para outro. Se for
necessário manter contexto, acrescente armazenamento por telefone com expiração,
consentimento, minimização de dados e revisão LGPD.

## 5. Teste ponta a ponta

Depois do cadastro do webhook:

1. envie `O que é o IntegraTEA?` para o número conectado;
2. acompanhe os logs das funções `WebhookFunction` e `AgentWorkerFunction` no
   CloudWatch;
3. confira a fila de mensagens mortas se houver três falhas consecutivas;
4. teste uma pergunta sem resposta na base para confirmar que o agente não
   inventa informação;
5. teste um pedido de prontuário para confirmar que o canal recusa a consulta
   individual.

Durante a janela iniciada pelo usuário, o worker pode responder com texto livre.
Mensagens iniciadas pela organização fora da janela aplicável exigem templates
aprovados e devem seguir as políticas atuais da Meta.

## Operação e segurança antes do piloto

- use dados fictícios no hackathon;
- obtenha base legal e faça revisão LGPD antes de tratar dados reais;
- não registre corpo de mensagens, tokens ou respostas da base em logs;
- configure alarmes para erros da Lambda e mensagens na dead-letter queue;
- restrinja a chave Supabase à Lambda worker e faça rotação periódica;
- valide todo conteúdo publicado com os responsáveis dos serviços;
- defina transferência para atendimento humano;
- revise retenção, auditoria, consentimento e procedimento de incidente.
