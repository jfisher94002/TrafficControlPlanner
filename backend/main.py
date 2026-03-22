import logging
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from mangum import Mangum

from models import ExportRequest
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

    safe = "".join(c if c.isalnum() or c in "-_ " else "_" for c in payload.name)[:40].strip() or "plan"
    filename = f"{safe}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# AWS Lambda entrypoint
handler = Mangum(app)
