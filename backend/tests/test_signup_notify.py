"""
Tests for cognito_post_confirmation Lambda handler.

All SES/boto3 calls are mocked — no real AWS credentials needed.
"""
import os
import pytest
from unittest.mock import MagicMock, patch, call

import cognito_post_confirmation as mod


# ── Helpers ───────────────────────────────────────────────────────────────────

def _event(trigger_source: str = "PostConfirmation_ConfirmSignUp", **attr_overrides) -> dict:
    attrs = {
        "sub": "abc-123",
        "email": "user@example.com",
        "name": "Alice",
        **attr_overrides,
    }
    return {
        "triggerSource": trigger_source,
        "userName": "alice",
        "request": {"userAttributes": attrs},
        "version": "1",
    }


_SES_ENVS = {
    "SES_SENDER_EMAIL": "sender@example.com",
    "SIGNUP_NOTIFY_EMAIL": "admin@example.com",
}


# ── trigger filtering ─────────────────────────────────────────────────────────

def test_forgot_password_trigger_skipped():
    """ConfirmForgotPassword must be a no-op — no email sent."""
    event = _event("PostConfirmation_ConfirmForgotPassword")
    with patch("cognito_post_confirmation.boto3") as mock_boto3:
        result = mod.handler(event, {})
    mock_boto3.client.assert_not_called()
    assert result is event


def test_unknown_trigger_skipped():
    event = _event("SomeOtherTrigger")
    with patch("cognito_post_confirmation.boto3") as mock_boto3:
        result = mod.handler(event, {})
    mock_boto3.client.assert_not_called()
    assert result is event


def test_confirm_signup_trigger_sends_email():
    """PostConfirmation_ConfirmSignUp must call SES when env vars are set."""
    mock_ses = MagicMock()
    with patch("cognito_post_confirmation.boto3.client", return_value=mock_ses), \
         patch.dict(os.environ, _SES_ENVS):
        result = mod.handler(_event(), {})
    mock_ses.send_email.assert_called_once()
    assert result["triggerSource"] == "PostConfirmation_ConfirmSignUp"


# ── env-var guard ─────────────────────────────────────────────────────────────

def test_missing_sender_email_skips_ses():
    with patch("cognito_post_confirmation.boto3") as mock_boto3, \
         patch.dict(os.environ, {"SIGNUP_NOTIFY_EMAIL": "admin@example.com"}, clear=True):
        os.environ.pop("SES_SENDER_EMAIL", None)
        mod.handler(_event(), {})
    mock_boto3.client.assert_not_called()


def test_missing_notify_email_skips_ses():
    with patch("cognito_post_confirmation.boto3") as mock_boto3, \
         patch.dict(os.environ, {"SES_SENDER_EMAIL": "sender@example.com"}, clear=True):
        os.environ.pop("SIGNUP_NOTIFY_EMAIL", None)
        mod.handler(_event(), {})
    mock_boto3.client.assert_not_called()


# ── SES error handling ────────────────────────────────────────────────────────

def test_ses_client_error_swallowed():
    """SES failure must not propagate — Cognito must still get the event back."""
    from botocore.exceptions import ClientError
    mock_ses = MagicMock()
    mock_ses.send_email.side_effect = ClientError(
        {"Error": {"Code": "MessageRejected", "Message": "Email address not verified"}},
        "SendEmail",
    )
    with patch("cognito_post_confirmation.boto3.client", return_value=mock_ses), \
         patch.dict(os.environ, _SES_ENVS):
        result = mod.handler(_event(), {})
    assert result["triggerSource"] == "PostConfirmation_ConfirmSignUp"


# ── email content ─────────────────────────────────────────────────────────────

def test_email_subject_uses_email_when_present():
    subject, _ = mod._build_signup_email(_event())
    assert "user@example.com" in subject


def test_email_subject_falls_back_to_username():
    event = _event(email=None)  # attrs.get("email") returns None → "—"
    event["userName"] = "alice"
    subject, _ = mod._build_signup_email(event)
    assert "alice" in subject


def test_email_subject_falls_back_to_dash_when_both_missing():
    event = _event(email=None)
    event["userName"] = ""
    subject, _ = mod._build_signup_email(event)
    assert subject.endswith("—")


def test_email_body_contains_key_fields():
    _, body = mod._build_signup_email(_event())
    assert "user@example.com" in body
    assert "Alice" in body
    assert "abc-123" in body
    assert "PostConfirmation_ConfirmSignUp" in body
