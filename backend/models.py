from __future__ import annotations
from typing import Literal, Optional, Union
from pydantic import BaseModel, ConfigDict, Field, field_validator

from sanitize import sanitize_text


# ─── SIGN DATA ────────────────────────────────────────────────────────────────

class SignData(BaseModel):
    id: str
    label: str = Field(max_length=50)
    shape: Literal["diamond", "rect", "octagon", "circle", "triangle", "shield"]
    color: str
    textColor: str
    border: Optional[str] = None


# ─── CANVAS OBJECTS ───────────────────────────────────────────────────────────

class SignObject(BaseModel):
    id: str
    type: Literal["sign"]
    x: float
    y: float
    signData: SignData
    rotation: float
    scale: float


class OtherCanvasObject(BaseModel):
    """Passthrough for any non-sign canvas object. Accepts arbitrary fields."""
    model_config = ConfigDict(extra="allow")
    type: str


CanvasObject = Union[SignObject, OtherCanvasObject]


# ─── PLAN STRUCTURE ───────────────────────────────────────────────────────────

class CanvasState(BaseModel):
    objects: list[CanvasObject] = Field(default_factory=list, max_length=1000)


class PlanMeta(BaseModel):
    projectNumber: str = Field(default="", max_length=50)
    client: str = Field(default="", max_length=200)
    location: str = Field(default="", max_length=200)
    notes: str = Field(default="", max_length=2000)

    @field_validator("projectNumber", "client", "location", "notes", mode="before")
    @classmethod
    def sanitize_meta_strings(cls, v: object) -> object:
        return sanitize_text(v) if isinstance(v, str) else v


class MapCenter(BaseModel):
    lat: float
    lng: float
    zoom: float


# ─── FEEDBACK / ISSUE CREATION ────────────────────────────────────────────────

class CreateIssueRequest(BaseModel):
    issue_type: Literal["bug", "feature", "enhancement", "question"]
    title: str = Field(max_length=200)
    body: str = Field(max_length=5000)
    priority: Literal["low", "medium", "high", "critical"]
    submitter_name: str = Field(max_length=100)


# ─── EXPORT REQUEST ───────────────────────────────────────────────────────────

# ~7.5 MB decoded image; enough for a high-res canvas screenshot
_MAX_IMAGE_B64_LEN = 10_000_000

class ExportRequest(BaseModel):
    id: str
    name: str = Field(max_length=200)
    createdAt: str
    updatedAt: str
    userId: Optional[str] = None
    mapCenter: Optional[MapCenter] = None
    canvasOffset: dict = Field(default_factory=lambda: {"x": 0, "y": 0})
    canvasZoom: float = 1.0
    canvasState: CanvasState
    metadata: PlanMeta = Field(default_factory=PlanMeta)
    canvas_image_b64: Optional[str] = Field(default=None, max_length=_MAX_IMAGE_B64_LEN)

    @field_validator("name", mode="before")
    @classmethod
    def sanitize_name(cls, v: object) -> object:
        return sanitize_text(v) if isinstance(v, str) else v
