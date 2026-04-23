import atexit
import base64
import json
import logging
import os
import time
import urllib.error
import urllib.request
from collections import defaultdict

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from posthog import Posthog

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from mangum import Mangum

from models import CreateIssueRequest, ExportRequest
from pdf_generator import build_pdf

logger = logging.getLogger(__name__)

# ─── POSTHOG ─────────────────────────────────────────────────────────────────
posthog_client = Posthog(
    api_key=os.getenv("POSTHOG_PROJECT_TOKEN", ""),
    host=os.getenv("POSTHOG_HOST"),
    enable_exception_autocapture=True,
)
atexit.register(posthog_client.shutdown)

# ─── IP RATE LIMITER ─────────────────────────────────────────────────────────
# In-memory per Lambda instance: max 3 submissions per IP per hour.
# Not perfectly global (Lambda has many instances) but catches unsophisticated
# flooding from a single source without requiring DynamoDB.
_RATE_LIMIT_MAX = 3
_RATE_LIMIT_WINDOW = 3600  # seconds

_ip_submissions: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(ip: str) -> None:
    now = time.time()
    window_start = now - _RATE_LIMIT_WINDOW
    hits = [t for t in _ip_submissions[ip] if t > window_start]
    if len(hits) >= _RATE_LIMIT_MAX:
        logger.warning("Rate limit hit for IP %s", ip)
        posthog_client.capture(
            "anonymous",
            "feedback_rate_limited",
            properties={"submissions_in_window": len(hits)},
        )
        posthog_client.flush()
        raise HTTPException(status_code=429, detail="Too many submissions. Please try again later.")
    hits.append(now)
    _ip_submissions[ip] = hits

# Comma-separated list of allowed origins.  Set ALLOWED_ORIGINS in the
# deployment environment to restrict access (e.g. "https://example.com").
# Defaults to "*" so local development works without extra config.
_raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
ALLOWED_ORIGINS: list[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()] or ["*"]

app = FastAPI(title="TCP Export API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/export-pdf")
def export_pdf(payload: ExportRequest) -> Response:
    distinct_id = payload.userId or "anonymous"
    try:
        pdf_bytes = build_pdf(payload)
    except Exception as exc:
        logger.exception("PDF generation failed")
        posthog_client.capture_exception(exc, distinct_id=distinct_id)
        posthog_client.capture(
            distinct_id,
            "pdf_export_failed",
            properties={
                "object_count": len(payload.canvasState.objects),
                "has_canvas_image": payload.canvas_image_b64 is not None,
            },
        )
        posthog_client.flush()
        raise HTTPException(status_code=500, detail="PDF generation failed")

    safe = "".join(c if (c.isascii() and c.isalnum()) or c in "-_ " else "_" for c in payload.name)[:40].strip() or "plan"
    filename = f"{safe}.pdf"

    posthog_client.capture(
        distinct_id,
        "pdf_exported",
        properties={
            "object_count": len(payload.canvasState.objects),
            "has_canvas_image": payload.canvas_image_b64 is not None,
            "has_map_center": payload.mapCenter is not None,
            "pdf_size_bytes": len(pdf_bytes),
        },
    )
    posthog_client.flush()

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


_LABEL_MAP = {
    "bug":         ["bug", "backlog"],
    "feature":     ["enhancement", "feature request", "backlog"],
    "enhancement": ["enhancement", "backlog"],
    "question":    ["question", "backlog"],
}

_PRIORITY_EMOJI = {"low": "🟢", "medium": "🟡", "high": "🟠", "critical": "🔴"}


