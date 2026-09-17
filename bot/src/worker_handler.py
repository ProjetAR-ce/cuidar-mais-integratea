from __future__ import annotations

import json
import os
import time
from typing import Any

from .agent import answer_user
from .whatsapp import send_text_message


def _claim_message(table: Any, message_id: str) -> bool:
    try:
        table.put_item(
            Item={
                "message_id": message_id,
                "expires_at": int(time.time()) + 7 * 24 * 60 * 60,
            },
            ConditionExpression="attribute_not_exists(message_id)",
        )
        return True
    except Exception as exc:
        error_code = (
            getattr(exc, "response", {}).get("Error", {}).get("Code")
        )
        if error_code == "ConditionalCheckFailedException":
            return False
        raise


def handler(event: dict[str, Any], _context: Any) -> dict:
    import boto3

    table = boto3.resource("dynamodb").Table(os.environ["DEDUPE_TABLE"])
    processed = 0

    for record in event.get("Records", []):
        message = json.loads(record["body"])
        message_id = message["id"]
        if not _claim_message(table, message_id):
            continue

        try:
            answer = answer_user(message["text"])
            send_text_message(
                recipient=message["from"],
                text=answer,
                access_token=os.environ["WHATSAPP_ACCESS_TOKEN"],
                phone_number_id=os.environ["WHATSAPP_PHONE_NUMBER_ID"],
                api_version=os.getenv("WHATSAPP_API_VERSION", "v24.0"),
                reply_to_message_id=message_id,
            )
            processed += 1
        except Exception:
            # Libera o ID para que a nova tentativa do SQS possa processá-lo.
            table.delete_item(Key={"message_id": message_id})
            raise

    return {"processed": processed}
