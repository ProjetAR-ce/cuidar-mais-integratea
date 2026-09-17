from __future__ import annotations

import io
import json
import unittest
from unittest.mock import patch

from src.database import get_network_overview, search_public_knowledge

ENV = {"INTEGRATEA_API_URL": "https://exemplo.gov.br/api/v1", "INTEGRATEA_API_KEY": "chave-teste"}


class _FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class ApiClientTest(unittest.TestCase):
    @patch.dict("os.environ", ENV, clear=False)
    @patch("src.database.urlopen")
    def test_knowledge_uses_api_with_key_header(self, urlopen_mock) -> None:
        urlopen_mock.return_value = _FakeResponse(json.dumps({
            "resultados": [{"titulo": "NAPE", "conteudo": "Atende estudantes", "servico": "NAPE", "cpf": "nao-deve-vazar"}]
        }).encode())
        rows = search_public_knowledge("como acessar o nape")
        request = urlopen_mock.call_args.args[0]
        self.assertIn("/publico/conhecimento?q=como+acessar+o+nape", request.full_url)
        self.assertEqual(request.get_header("X-api-key"), "chave-teste")
        self.assertEqual(rows, [{"title": "NAPE", "content": "Atende estudantes", "service": "NAPE"}])

    @patch.dict("os.environ", ENV, clear=False)
    @patch("src.database.urlopen")
    def test_network_overview_keeps_only_aggregates(self, urlopen_mock) -> None:
        urlopen_mock.return_value = _FakeResponse(json.dumps({
            "servicos": [{"nome": "NAPE", "especialidades": [{"nome": "AEE", "pessoas_aguardando": "menos de 5", "espera_mediana_dias": None, "paciente": "X"}]}],
            "rede": {"pessoas_acompanhadas": 90},
        }).encode())
        data = get_network_overview("nape")
        self.assertEqual(data["servicos"][0]["especialidades"][0], {"nome": "AEE", "pessoas_aguardando": "menos de 5", "espera_mediana_dias": None})
        self.assertIn("servico=nape", urlopen_mock.call_args.args[0].full_url)

    def test_short_query_returns_nothing(self) -> None:
        self.assertEqual(search_public_knowledge("a"), [])


if __name__ == "__main__":
    unittest.main()