@app.post("/create-issue")
def create_issue(payload: CreateIssueRequest, request: Request):
    # Honeypot — should always be empty for real users
    if payload.website:
        logger.warning("Honeypot triggered — dropping submission")
        posthog_client.capture(
            "anonymous",
            "feedback_blocked_honeypot",
            properties={"issue_type": payload.issue_type},
        )
        posthog_client.flush()
        raise HTTPException(status_code=400, detail="Invalid submission.")

    # Time-on-form check — bots submit instantly
    if payload.time_on_form < 3:
        logger.warning("Submission too fast (%.1fs) — dropping", payload.time_on_form)
        posthog_client.capture(
            "anonymous",
            "feedback_blocked_speed",
            properties={"time_on_form": payload.time_on_form, "issue_type": payload.issue_type},
        )
        posthog_client.flush()
        raise HTTPException(status_code=400, detail="Invalid submission.")

    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown").split(",")[0].strip()
    _check_rate_limit(ip)

    token = os.getenv("GITHUB_TOKEN", "")
    repo = os.getenv("GITHUB_REPO", "jfisher94002/TrafficControlPlanner")

    if not token:
        raise HTTPException(status_code=503, detail="Issue creation is not configured on this server.")

    def _md_escape(s: str) -> str:
        """Strip newlines and escape markdown special characters."""
        s = s.replace("\r", "").replace("\n", " ")
        return s.replace("\\", "\\\\").replace("`", "\\`").replace("*", "\\*").replace("_", "\\_").replace("[", "\\[").replace("]", "\\]")

    priority_label = f"{_PRIORITY_EMOJI[payload.priority]} {payload.priority.capitalize()}"
    submitter_line = _md_escape(payload.submitter_name)
    if payload.submitter_email:
        submitter_line += f" ({_md_escape(payload.submitter_email)})"
    if payload.submitter_id:
        submitter_line += f" — user ID: `{_md_escape(payload.submitter_id)}`"
    issue_body = (
        f"## {payload.issue_type.capitalize()} Report\n\n"
        f"**Submitted by:** {submitter_line}\n"
        f"**Priority:** {priority_label}\n"
        f"**Type:** {payload.issue_type}\n\n"
        f"---\n\n"
        f"{payload.body}\n\n"
        f"---\n*Submitted via TCP Feedback Portal*"
    )

    data = json.dumps({
        "title": f"[{payload.issue_type.upper()}] {payload.title}",
        "body": issue_body,
        "labels": _LABEL_MAP[payload.issue_type],
    }).encode()

    req = urllib.request.Request(
        f"https://api.github.com/repos/{repo}/issues",
        data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req) as resp:
            issue = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = json.loads(e.read())
        logger.error("GitHub API error: %s", body)
        raise HTTPException(status_code=502, detail="Failed to create GitHub issue.")

    _send_feedback_email(payload, issue["number"], issue["html_url"])

    distinct_id = payload.submitter_id or "anonymous"
    posthog_client.capture(
        distinct_id,
        "feedback_submitted",
        properties={
            "issue_type": payload.issue_type,
            "priority": payload.priority,
            "issue_number": issue["number"],
            "title_length": len(payload.title),
            "body_length": len(payload.body),
            "has_submitter_id": payload.submitter_id is not None,
        },
    )
    posthog_client.flush()

    return {"issue_number": issue["number"], "html_url": issue["html_url"]}


def _send_feedback_email(payload: CreateIssueRequest, issue_number: int, issue_url: str) -> None:
    """Send a notification email via SES. Non-fatal — logs errors but never raises."""
    sender = os.getenv("SES_SENDER_EMAIL", "")
    if not sender:
        return

    subject = f"[TCP Feedback #{issue_number}] {payload.title}"
    body_lines = [
        f"New feedback submitted via TCP Plan Pro.",
        "",
        f"Issue: {issue_url}",
        f"Type: {payload.issue_type}",
        f"Priority: {payload.priority}",
        f"Submitted by: {payload.submitter_name}",
    ]
    if payload.submitter_email:
        body_lines.append(f"Submitter email: {payload.submitter_email}")
    body_lines += [
        "",
        "--- Feedback ---",
        payload.body,
    ]
    body_text = "\n".join(body_lines)

    message: dict = {
        "Subject": {"Data": subject, "Charset": "UTF-8"},
        "Body": {"Text": {"Data": body_text, "Charset": "UTF-8"}},
    }
    send_kwargs: dict = {
        "Source": sender,
        "Destination": {"ToAddresses": [sender]},
        "Message": message,
    }
    if payload.submitter_email:
        send_kwargs["ReplyToAddresses"] = [payload.submitter_email]

    try:
        ses_kwargs: dict = {}
        ses_region = os.getenv("AWS_SES_REGION")
        if ses_region:
            ses_kwargs["region_name"] = ses_region
        ses = boto3.client("ses", **ses_kwargs)
        ses.send_email(**send_kwargs)
    except (ClientError, BotoCoreError, Exception):
        logger.exception("SES email failed — continuing")


