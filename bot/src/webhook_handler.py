from __future__ import annotations

import base64
import json
import os
from typing import Any

from .whatsapp import extract_text_messages, verify_meta_signature


def _response(status: int, body: str, content_type: str = "text/plain") -> dict:
    return {
        "statusCode": status,
        "headers": {"content-type": f"{content_type}; charset=utf-8"},
        "body": body,
    }


def _header(event: dict[str, Any], name: str) -> str | None:
    wanted = name.lower()
    for key, value in (event.get("headers") or {}).items():
        if key.lower() == wanted:
            return value
    return None


def _raw_body(event: dict[str, Any]) -> bytes:
    body = event.get("body") or ""
    if event.get("isBase64Encoded"):
        return base64.b64decode(body)
    return body.encode("utf-8")


def handler(event: dict[str, Any], _context: Any) -> dict:
    method = (
        event.get("requestContext", {}).get("http", {}).get("method")
        or event.get("httpMethod")
        or ""
    ).upper()

    if method == "GET":
        query = event.get("queryStringParameters") or {}
        valid = (
            query.get("hub.mode") == "subscribe"
            and query.get("hub.verify_token") == os.getenv("META_VERIFY_TOKEN")
        )
        return _response(200, query.get("hub.challenge", "")) if valid else _response(403, "")

    if method != "POST":
        return _response(405, "Método não permitido")

    body = _raw_body(event)
    if not verify_meta_signature(
        body, _header(event, "x-hub-signature-256"), os.getenv("META_APP_SECRET", "")
    ):
        return _response(401, "Assinatura inválida")

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return _response(400, "JSON inválido")

    messages = extract_text_messages(payload)
    if messages:
        import boto3

        queue = boto3.client("sqs")
        queue_url = os.environ["QUEUE_URL"]
        for message in messages:
            queue.send_message(QueueUrl=queue_url, MessageBody=json.dumps(message))

    # A Meta exige confirmação rápida; o processamento ocorre pelo worker SQS.
    return _response(200, "EVENT_RECEIVED")
