from unittest.mock import MagicMock, patch

import cognito_post_confirmation as post_confirmation


def test_build_signup_email_includes_user_attributes_and_env(monkeypatch):
    monkeypatch.setenv("APP_ENV", "staging")
    event = {
        "userName": "username-123",
        "triggerSource": "PostConfirmation_ConfirmSignUp",
        "request": {
            "userAttributes": {
                "name": "Ada Lovelace",
                "email": "ada@example.com",
                "sub": "abc-123",
            }
        },
    }

    subject, body = post_confirmation._build_signup_email(event)

    assert subject == "New TCP Plan Pro signup: ada@example.com"
    assert "Name: Ada Lovelace" in body
    assert "Email: ada@example.com" in body
    assert "Username: username-123" in body
    assert "User Sub: abc-123" in body
    assert "Trigger Source: PostConfirmation_ConfirmSignUp" in body
    assert "Environment: staging" in body
    assert "Confirmed At: " in body


def test_build_signup_email_uses_fallbacks_and_stage_env(monkeypatch):
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.setenv("STAGE", "prod")
    event = {
        "userName": "fallback-user",
        "request": {"userAttributes": {}},
    }

    subject, body = post_confirmation._build_signup_email(event)

    assert subject == "New TCP Plan Pro signup: fallback-user"
    assert "Name: —" in body
    assert "Email: —" in body
    assert "Username: fallback-user" in body
    assert "User Sub: —" in body
    assert "Trigger Source: —" in body
    assert "Environment: prod" in body


def test_send_signup_email_skips_when_required_env_missing(monkeypatch):
    monkeypatch.delenv("SES_SENDER_EMAIL", raising=False)
    monkeypatch.delenv("SIGNUP_NOTIFY_EMAIL", raising=False)

    with patch("cognito_post_confirmation.boto3.client") as mock_client:
        post_confirmation._send_signup_email("subject", "body")

    mock_client.assert_not_called()


def test_send_signup_email_calls_ses_with_region_and_expected_payload(monkeypatch):
    monkeypatch.setenv("SES_SENDER_EMAIL", "from@example.com")
    monkeypatch.setenv("SIGNUP_NOTIFY_EMAIL", "ops@example.com")
    monkeypatch.setenv("AWS_SES_REGION", "us-west-2")
    mock_ses = MagicMock()

    with patch("cognito_post_confirmation.boto3.client", return_value=mock_ses) as mock_client:
        post_confirmation._send_signup_email("Subject line", "Body text")

    mock_client.assert_called_once_with("ses", region_name="us-west-2")
    mock_ses.send_email.assert_called_once()
    kwargs = mock_ses.send_email.call_args.kwargs
    assert kwargs["Source"] == "from@example.com"
    assert kwargs["Destination"] == {"ToAddresses": ["ops@example.com"]}
    assert kwargs["Message"]["Subject"]["Data"] == "Subject line"
    assert kwargs["Message"]["Body"]["Text"]["Data"] == "Body text"
    assert kwargs["ReplyToAddresses"] == ["from@example.com"]


def test_handler_ignores_non_confirmation_triggers():
    event = {"triggerSource": "PreSignUp_SignUp"}

    with patch("cognito_post_confirmation._build_signup_email") as mock_build, patch(
        "cognito_post_confirmation._send_signup_email"
    ) as mock_send:
        result = post_confirmation.handler(event, context=None)

    assert result is event
    mock_build.assert_not_called()
    mock_send.assert_not_called()


def test_handler_sends_for_confirm_signup_trigger():
    event = {"triggerSource": "PostConfirmation_ConfirmSignUp"}

    with patch("cognito_post_confirmation._build_signup_email", return_value=("subject", "body")) as mock_build, patch(
        "cognito_post_confirmation._send_signup_email"
    ) as mock_send:
        result = post_confirmation.handler(event, context=None)

    assert result is event
    mock_build.assert_called_once_with(event)
    mock_send.assert_called_once_with("subject", "body")


def test_handler_sends_for_confirm_forgot_password_trigger():
    event = {"triggerSource": "PostConfirmation_ConfirmForgotPassword"}

    with patch("cognito_post_confirmation._build_signup_email", return_value=("subject", "body")) as mock_build, patch(
        "cognito_post_confirmation._send_signup_email"
    ) as mock_send:
        result = post_confirmation.handler(event, context=None)

    assert result is event
    mock_build.assert_called_once_with(event)
    mock_send.assert_called_once_with("subject", "body")


def test_handler_swallows_email_errors_and_returns_event():
    event = {"triggerSource": "PostConfirmation_ConfirmSignUp"}

    with patch("cognito_post_confirmation._build_signup_email", return_value=("subject", "body")), patch(
        "cognito_post_confirmation._send_signup_email", side_effect=RuntimeError("ses down")
    ), patch("cognito_post_confirmation.logger.exception") as mock_log:
        result = post_confirmation.handler(event, context=None)

    assert result is event
    mock_log.assert_called_once_with("Failed to send signup notification email")
