from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from mangum import Mangum

from models import ExportRequest
from pdf_generator import build_pdf

app = FastAPI(title="TCP Export API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    safe = "".join(c if c.isalnum() or c in "-_ " else "_" for c in payload.name)[:40].strip() or "plan"
    filename = f"{safe}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# AWS Lambda entrypoint
handler = Mangum(app)
