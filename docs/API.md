# API pública IntegraTEA · v1

API **servidor ↔ servidor** para integrações da rede (assistente de WhatsApp, portais, BI). Contrato OpenAPI 3.1 em `GET /api/v1/openapi.json`.

- **Base:** `https://<domínio>/api/v1`
- **Autenticação:** header `x-api-key: <INTEGRATEA_API_KEY>` (ou `Authorization: Bearer`)
- **Limite:** 60 requisições por minuto por chave
- **Erros:** `application/problem+json` (`title`, `status`, `detail`)
- **Privacidade:** nenhum endpoint devolve dado pessoal ou clínico

## `GET /saude`

Sem autenticação.

```json
{ "status": "ok", "servico": "IntegraTEA / Cuidar+", "versao": "v1", "horario": "2026-09-17T05:29:35.293Z" }
```

## `GET /publico/rede?servico=NAPE`

Serviços, especialidades, vagas mensais e espera **agregada**. `servico` é opcional (código ou parte do nome).

```json
{
  "versao": "v1",
  "rede": { "pessoas_acompanhadas": 98, "atendimentos_ultimos_30_dias": 240, "taxa_comparecimento_30_dias": 82, "encaminhamentos_respondidos_30_dias": 24 },
  "servicos": [{
    "codigo": "NAPE", "nome": "NAPE", "secretaria": "Educação",
    "descricao": "Núcleo de Apoio Pedagógico Especializado",
    "especialidades": [
      { "nome": "Psicopedagogia", "vagas_mes": 40, "pessoas_aguardando": "5", "espera_mediana_dias": 60 },
      { "nome": "Fonoaudiologia", "vagas_mes": 16, "pessoas_aguardando": "menos de 5", "espera_mediana_dias": null }
    ]
  }],
  "aviso": "Dados agregados e fictícios para demonstração. Não contém informação individual."
}
```

> Filas com menos de 5 pessoas aparecem como `"menos de 5"` e sem mediana, para evitar reidentificação.

## `GET /publico/conhecimento?q=documentos&limite=5`

Busca nas orientações públicas **validadas** (`agent_knowledge.published = true`).

```json
{
  "versao": "v1", "consulta": "documentos", "total": 1,
  "resultados": [{ "titulo": "Documentos para o atendimento", "conteudo": "Leve documento com foto…", "servico": "Rede IntegraTEA", "publico": "publico", "atualizado_em": "…" }]
}
```

## Exemplo

```bash
curl -H "x-api-key: $INTEGRATEA_API_KEY" "https://<domínio>/api/v1/publico/rede?servico=CREAES"
```

## Evolução prevista

- `/v1/interno/*` com OAuth2 client credentials para integração com o e-SUS APS e BI da Prefeitura.
- Webhooks de eventos (encaminhamento aceito, alerta criado) para notificações.
