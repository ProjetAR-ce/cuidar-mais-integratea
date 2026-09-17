from __future__ import annotations

import hashlib
import hmac
import unittest
from unittest.mock import patch

from src.webhook_handler import handler
from src.whatsapp import extract_text_messages, verify_meta_signature


class WhatsAppHelpersTest(unittest.TestCase):
    def test_validates_meta_signature(self) -> None:
        body = b'{"object":"whatsapp_business_account"}'
        secret = "segredo"
        signature = "sha256=" + hmac.new(
            secret.encode(), body, hashlib.sha256
        ).hexdigest()
        self.assertTrue(verify_meta_signature(body, signature, secret))
        self.assertFalse(verify_meta_signature(body + b"x", signature, secret))

    def test_extracts_only_text_messages(self) -> None:
        payload = {
            "entry": [
                {
                    "changes": [
                        {
                            "value": {
                                "messages": [
                                    {
                                        "id": "wamid.1",
                                        "from": "5588999999999",
                                        "type": "text",
                                        "text": {"body": "Como consigo atendimento?"},
                                    },
                                    {"id": "wamid.2", "from": "55", "type": "image"},
                                ]
                            }
                        }
                    ]
                }
            ]
        }
        self.assertEqual(
            extract_text_messages(payload),
            [
                {
                    "id": "wamid.1",
                    "from": "5588999999999",
                    "text": "Como consigo atendimento?",
                }
            ],
        )

    @patch.dict("os.environ", {"META_VERIFY_TOKEN": "token-de-teste"})
    def test_answers_webhook_verification(self) -> None:
        event = {
            "requestContext": {"http": {"method": "GET"}},
            "queryStringParameters": {
                "hub.mode": "subscribe",
                "hub.verify_token": "token-de-teste",
                "hub.challenge": "123456",
            },
        }
        response = handler(event, None)
        self.assertEqual(response["statusCode"], 200)
        self.assertEqual(response["body"], "123456")

    @patch.dict("os.environ", {"META_APP_SECRET": "segredo"})
    def test_rejects_invalid_post_signature(self) -> None:
        event = {
            "requestContext": {"http": {"method": "POST"}},
            "headers": {"x-hub-signature-256": "sha256=invalida"},
            "body": "{}",
        }
        response = handler(event, None)
        self.assertEqual(response["statusCode"], 401)


if __name__ == "__main__":
    unittest.main()