# ─── ADMIN ───────────────────────────────────────────────────────────────────

def _decode_jwt_payload(token: str) -> dict:
    """Base64url-decode the JWT payload segment (no signature verification).
    Signature integrity is delegated to Cognito at issuance; we only need the
    claims to check group membership for the admin guard."""
    try:
        payload_b64 = token.split(".")[1]
        # JWT base64url may omit padding
        padded = payload_b64 + "=" * (4 - len(payload_b64) % 4)
        return json.loads(base64.urlsafe_b64decode(padded))
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Malformed token.") from exc


def _require_admin(request: Request) -> dict:
    """Verify the caller's Cognito JWT and assert membership in the admins group."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header.")
    claims = _decode_jwt_payload(auth.removeprefix("Bearer ").strip())
    if "admins" not in claims.get("cognito:groups", []):
        raise HTTPException(status_code=403, detail="Admin access required.")
    return claims


@app.get("/admin/users")
def admin_list_users(request: Request):
    """List all Cognito user pool users. Requires admins group membership."""
    _require_admin(request)
    user_pool_id = os.getenv("COGNITO_USER_POOL_ID", "")
    if not user_pool_id:
        raise HTTPException(status_code=503, detail="Admin not configured (missing COGNITO_USER_POOL_ID).")

    cognito = boto3.client("cognito-idp")
    users: list[dict] = []
    kwargs: dict = {"UserPoolId": user_pool_id, "Limit": 60}
    while True:
        page = cognito.list_users(**kwargs)
        for u in page.get("Users", []):
            attrs = {a["Name"]: a["Value"] for a in u.get("UserAttributes", [])}
            users.append({
                "sub":      attrs.get("sub", u["Username"]),
                "email":    attrs.get("email", ""),
                "username": u["Username"],
                "status":   u["UserStatus"],
                "created":  u["UserCreateDate"].isoformat(),
                "enabled":  u["Enabled"],
            })
        token = page.get("PaginationToken")
        if not token:
            break
        kwargs["PaginationToken"] = token

    return {"users": users}


@app.get("/admin/users/{user_sub}/plans")
def admin_list_user_plans(user_sub: str, request: Request):
    """List S3 plan objects for a given user sub. Requires admins group membership."""
    _require_admin(request)
    plans_bucket = os.getenv("PLANS_BUCKET", "")
    if not plans_bucket:
        raise HTTPException(status_code=503, detail="Admin not configured (missing PLANS_BUCKET).")

    s3 = boto3.client("s3")
    prefix = f"plans/{user_sub}/"
    plans: list[dict] = []
    kwargs: dict = {"Bucket": plans_bucket, "Prefix": prefix}
    while True:
        page = s3.list_objects_v2(**kwargs)
        for obj in page.get("Contents", []):
            key: str = obj["Key"]
            if key.endswith(".tcp.json"):
                plans.append({
                    "key":          key,
                    "planId":       key.split("/")[-1].replace(".tcp.json", ""),
                    "size":         obj["Size"],
                    "lastModified": obj["LastModified"].isoformat(),
                })
        if not page.get("IsTruncated"):
            break
        kwargs["ContinuationToken"] = page["NextContinuationToken"]

    return {"plans": plans}


# AWS Lambda entrypoint
handler = Mangum(app)
