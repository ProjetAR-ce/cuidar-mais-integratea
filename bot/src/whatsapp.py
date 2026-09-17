from __future__ import annotations

import hashlib
import hmac
import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class WhatsAppError(RuntimeError):
    """Falha de comunicação com a WhatsApp Cloud API."""


def verify_meta_signature(body: bytes, signature: str | None, app_secret: str) -> bool:
    if not signature or not signature.startswith("sha256=") or not app_secret:
        return False
    expected = "sha256=" + hmac.new(
        app_secret.encode("utf-8"), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def extract_text_messages(payload: dict[str, Any]) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = []
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            for message in value.get("messages", []):
                if message.get("type") != "text":
                    continue
                message_id = str(message.get("id", "")).strip()
                sender = str(message.get("from", "")).strip()
                text = str(message.get("text", {}).get("body", "")).strip()
                if message_id and sender and text:
                    messages.append({"id": message_id, "from": sender, "text": text})
    return messages


def _split_text(text: str, limit: int = 4_000) -> list[str]:
    remaining = text.strip()
    chunks: list[str] = []
    while remaining:
        if len(remaining) <= limit:
            chunks.append(remaining)
            break
        split_at = remaining.rfind("\n", 0, limit)
        if split_at < limit // 2:
            split_at = remaining.rfind(" ", 0, limit)
        if split_at < limit // 2:
            split_at = limit
        chunks.append(remaining[:split_at].strip())
        remaining = remaining[split_at:].strip()
    return chunks


def send_text_message(
    *,
    recipient: str,
    text: str,
    access_token: str,
    phone_number_id: str,
    api_version: str,
    reply_to_message_id: str | None = None,
) -> None:
    endpoint = (
        f"https://graph.facebook.com/{api_version}/{phone_number_id}/messages"
    )
    for index, chunk in enumerate(_split_text(text)):
        payload: dict[str, Any] = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": recipient,
            "type": "text",
            "text": {"preview_url": False, "body": chunk},
        }
        if index == 0 and reply_to_message_id:
            payload["context"] = {"message_id": reply_to_message_id}

        request = Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "authorization": f"Bearer {access_token}",
                "content-type": "application/json",
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=10) as response:
                response.read()
        except HTTPError as exc:
            raise WhatsAppError(f"WhatsApp respondeu com status {exc.code}") from exc
        except (URLError, TimeoutError) as exc:
            raise WhatsAppError("Não foi possível enviar a mensagem") from exc
