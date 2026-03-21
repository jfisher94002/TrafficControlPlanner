from __future__ import annotations
from typing import Annotated, Literal, Optional, Union
from pydantic import BaseModel, Field


# ─── SIGN & DEVICE DATA ───────────────────────────────────────────────────────

class SignData(BaseModel):
    id: str
    label: str
    shape: Literal["diamond", "rect", "octagon", "circle", "triangle", "shield"]
    color: str
    textColor: str
    border: Optional[str] = None


class DeviceData(BaseModel):
    id: str
    label: str
    icon: str
    color: str


# ─── CANVAS OBJECTS ───────────────────────────────────────────────────────────

class Point(BaseModel):
    x: float
    y: float


class StraightRoadObject(BaseModel):
    id: str
    type: Literal["road"]
    x1: float
    y1: float
    x2: float
    y2: float
    width: float
    realWidth: float
    lanes: int
    roadType: str


class PolylineRoadObject(BaseModel):
    id: str
    type: Literal["polyline_road"]
    points: list[Point]
    width: float
    realWidth: float
    lanes: int
    roadType: str
    smooth: bool


class CurveRoadObject(BaseModel):
    id: str
    type: Literal["curve_road"]
    points: list[Point]
    width: float
    realWidth: float
    lanes: int
    roadType: str


class SignObject(BaseModel):
    id: str
    type: Literal["sign"]
    x: float
    y: float
    signData: SignData
    rotation: float
    scale: float


class DeviceObject(BaseModel):
    id: str
    type: Literal["device"]
    x: float
    y: float
    deviceData: DeviceData
    rotation: float


class ZoneObject(BaseModel):
    id: str
    type: Literal["zone"]
    x: float
    y: float
    w: float
    h: float


class ArrowObject(BaseModel):
    id: str
    type: Literal["arrow"]
    x1: float
    y1: float
    x2: float
    y2: float
    color: str


class TextObject(BaseModel):
    id: str
    type: Literal["text"]
    x: float
    y: float
    text: str
    fontSize: float
    bold: bool
    color: str


class MeasureObject(BaseModel):
    id: str
    type: Literal["measure"]
    x1: float
    y1: float
    x2: float
    y2: float


class TaperObject(BaseModel):
    id: str
    type: Literal["taper"]
    x: float
    y: float
    rotation: float
    laneWidth: float
    speed: float
    taperLength: float
    manualLength: bool
    numLanes: int


CanvasObject = Annotated[
    Union[
        StraightRoadObject,
        PolylineRoadObject,
        CurveRoadObject,
        SignObject,
        DeviceObject,
        ZoneObject,
        ArrowObject,
        TextObject,
        MeasureObject,
        TaperObject,
    ],
    Field(discriminator="type"),
]


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
