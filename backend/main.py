import json
import logging
import os
import urllib.error
import urllib.request

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from mangum import Mangum

from models import CreateIssueRequest, ExportRequest
from pdf_generator import build_pdf

logger = logging.getLogger(__name__)

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
    try:
        pdf_bytes = build_pdf(payload)
    except Exception:
        logger.exception("PDF generation failed")
        raise HTTPException(status_code=500, detail="PDF generation failed")

    safe = "".join(c if (c.isascii() and c.isalnum()) or c in "-_ " else "_" for c in payload.name)[:40].strip() or "plan"
    filename = f"{safe}.pdf"

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
def create_issue(payload: CreateIssueRequest):
    if not payload.submitter_id:
        raise HTTPException(status_code=403, detail="Forbidden: must submit from the app.")

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
        import boto3
        from botocore.exceptions import BotoCoreError, ClientError
        ses_kwargs: dict = {}
        ses_region = os.getenv("AWS_SES_REGION")
        if ses_region:
            ses_kwargs["region_name"] = ses_region
        ses = boto3.client("ses", **ses_kwargs)
        ses.send_email(**send_kwargs)
    except (ClientError, BotoCoreError, Exception):
        logger.exception("SES email failed — continuing")


# AWS Lambda entrypoint
handler = Mangum(app)
