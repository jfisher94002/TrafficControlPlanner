import { useCallback } from 'react';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type React from 'react';
import type {
  CanvasObject, StraightRoadObject, PolylineRoadObject, CurveRoadObject, CubicBezierRoadObject,
  SignObject, DeviceObject, TaperObject, TurnLaneObject,
  SignData, DeviceData, RoadType, DrawStart, PanStart, MapCenter, Point, SnapResult,
} from '../types';
import {
  uid, dist, geoRoadWidthPx, snapToEndpoint, sampleBezier, sampleCubicBezier,
  distToPolyline, isPointObject, isLineObject, isMultiPointRoad, calcTaperLength,
} from '../utils';
import { SNAP_RADIUS, MIN_ZOOM, MAX_ZOOM } from '../features/tcp/constants';
import { createIntersectionRoads } from '../features/tcp/planUtils';
import { track } from '../analytics';

// px-per-foot scale for taper hit-radius calculation — matches TaperShape in ObjectShapes.tsx
const TAPER_SCALE = 3;
import { latLonToPixel, pixelToLatLon } from '../components/tcp/canvas/MiniMap';

interface CanvasEventsProps {
  // Tool state
  tool: string;
  roadDrawMode: string;
  intersectionType: 't' | '4way';
  snapEnabled: boolean;
  // World state
  objects: CanvasObject[];
  selected: string | null;
  zoom: number;
  offset: Point;
  mapCenter: MapCenter | null;
  // Palette
  selectedSign: SignData | null;
  selectedDevice: DeviceData | null;
  selectedRoadType: RoadType;
  // Draw state
  polyPoints: Point[];
  curvePoints: Point[];
  cubicPoints: Point[];
  drawStart: DrawStart | null;
  isPanning: boolean;
  panStart: PanStart | null;
  // Refs
  stageRef: React.RefObject<Konva.Stage | null>;
  lastClickTimeRef: React.RefObject<number>;
  lastClickPosRef: React.RefObject<Point | null>;
  // Setters
  setObjects: React.Dispatch<React.SetStateAction<CanvasObject[]>>;
  setSelected: React.Dispatch<React.SetStateAction<string | null>>;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  setOffset: React.Dispatch<React.SetStateAction<Point>>;
  setMapCenter: React.Dispatch<React.SetStateAction<MapCenter | null>>;
  setIsPanning: React.Dispatch<React.SetStateAction<boolean>>;
  setPanStart: React.Dispatch<React.SetStateAction<PanStart | null>>;
  setDrawStart: React.Dispatch<React.SetStateAction<DrawStart | null>>;
  setPolyPoints: React.Dispatch<React.SetStateAction<Point[]>>;
  setCurvePoints: React.Dispatch<React.SetStateAction<Point[]>>;
  setCubicPoints: React.Dispatch<React.SetStateAction<Point[]>>;
  setSnapIndicator: React.Dispatch<React.SetStateAction<Point | null>>;
  setCursorPos: React.Dispatch<React.SetStateAction<Point>>;
  pushHistory: (next: CanvasObject[]) => void;
}

