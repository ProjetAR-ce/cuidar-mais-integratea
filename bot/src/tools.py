from __future__ import annotations

from strands import tool

from .database import DatabaseError, get_network_overview, search_public_knowledge


@tool
def buscar_base_integratea(pergunta: str) -> dict:
    """Busca informações públicas e atualizadas da rede IntegraTEA.

    Use para responder dúvidas sobre serviços, acesso, documentos, horários,
    contatos, encaminhamentos e orientações da rede municipal.

    Args:
        pergunta: Pergunta ou termos que descrevem a informação procurada.
    """
    try:
        results = search_public_knowledge(pergunta)
    except DatabaseError:
        return {
            "ok": False,
            "resultados": [],
            "mensagem": "A base está temporariamente indisponível.",
        }

    return {
        "ok": True,
        "resultados": results,
        "mensagem": (
            "Resultados encontrados."
            if results
            else "Nenhuma informação correspondente foi encontrada."
        ),
    }


@tool
def consultar_rede_integratea(servico: str = "") -> dict:
    """Consulta a situação geral da rede IntegraTEA: serviços, especialidades
    ofertadas e tempo médio de espera por especialidade.

    Os números são agregados e não dizem respeito a nenhuma pessoa. Use para
    perguntas como "quais especialidades o NAPE oferece?" ou "quanto tempo se
    espera, em média, por fonoaudiologia?".

    Args:
        servico: Código ou nome do serviço (NASF, NAPE, CREAES, Casa Mais Azul,
            CRASF). Deixe vazio para ver a rede toda.
    """
    try:
        overview = get_network_overview(servico)
    except DatabaseError:
        return {"ok": False, "mensagem": "Os dados da rede estão temporariamente indisponíveis."}
    return {"ok": True, **overview}
