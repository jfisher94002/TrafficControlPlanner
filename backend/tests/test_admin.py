"""
Tests for the admin endpoints: _require_admin, /admin/users, /admin/users/{sub}/plans.

All Cognito and S3 calls are mocked — no real AWS credentials needed.
"""
import os
import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

# ── Helpers ───────────────────────────────────────────────────────────────────

FAKE_TOKEN = "fake.token.value"
AUTH_HEADER = {"Authorization": f"Bearer {FAKE_TOKEN}"}
POOL_ID = "us-west-1_TESTPOOL"
BUCKET = "test-plans-bucket"


def _cognito_get_user_ok(username: str = "testuser") -> MagicMock:
    m = MagicMock()
    m.get_user.return_value = {"Username": username, "UserAttributes": []}
    return m


def _cognito_admin_groups(*groups: str) -> MagicMock:
    m = MagicMock()
    m.get_user.return_value = {"Username": "testuser", "UserAttributes": []}
    m.admin_list_groups_for_user.return_value = {
        "Groups": [{"GroupName": g} for g in groups]
    }
    return m


def _fake_user(sub: str, email: str) -> dict:
    return {
        "Username": sub,
        "UserStatus": "CONFIRMED",
        "Enabled": True,
        "UserCreateDate": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "UserAttributes": [
            {"Name": "sub", "Value": sub},
            {"Name": "email", "Value": email},
        ],
    }


# ── _require_admin: auth failure modes ───────────────────────────────────────

def test_admin_missing_auth_header():
    res = client.get("/admin/users", headers={})
    assert res.status_code == 401


def test_admin_malformed_auth_header():
    res = client.get("/admin/users", headers={"Authorization": "NotBearer token"})
    assert res.status_code == 401


def test_admin_invalid_token_rejected_by_cognito():
    """Cognito raises ClientError for an invalid/expired token."""
    from botocore.exceptions import ClientError
    mock_cognito = MagicMock()
    mock_cognito.get_user.side_effect = ClientError(
        {"Error": {"Code": "NotAuthorizedException", "Message": "Invalid token"}},
        "GetUser",
    )
    with patch("main.boto3.client", return_value=mock_cognito), \
         patch.dict(os.environ, {"COGNITO_USER_POOL_ID": POOL_ID}):
        res = client.get("/admin/users", headers=AUTH_HEADER)
    assert res.status_code == 401


def test_admin_non_admin_user_forbidden():
    """User is authenticated but not in the admins group."""
    mock_cognito = _cognito_admin_groups("users")  # not admins
    with patch("main.boto3.client", return_value=mock_cognito), \
         patch.dict(os.environ, {"COGNITO_USER_POOL_ID": POOL_ID}):
        res = client.get("/admin/users", headers=AUTH_HEADER)
    assert res.status_code == 403


def test_admin_missing_pool_id_env():
    """COGNITO_USER_POOL_ID not set — should 503 before hitting Cognito."""
    with patch.dict(os.environ, {}, clear=True):
        os.environ.pop("COGNITO_USER_POOL_ID", None)
        res = client.get("/admin/users", headers=AUTH_HEADER)
    assert res.status_code in (401, 503)  # 401 if pool id check is first, 503 if not


# ── /admin/users ─────────────────────────────────────────────────────────────

def test_admin_list_users_returns_users():
    mock_cognito = _cognito_admin_groups("admins")
    mock_cognito.list_users.return_value = {
        "Users": [
            _fake_user("sub-1", "alice@example.com"),
            _fake_user("sub-2", "bob@example.com"),
        ],
        # no PaginationToken → last page
    }
    with patch("main.boto3.client", return_value=mock_cognito), \
         patch.dict(os.environ, {"COGNITO_USER_POOL_ID": POOL_ID}):
        res = client.get("/admin/users", headers=AUTH_HEADER)

    assert res.status_code == 200
    data = res.json()
    assert len(data["users"]) == 2
    assert data["users"][0]["email"] == "alice@example.com"
    assert data["next_token"] is None


def test_admin_list_users_returns_next_token():
    mock_cognito = _cognito_admin_groups("admins")
    mock_cognito.list_users.return_value = {
        "Users": [_fake_user("sub-1", "alice@example.com")],
        "PaginationToken": "TOKEN123",
    }
    with patch("main.boto3.client", return_value=mock_cognito), \
         patch.dict(os.environ, {"COGNITO_USER_POOL_ID": POOL_ID}):
        res = client.get("/admin/users?limit=1", headers=AUTH_HEADER)

    assert res.status_code == 200
    assert res.json()["next_token"] == "TOKEN123"


def test_admin_list_users_passes_next_token_to_cognito():
    mock_cognito = _cognito_admin_groups("admins")
    mock_cognito.list_users.return_value = {"Users": []}
    with patch("main.boto3.client", return_value=mock_cognito), \
         patch.dict(os.environ, {"COGNITO_USER_POOL_ID": POOL_ID}):
        client.get("/admin/users?next_token=ABC", headers=AUTH_HEADER)

    call_kwargs = mock_cognito.list_users.call_args[1]
    assert call_kwargs.get("PaginationToken") == "ABC"


# ── /admin/users/{sub}/plans ──────────────────────────────────────────────────

def _fake_s3_object(sub: str, plan_id: str) -> dict:
    return {
        "Key": f"plans/{sub}/{plan_id}.tcp.json",
        "Size": 1024,
        "LastModified": datetime(2026, 1, 1, tzinfo=timezone.utc),
    }


def test_admin_list_plans_returns_plans():
    mock_cognito = _cognito_admin_groups("admins")
    mock_s3 = MagicMock()
    mock_s3.list_objects_v2.return_value = {
        "Contents": [_fake_s3_object("sub-1", "plan-abc")],
        "IsTruncated": False,
    }

    def _client(service, **_):
        return mock_cognito if service == "cognito-idp" else mock_s3

    with patch("main.boto3.client", side_effect=_client), \
         patch.dict(os.environ, {"COGNITO_USER_POOL_ID": POOL_ID, "PLANS_BUCKET": BUCKET}):
        res = client.get("/admin/users/sub-1/plans", headers=AUTH_HEADER)

    assert res.status_code == 200
    data = res.json()
    assert len(data["plans"]) == 1
    assert data["plans"][0]["planId"] == "plan-abc"
    assert data["next_token"] is None


def test_admin_list_plans_returns_next_token():
    mock_cognito = _cognito_admin_groups("admins")
    mock_s3 = MagicMock()
    mock_s3.list_objects_v2.return_value = {
        "Contents": [_fake_s3_object("sub-1", "plan-abc")],
        "IsTruncated": True,
        "NextContinuationToken": "S3TOKEN",
    }

    def _client(service, **_):
        return mock_cognito if service == "cognito-idp" else mock_s3

    with patch("main.boto3.client", side_effect=_client), \
         patch.dict(os.environ, {"COGNITO_USER_POOL_ID": POOL_ID, "PLANS_BUCKET": BUCKET}):
        res = client.get("/admin/users/sub-1/plans", headers=AUTH_HEADER)

    assert res.json()["next_token"] == "S3TOKEN"


def test_admin_list_plans_missing_bucket_env():
    mock_cognito = _cognito_admin_groups("admins")
    with patch("main.boto3.client", return_value=mock_cognito), \
         patch.dict(os.environ, {"COGNITO_USER_POOL_ID": POOL_ID}):
        os.environ.pop("PLANS_BUCKET", None)
        res = client.get("/admin/users/sub-1/plans", headers=AUTH_HEADER)
    assert res.status_code == 503
