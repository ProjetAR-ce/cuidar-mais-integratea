from __future__ import annotations

import os

from strands import Agent
from strands.models import BedrockModel

from .prompt import SYSTEM_PROMPT
from .tools import buscar_base_integratea, consultar_rede_integratea


def build_agent() -> Agent:
    """Cria um agente novo para impedir mistura de conversas entre usuários."""
    model = BedrockModel(
        model_id=os.getenv(
            "BEDROCK_MODEL_ID", "global.anthropic.claude-haiku-4-5-20251001-v1:0"
        ),
        region_name=os.getenv("AWS_REGION", "us-east-1"),
        temperature=0.1,
    )
    return Agent(
        model=model,
        system_prompt=SYSTEM_PROMPT,
        tools=[buscar_base_integratea, consultar_rede_integratea],
        callback_handler=None,
    )


def answer_user(message: str) -> str:
    clean_message = " ".join(message.split()).strip()[:2_000]
    if not clean_message:
        return "Envie sua dúvida sobre os serviços do IntegraTEA."

    result = build_agent()(clean_message)
    answer = str(result).strip()
    return answer or "Não consegui formular uma resposta agora. Tente novamente."


if __name__ == "__main__":
    print(answer_user(input("Você: ")))
