from __future__ import annotations

import json
import os
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


class DatabaseError(RuntimeError):
    """Erro seguro ao consultar a base pública do agente."""


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise DatabaseError(f"Configuração obrigatória ausente: {name}")
    return value


def _api_configured() -> bool:
    return bool(os.getenv("INTEGRATEA_API_URL", "").strip() and os.getenv("INTEGRATEA_API_KEY", "").strip())


def _get_json(url: str, headers: dict[str, str]) -> Any:
    request = Request(url, headers={"accept": "application/json", **headers}, method="GET")
    try:
        with urlopen(request, timeout=8) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        # Não inclui corpo nem credenciais na exceção/log.
        raise DatabaseError(f"A API respondeu com status {exc.code}") from exc
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise DatabaseError("Não foi possível consultar a API neste momento") from exc


def _api_get(path: str, params: dict[str, Any] | None = None) -> Any:
    """Chama a API pública do IntegraTEA (web/src/app/api/v1). A chave fica só no servidor."""
    base = _required_env("INTEGRATEA_API_URL").rstrip("/")
    query = f"?{urlencode({k: v for k, v in (params or {}).items() if v not in (None, '')})}" if params else ""
    return _get_json(f"{base}{path}{query}", {"x-api-key": _required_env("INTEGRATEA_API_KEY")})


def search_public_knowledge(query: str, limit: int = 5) -> list[dict[str, Any]]:
    """Busca orientações públicas validadas.

    Preferência: API pública do IntegraTEA (o bot não precisa de chave do banco).
    Alternativa legada: RPC do Supabase com chave server-side.
    """
    normalized_query = " ".join(query.split()).strip()[:500]
    if len(normalized_query) < 2:
        return []

    if _api_configured():
        payload = _api_get("/publico/conhecimento", {"q": normalized_query, "limite": max(1, min(limit, 8))})
        rows = payload.get("resultados", []) if isinstance(payload, dict) else []
        mapping = {"titulo": "title", "conteudo": "content", "servico": "service", "publico": "audience", "atualizado_em": "updated_at"}
        return [
            {mapping[k]: v for k, v in row.items() if k in mapping and v is not None}
            for row in rows[:8]
            if isinstance(row, dict)
        ]

    supabase_url = _required_env("SUPABASE_URL").rstrip("/")
    service_key = _required_env("SUPABASE_SERVICE_ROLE_KEY")
    request = Request(
        f"{supabase_url}/rest/v1/rpc/search_agent_knowledge",
        data=json.dumps(
            {"search_query": normalized_query, "result_limit": max(1, min(limit, 8))}
        ).encode("utf-8"),
        headers={
            "apikey": service_key,
            "authorization": f"Bearer {service_key}",
            "content-type": "application/json",
            "accept": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        raise DatabaseError(f"A base respondeu com status {exc.code}") from exc
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise DatabaseError("Não foi possível consultar a base neste momento") from exc

    if not isinstance(payload, list):
        raise DatabaseError("A base retornou um formato inesperado")

    allowed_fields = ("title", "content", "service", "audience", "updated_at")
    return [
        {field: row.get(field) for field in allowed_fields if row.get(field) is not None}
        for row in payload[:8]
        if isinstance(row, dict)
    ]


def get_network_overview(service: str = "") -> dict[str, Any]:
    """Serviços, especialidades, vagas e espera agregada da rede (sem dado pessoal)."""
    payload = _api_get("/publico/rede", {"servico": service.strip()[:60]} if service.strip() else None)
    if not isinstance(payload, dict):
        raise DatabaseError("A API retornou um formato inesperado")

    services = []
    for item in payload.get("servicos", [])[:10]:
        if not isinstance(item, dict):
            continue
        services.append(
            {
                "nome": item.get("nome"),
                "descricao": item.get("descricao"),
                "secretaria": item.get("secretaria"),
                "endereco": item.get("endereco"),
                "telefone": item.get("telefone"),
                "especialidades": [
                    {
                        "nome": sp.get("nome"),
                        "pessoas_aguardando": sp.get("pessoas_aguardando"),
                        "espera_mediana_dias": sp.get("espera_mediana_dias"),
                    }
                    for sp in item.get("especialidades", [])
                    if isinstance(sp, dict)
                ],
            }
        )
    return {"servicos": services, "rede": payload.get("rede", {}), "aviso": payload.get("aviso")}
