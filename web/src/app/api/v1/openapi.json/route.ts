import { NextResponse } from "next/server";

/** Contrato versionado da API pública (RNF-012) */
const spec = {
  openapi: "3.1.0",
  info: {
    title: "IntegraTEA · API pública",
    version: "1.0.0",
    description:
      "API servidor↔servidor para integrações da rede IntegraTEA de Crateús, como o assistente de WhatsApp. Devolve somente conteúdo público e números agregados; nenhum endpoint expõe dado pessoal ou clínico (LGPD).",
  },
  servers: [{ url: "/api/v1" }],
  security: [{ ApiKey: [] }],
  components: {
    securitySchemes: { ApiKey: { type: "apiKey", in: "header", name: "x-api-key" } },
    schemas: {
      Problem: { type: "object", properties: { title: { type: "string" }, status: { type: "integer" }, detail: { type: "string" } } },
    },
  },
  paths: {
    "/saude": { get: { summary: "Disponibilidade", security: [], responses: { "200": { description: "Serviço no ar" } } } },
    "/publico/rede": {
      get: {
        summary: "Serviços, especialidades, vagas e espera agregada",
        parameters: [{ name: "servico", in: "query", required: false, schema: { type: "string" }, description: "Código ou parte do nome (ex.: NAPE)" }],
        responses: {
          "200": { description: "Visão pública da rede. Filas com menos de 5 pessoas aparecem como faixa para evitar reidentificação." },
          "401": { description: "Chave inválida", content: { "application/problem+json": { schema: { $ref: "#/components/schemas/Problem" } } } },
          "429": { description: "Limite de 60 requisições por minuto" },
        },
      },
    },
    "/publico/conhecimento": {
      get: {
        summary: "Busca nas orientações públicas validadas",
        parameters: [
          { name: "q", in: "query", required: true, schema: { type: "string", minLength: 2, maxLength: 500 } },
          { name: "limite", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 8, default: 5 } },
        ],
        responses: { "200": { description: "Resultados da base pública" }, "400": { description: "Consulta inválida" }, "401": { description: "Chave inválida" } },
      },
    },
  },
};

export function GET() {
  return NextResponse.json(spec, { headers: { "cache-control": "public, max-age=3600" } });
}