export function useCanvasEvents({
  tool, roadDrawMode, intersectionType, snapEnabled,
  objects, selected, zoom, offset, mapCenter,
  selectedSign, selectedDevice, selectedRoadType,
  polyPoints, curvePoints, cubicPoints,
  drawStart, isPanning, panStart,
  stageRef, lastClickTimeRef, lastClickPosRef,
  setObjects, setSelected, setZoom, setOffset, setMapCenter,
  setIsPanning, setPanStart, setDrawStart,
  setPolyPoints, setCurvePoints, setCubicPoints,
  setSnapIndicator, setCursorPos,
  pushHistory,
}: CanvasEventsProps) {

  const toWorld = useCallback((): Point => {
    const pos = stageRef.current?.getPointerPosition();
    if (!pos) return { x: 0, y: 0 };
    return { x: (pos.x - offset.x) / zoom, y: (pos.y - offset.y) / zoom };
  }, [stageRef, offset, zoom]);

  const trySnap = useCallback((x: number, y: number): SnapResult => {
    if (!snapEnabled) return { x, y, snapped: false };
    return snapToEndpoint(x, y, objects, SNAP_RADIUS, zoom);
  }, [snapEnabled, objects, zoom]);

  const hitTest = useCallback((wx: number, wy: number): CanvasObject | null => {
    const effectiveHalfWidth = (o: CanvasObject): number => {
      if ('width' in o) return geoRoadWidthPx(o as { width: number; realWidth?: number }, mapCenter) / 2 + 6;
      return 6;
    };
    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i];
      if (o.type === "taper") {
        const stored = (o as TaperObject).taperLength;
        const effective =
          typeof stored === "number" && Number.isFinite(stored) && stored > 0
            ? stored
            : calcTaperLength(o.speed, o.laneWidth, o.numLanes);
        if (dist(wx, wy, o.x, o.y) < Math.max(30, Math.min(effective * TAPER_SCALE / 2, 150))) return o;
      } else if (o.type === "turn_lane") {
        const totalLen = o.taperLength + o.runLength;
        if (dist(wx, wy, o.x, o.y) < Math.max(30, Math.min(totalLen / 2, 150))) return o;
      } else if (o.type === "sign" || o.type === "device" || o.type === "text") {
        if (dist(wx, wy, o.x, o.y) < 30) return o;
      }
      if (o.type === "zone") {
        if (wx >= o.x && wx <= o.x + o.w && wy >= o.y && wy <= o.y + o.h) return o;
      }
      if (o.type === "road" || o.type === "arrow" || o.type === "measure") {
        const segLen = dist(o.x1, o.y1, o.x2, o.y2);
        if (dist(wx, wy, o.x1, o.y1) + dist(wx, wy, o.x2, o.y2) < segLen + effectiveHalfWidth(o)) return o;
      }
      if (o.type === "lane_mask") {
        const segLen = dist(o.x1, o.y1, o.x2, o.y2);
        if (dist(wx, wy, o.x1, o.y1) + dist(wx, wy, o.x2, o.y2) < segLen + o.laneWidth / 2 + 6) return o;
      }
      if (o.type === "crosswalk") {
        const cwDx = o.x2 - o.x1, cwDy = o.y2 - o.y1;
        const cwLenSq = cwDx * cwDx + cwDy * cwDy;
        const cwT = cwLenSq === 0 ? 0 : Math.max(0, Math.min(1, ((wx - o.x1) * cwDx + (wy - o.y1) * cwDy) / cwLenSq));
        if (dist(wx, wy, o.x1 + cwT * cwDx, o.y1 + cwT * cwDy) < o.depth / 2 + 5) return o;
      }
      if (o.type === "polyline_road" && o.points?.length >= 2) {
        if (distToPolyline(wx, wy, o.points) < effectiveHalfWidth(o)) return o;
      }
      if (o.type === "curve_road" && o.points?.length === 3) {
        if (distToPolyline(wx, wy, sampleBezier(o.points[0], o.points[1], o.points[2], 20)) < effectiveHalfWidth(o)) return o;
      }
      if (o.type === "cubic_bezier_road" && o.points?.length === 4) {
        if (distToPolyline(wx, wy, sampleCubicBezier(o.points[0], o.points[1], o.points[2], o.points[3], 20)) < effectiveHalfWidth(o)) return o;
      }
    }
    return null;
  }, [objects, mapCenter]);

  const handleMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
    const raw = toWorld();
    const { x, y, snapped } = trySnap(raw.x, raw.y);
    setCursorPos(raw);
    setSnapIndicator(snapped ? { x, y } : null);

    if (tool === "pan" || e.evt.button === 1) {
      setIsPanning(true);
      const pos = stageRef.current?.getPointerPosition();
      if (pos) setPanStart({ x: pos.x - offset.x, y: pos.y - offset.y });
      return;
    }

    if (tool === "select") {
      if (selected) {
        const selObj = objects.find((o) => o.id === selected);
        if (selObj?.type === "cubic_bezier_road") {
          const handleRadius = Math.min(10 / zoom, 20);
          for (let i = 0; i < selObj.points.length; i++) {
            const p = selObj.points[i];
            if (dist(raw.x, raw.y, p.x, p.y) < handleRadius) {
              setDrawStart({ x: raw.x, y: raw.y, id: selObj.id, handleIndex: i, origPoints: selObj.points.map((pt) => ({ ...pt })) });
              return;
            }
          }
        }
      }
      const hit = hitTest(raw.x, raw.y);
      setSelected(hit ? hit.id : null);
      if (hit) {
        setDrawStart({
          x: raw.x, y: raw.y,
          ox: isPointObject(hit) ? hit.x : isLineObject(hit) ? hit.x1 : 0,
          oy: isPointObject(hit) ? hit.y : isLineObject(hit) ? hit.y1 : 0,
          id: hit.id,
          origPoints: isMultiPointRoad(hit) ? hit.points.map((p) => ({ ...p })) : null,
        });
      }
      return;
    }

    if (tool === "erase") {
      const hit = hitTest(raw.x, raw.y);
      if (hit) {
        const newObjs = objects.filter((o) => o.id !== hit.id);
        pushHistory(newObjs); setSelected(null);
      }
      return;
    }

    if (tool === "sign") {
      if (!selectedSign) return;
      const newSign: SignObject = { id: uid(), type: "sign", x: raw.x, y: raw.y, signData: selectedSign, rotation: 0, scale: 1 };
      const newObjs = [...objects, newSign];
      pushHistory(newObjs); setSelected(newSign.id);
      const isCustom = selectedSign.id.startsWith('custom_');
      track('sign_placed', { sign_id: selectedSign.id, sign_source: isCustom ? 'custom' : 'builtin', ...(isCustom ? {} : { sign_label: selectedSign.label }) });
      return;
    }

    if (tool === "device") {
      if (!selectedDevice) return;
      const newDev: DeviceObject = { id: uid(), type: "device", x: raw.x, y: raw.y, deviceData: selectedDevice, rotation: 0 };
      const newObjs = [...objects, newDev];
      pushHistory(newObjs); setSelected(newDev.id);
      return;
    }

    if (tool === "taper") {
      const speed = 45, laneWidth = 12;
      const newTaper: TaperObject = { id: uid(), type: "taper", x: raw.x, y: raw.y, rotation: 0, speed, laneWidth, taperLength: calcTaperLength(speed, laneWidth), manualLength: false, numLanes: 1 };
      const newObjs = [...objects, newTaper];
      pushHistory(newObjs); setSelected(newTaper.id);
      return;
    }

    if (tool === "turn_lane") {
      const newTL: TurnLaneObject = { id: uid(), type: "turn_lane", x: raw.x, y: raw.y, rotation: 0, laneWidth: 20, taperLength: 80, runLength: 100, side: 'right', turnDir: 'right' };
      const newObjs = [...objects, newTL];
      pushHistory(newObjs); setSelected(newTL.id);
      return;
    }

    if (tool === "text") {
      const textVal = prompt("Enter text label:");
      if (textVal) {
        const newText = { id: uid(), type: "text" as const, x: raw.x, y: raw.y, text: textVal, fontSize: 14, bold: false, color: "#ffffff" };
        const newObjs = [...objects, newText];
        pushHistory(newObjs); setSelected(newText.id);
      }
      return;
    }

    if (tool === "road") {
      if (roadDrawMode === "straight") { setDrawStart({ x, y }); return; }

      if (roadDrawMode === "poly" || roadDrawMode === "smooth") {
        const now = Date.now();
        const last = lastClickPosRef.current;
        const isDouble = (now - lastClickTimeRef.current < 350) && last && dist(x, y, last.x, last.y) < 15 / zoom;
        lastClickTimeRef.current = now;
        lastClickPosRef.current = { x, y };
        if (isDouble && polyPoints.length >= 2) {
          const newRoad: PolylineRoadObject = { id: uid(), type: "polyline_road", points: [...polyPoints], width: selectedRoadType.width, realWidth: selectedRoadType.realWidth, lanes: selectedRoadType.lanes, roadType: selectedRoadType.id, smooth: roadDrawMode === "smooth" };
          const newObjs = [...objects, newRoad];
          pushHistory(newObjs); setSelected(newRoad.id); setPolyPoints([]);
          track('road_drawn', { road_type: selectedRoadType.id, draw_mode: roadDrawMode, point_count: polyPoints.length });
        } else {
          setPolyPoints((prev) => [...prev, { x, y }]);
        }
        return;
      }

      if (roadDrawMode === "curve") {
        const newCurvePts = [...curvePoints, { x, y }];
        if (newCurvePts.length === 3) {
          const newRoad: CurveRoadObject = { id: uid(), type: "curve_road", points: newCurvePts as [Point, Point, Point], width: selectedRoadType.width, realWidth: selectedRoadType.realWidth, lanes: selectedRoadType.lanes, roadType: selectedRoadType.id };
          const newObjs = [...objects, newRoad];
          pushHistory(newObjs); setSelected(newRoad.id); setCurvePoints([]);
          track('road_drawn', { road_type: selectedRoadType.id, draw_mode: 'curve', point_count: 3 });
        } else { setCurvePoints(newCurvePts); }
        return;
      }

      if (roadDrawMode === "cubic") {
        const newCubicPts = [...cubicPoints, { x, y }];
        if (newCubicPts.length === 4) {
          const newRoad: CubicBezierRoadObject = { id: uid(), type: "cubic_bezier_road", points: newCubicPts as [Point, Point, Point, Point], width: selectedRoadType.width, realWidth: selectedRoadType.realWidth, lanes: selectedRoadType.lanes, roadType: selectedRoadType.id };
          const newObjs = [...objects, newRoad];
          pushHistory(newObjs); setSelected(newRoad.id); setCubicPoints([]);
          track('road_drawn', { road_type: selectedRoadType.id, draw_mode: 'cubic', point_count: 4 });
        } else { setCubicPoints(newCubicPts); }
        return;
      }
    }

    if (tool === "intersection") {
      const roads = createIntersectionRoads(x, y, intersectionType, selectedRoadType);
      const newObjs = [...objects, ...roads];
      pushHistory(newObjs); setSelected(roads[roads.length - 1].id);
      track('road_drawn', { road_type: selectedRoadType.id, draw_mode: intersectionType === '4way' ? 'intersection_4way' : 'intersection_t' });
      return;
    }

    if (["zone", "arrow", "measure", "lane_mask", "crosswalk"].includes(tool)) {
      setDrawStart({ x: raw.x, y: raw.y });
    }
  }, [
    tool, roadDrawMode, intersectionType, snapEnabled,
    objects, selected, zoom, offset, mapCenter,
    selectedSign, selectedDevice, selectedRoadType,
    polyPoints, curvePoints, cubicPoints,
    stageRef, lastClickTimeRef, lastClickPosRef,
    toWorld, trySnap, hitTest,
    setObjects, setSelected, setIsPanning, setPanStart, setDrawStart,
    setPolyPoints, setCurvePoints, setCubicPoints,
    setSnapIndicator, setCursorPos, pushHistory,
  ]);

  const handleMouseMove = useCallback((_e: KonvaEventObject<MouseEvent>) => {
    const raw = toWorld();
    setCursorPos(raw);

    if ((tool === "road" || tool === "intersection") && snapEnabled) {
      const { x, y, snapped } = snapToEndpoint(raw.x, raw.y, objects, SNAP_RADIUS, zoom);
      setSnapIndicator(snapped ? { x, y } : null);
    } else {
      setSnapIndicator(null);
    }

    if (isPanning && panStart) {
      const pos = stageRef.current?.getPointerPosition();
      if (pos) {
        const newOffset = { x: pos.x - panStart.x, y: pos.y - panStart.y };
        const dox = newOffset.x - offset.x;
        const doy = newOffset.y - offset.y;
        setOffset(newOffset);
        if (mapCenter) {
          const { x: cx, y: cy } = latLonToPixel(mapCenter.lat, mapCenter.lon, mapCenter.zoom);
          const { lat: newLat, lon: newLon } = pixelToLatLon(cx - dox, cy - doy, mapCenter.zoom);
          setMapCenter({ lat: newLat, lon: newLon, zoom: mapCenter.zoom });
        }
      }
      return;
    }

    if (tool === "select" && drawStart && drawStart.id) {
      const dx = raw.x - drawStart.x, dy = raw.y - drawStart.y;
      setObjects((prev) => prev.map((o) => {
        if (o.id !== drawStart.id) return o;
        if (o.type === "cubic_bezier_road" && drawStart.origPoints) {
          if (drawStart.handleIndex != null) {
            const newPoints = drawStart.origPoints.map((p, i) =>
              i === drawStart.handleIndex ? { x: p.x + dx, y: p.y + dy } : { ...p }
            ) as [Point, Point, Point, Point];
            return { ...o, points: newPoints };
          }
          return { ...o, points: drawStart.origPoints.map((p) => ({ x: p.x + dx, y: p.y + dy })) as [Point, Point, Point, Point] };
        }
        if ((o.type === "polyline_road" || o.type === "curve_road") && drawStart.origPoints) {
          return { ...o, points: drawStart.origPoints.map((p) => ({ x: p.x + dx, y: p.y + dy })) } as CanvasObject;
        }
        if (isPointObject(o)) {
          return { ...o, x: (drawStart.ox ?? 0) + dx, y: (drawStart.oy ?? 0) + dy } as CanvasObject;
        }
        if (isLineObject(o)) {
          const sdx = o.x2 - o.x1, sdy = o.y2 - o.y1;
          return { ...o, x1: (drawStart.ox ?? 0) + dx, y1: (drawStart.oy ?? 0) + dy, x2: (drawStart.ox ?? 0) + dx + sdx, y2: (drawStart.oy ?? 0) + dy + sdy } as CanvasObject;
        }
        return o;
      }));
    }
  }, [isPanning, panStart, toWorld, tool, drawStart, snapEnabled, objects, zoom, offset, mapCenter, setMapCenter, stageRef, setObjects, setOffset, setSnapIndicator, setCursorPos]);

  const handleMouseUp = useCallback((_e: KonvaEventObject<MouseEvent>) => {
    if (isPanning) { setIsPanning(false); setPanStart(null); return; }

    if (tool === "select" && drawStart && drawStart.id) {
      pushHistory(objects); setDrawStart(null); return;
    }

    if (drawStart && tool === "road" && roadDrawMode === "straight") {
      const raw = toWorld();
      const { x, y } = trySnap(raw.x, raw.y);
      const d = dist(drawStart.x, drawStart.y, x, y);
      if (d < 5) { setDrawStart(null); return; }
      const newRoad: StraightRoadObject = { id: uid(), type: "road", x1: drawStart.x, y1: drawStart.y, x2: x, y2: y, width: selectedRoadType.width, realWidth: selectedRoadType.realWidth, lanes: selectedRoadType.lanes, roadType: selectedRoadType.id };
      const newObjs = [...objects, newRoad];
      pushHistory(newObjs); setSelected(newRoad.id);
      track('road_drawn', { road_type: selectedRoadType.id, draw_mode: 'straight' });
      setDrawStart(null);
      return;
    }

    if (drawStart && ["zone", "arrow", "measure", "lane_mask", "crosswalk"].includes(tool)) {
      const { x, y } = toWorld();
      if (dist(drawStart.x, drawStart.y, x, y) < 5) { setDrawStart(null); return; }
      let newObj: CanvasObject | undefined;
      if (tool === "zone") {
        const zx = Math.min(drawStart.x, x), zy = Math.min(drawStart.y, y);
        newObj = { id: uid(), type: "zone", x: zx, y: zy, w: Math.abs(x - drawStart.x), h: Math.abs(y - drawStart.y) };
      } else if (tool === "arrow") {
        newObj = { id: uid(), type: "arrow", x1: drawStart.x, y1: drawStart.y, x2: x, y2: y, color: "#fff" };
      } else if (tool === "measure") {
        newObj = { id: uid(), type: "measure", x1: drawStart.x, y1: drawStart.y, x2: x, y2: y };
      } else if (tool === "lane_mask") {
        newObj = { id: uid(), type: "lane_mask", x1: drawStart.x, y1: drawStart.y, x2: x, y2: y, laneWidth: 20, color: "rgba(239,68,68,0.5)", style: "hatch" };
      } else if (tool === "crosswalk") {
        newObj = { id: uid(), type: "crosswalk", x1: drawStart.x, y1: drawStart.y, x2: x, y2: y, depth: 24, stripeCount: 6, stripeColor: "#ffffff" };
      }
      if (newObj) {
        const newObjs = [...objects, newObj];
        pushHistory(newObjs); setSelected(newObj.id);
      }
      setDrawStart(null);
    }
  }, [isPanning, drawStart, tool, roadDrawMode, toWorld, trySnap, objects, selectedRoadType, pushHistory, setObjects, setSelected, setIsPanning, setPanStart, setDrawStart]);

  const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
    const pos = stageRef.current?.getPointerPosition();
    if (!pos) return;
    const factor = e.evt.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
    setZoom(newZoom);
    setOffset({ x: pos.x - ((pos.x - offset.x) / zoom) * newZoom, y: pos.y - ((pos.y - offset.y) / zoom) * newZoom });
  }, [stageRef, zoom, offset, setZoom, setOffset]);

  return { handleMouseDown, handleMouseMove, handleMouseUp, handleWheel, toWorld, trySnap };
}
