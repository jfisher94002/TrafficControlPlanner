import logging
import os
from datetime import datetime, timezone

import boto3
from botocore.exceptions import BotoCoreError, ClientError

logger = logging.getLogger(__name__)


def _build_signup_email(event: dict) -> tuple[str, str]:
    attrs = event.get("request", {}).get("userAttributes", {}) or {}
    username = event.get("userName", "")
    trigger_source = event.get("triggerSource", "")

    name = attrs.get("name") or "—"
    email = attrs.get("email") or "—"
    user_sub = attrs.get("sub") or "—"
    confirmed_at = datetime.now(timezone.utc).isoformat()
    app_env = os.getenv("APP_ENV", os.getenv("STAGE", "unknown"))

    subject = f"New TCP Plan Pro signup: {email if email != '—' else username}"
    body = "\n".join([
        "A new user completed signup for TCP Plan Pro.",
        "",
        f"Name: {name}",
        f"Email: {email}",
        f"Username: {username or '—'}",
        f"User Sub: {user_sub}",
        f"Trigger Source: {trigger_source or '—'}",
        f"Confirmed At: {confirmed_at}",
        f"Environment: {app_env}",
    ])
    return subject, body


def _send_signup_email(subject: str, body_text: str) -> None:
    sender = os.getenv("SES_SENDER_EMAIL", "")
    recipient = os.getenv("SIGNUP_NOTIFY_EMAIL", "")
    if not sender or not recipient:
        logger.warning("Signup email skipped — missing SES_SENDER_EMAIL or SIGNUP_NOTIFY_EMAIL")
        return

    ses_kwargs: dict = {}
    ses_region = os.getenv("AWS_SES_REGION")
    if ses_region:
        ses_kwargs["region_name"] = ses_region
    ses = boto3.client("ses", **ses_kwargs)
    ses.send_email(
        Source=sender,
        Destination={"ToAddresses": [recipient]},
        Message={
            "Subject": {"Data": subject, "Charset": "UTF-8"},
            "Body": {"Text": {"Data": body_text, "Charset": "UTF-8"}},
        },
        ReplyToAddresses=[sender],
    )


def handler(event, context):
    # Only notify on newly confirmed signups; return event unchanged for Cognito.
    trigger_source = event.get("triggerSource", "")
    if trigger_source != "PostConfirmation_ConfirmSignUp":
        return event

    try:
        subject, body = _build_signup_email(event)
        _send_signup_email(subject, body)
    except (ClientError, BotoCoreError, Exception):
        logger.exception("Failed to send signup notification email")

    return event
