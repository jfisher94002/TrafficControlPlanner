from __future__ import annotations
from typing import Literal, Optional, Union
from pydantic import BaseModel, ConfigDict, Field


# ─── SIGN DATA ────────────────────────────────────────────────────────────────

class SignData(BaseModel):
    id: str
    label: str
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
    objects: list[CanvasObject]


class PlanMeta(BaseModel):
    projectNumber: str = ""
    client: str = ""
    location: str = ""
    notes: str = ""


class MapCenter(BaseModel):
    lat: float
    lng: float
    zoom: float


# ─── FEEDBACK / ISSUE CREATION ────────────────────────────────────────────────

class CreateIssueRequest(BaseModel):
    issue_type: Literal["bug", "feature", "enhancement", "question"]
    title: str
    body: str
    priority: Literal["low", "medium", "high", "critical"]
    submitter_name: str


# ─── EXPORT REQUEST ───────────────────────────────────────────────────────────

class ExportRequest(BaseModel):
    id: str
    name: str
    createdAt: str
    updatedAt: str
    userId: Optional[str] = None
    mapCenter: Optional[MapCenter] = None
    canvasOffset: dict = Field(default_factory=lambda: {"x": 0, "y": 0})
    canvasZoom: float = 1.0
    canvasState: CanvasState
    metadata: PlanMeta = Field(default_factory=PlanMeta)
    canvas_image_b64: Optional[str] = None
