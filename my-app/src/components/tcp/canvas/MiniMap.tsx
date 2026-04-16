import { useRef, useState, useEffect } from 'react';
import type { CanvasObject, MapCenter, Point } from '../../../types';
import { isPointObject } from '../../../utils';
import { buildTileUrl } from '../../../utils';
import { COLORS } from '../../../features/tcp/constants';
import { TILE_URL_TEMPLATE } from '../../../features/tcp/tileUrl';

export function latLonToPixel(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const scale = Math.pow(2, zoom) * 256;
  const x = ((lon + 180) / 360) * scale;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return { x, y };
}

export function pixelToLatLon(px: number, py: number, zoom: number): { lat: number; lon: number } {
  const scale = Math.pow(2, zoom) * 256;
  const lon = (px / scale) * 360 - 180;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * py / scale))) * 180 / Math.PI;
  return { lat, lon };
}

interface MiniMapProps {
  objects: CanvasObject[];
  canvasSize: { w: number; h: number };
  zoom: number;
  offset: Point;
  mapCenter: MapCenter | null;
}

export function MiniMap({ objects, canvasSize, zoom, offset, mapCenter }: MiniMapProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const mmW = 160, mmH = 100;
  const tileCache = useRef<Record<string, HTMLImageElement>>({});
  const [tileTick, setTileTick] = useState(0);

  const ovZoom = mapCenter ? Math.max(8, Math.min(11, mapCenter.zoom - 4)) : null;

  useEffect(() => { tileCache.current = {}; }, [ovZoom]);

  useEffect(() => {
    if (!mapCenter || ovZoom === null) return;
    const TILE = 256;
    const { x: cx, y: cy } = latLonToPixel(mapCenter.lat, mapCenter.lon, ovZoom);
    const left = cx - mmW / 2, top = cy - mmH / 2;
    const maxT = Math.pow(2, ovZoom);
    const txStart = Math.floor(left / TILE), txEnd = Math.floor((left + mmW) / TILE);
    const tyStart = Math.floor(top / TILE), tyEnd = Math.floor((top + mmH) / TILE);
    for (let tx = txStart; tx <= txEnd; tx++) {
      for (let ty = tyStart; ty <= tyEnd; ty++) {
        if (ty < 0 || ty >= maxT) continue;
        const wx = ((tx % maxT) + maxT) % maxT;
        const url = buildTileUrl(TILE_URL_TEMPLATE, ovZoom, wx, ty);
        if (tileCache.current[url]) continue;
        const img = new Image(); img.crossOrigin = "anonymous";
        img.onload = () => setTileTick(t => t + 1);
        img.src = url;
        tileCache.current[url] = img;
      }
    }
  }, [mapCenter, ovZoom]);

  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, mmW, mmH);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, mmW, mmH);

    if (mapCenter && ovZoom !== null) {
      const TILE = 256;
      const { x: cx, y: cy } = latLonToPixel(mapCenter.lat, mapCenter.lon, ovZoom);
      const left = cx - mmW / 2, top = cy - mmH / 2;
      const maxT = Math.pow(2, ovZoom);
      const txStart = Math.floor(left / TILE), txEnd = Math.floor((left + mmW) / TILE);
      const tyStart = Math.floor(top / TILE), tyEnd = Math.floor((top + mmH) / TILE);
      for (let tx = txStart; tx <= txEnd; tx++) {
        for (let ty = tyStart; ty <= tyEnd; ty++) {
          if (ty < 0 || ty >= maxT) continue;
          const wx = ((tx % maxT) + maxT) % maxT;
          const url = buildTileUrl(TILE_URL_TEMPLATE, ovZoom, wx, ty);
          const img = tileCache.current[url];
          if (!img?.complete || !img.naturalWidth) continue;
          ctx.drawImage(img, tx * TILE - left, ty * TILE - top, TILE, TILE);
        }
      }
      ctx.fillStyle = "rgba(15,17,23,0.25)";
      ctx.fillRect(0, 0, mmW, mmH);

      const vpScale = Math.pow(2, ovZoom - mapCenter.zoom);
      const vw = Math.max(2, Math.min(mmW, canvasSize.w * vpScale));
      const vh = Math.max(2, Math.min(mmH, canvasSize.h * vpScale));
      ctx.strokeStyle = COLORS.accent; ctx.lineWidth = 1.5;
      ctx.strokeRect(mmW / 2 - vw / 2, mmH / 2 - vh / 2, vw, vh);
    } else {
      const worldW = 4000, worldH = 3000;
      const s = Math.min(mmW / worldW, mmH / worldH);
      objects.forEach((obj) => {
        if (obj.type === "road") {
          ctx.strokeStyle = COLORS.road; ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo((obj.x1 + 2000) * s, (obj.y1 + 1500) * s);
          ctx.lineTo((obj.x2 + 2000) * s, (obj.y2 + 1500) * s);
          ctx.stroke();
        } else if (obj.type === "polyline_road" && obj.points?.length >= 2) {
          ctx.strokeStyle = COLORS.road; ctx.lineWidth = 2;
          ctx.beginPath();
          obj.points.forEach((p, i) => {
            const mx = (p.x + 2000) * s, my = (p.y + 1500) * s;
            if (i === 0) { ctx.moveTo(mx, my); } else { ctx.lineTo(mx, my); }
          });
          ctx.stroke();
        } else if (obj.type === "curve_road" && obj.points?.length === 3) {
          ctx.strokeStyle = COLORS.road; ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo((obj.points[0].x + 2000) * s, (obj.points[0].y + 1500) * s);
          ctx.quadraticCurveTo(
            (obj.points[1].x + 2000) * s, (obj.points[1].y + 1500) * s,
            (obj.points[2].x + 2000) * s, (obj.points[2].y + 1500) * s,
          );
          ctx.stroke();
        } else if (obj.type === "cubic_bezier_road" && obj.points?.length === 4) {
          ctx.strokeStyle = COLORS.road; ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo((obj.points[0].x + 2000) * s, (obj.points[0].y + 1500) * s);
          ctx.bezierCurveTo(
            (obj.points[1].x + 2000) * s, (obj.points[1].y + 1500) * s,
            (obj.points[2].x + 2000) * s, (obj.points[2].y + 1500) * s,
            (obj.points[3].x + 2000) * s, (obj.points[3].y + 1500) * s,
          );
          ctx.stroke();
        } else if (isPointObject(obj)) {
          ctx.fillStyle = COLORS.accent;
          ctx.fillRect((obj.x + 2000) * s - 1, (obj.y + 1500) * s - 1, 3, 3);
        }
      });
      const vx = (-offset.x / zoom + 2000) * s;
      const vy = (-offset.y / zoom + 1500) * s;
      const vw = Math.min((canvasSize.w / zoom) * s, mmW);
      const vh = Math.min((canvasSize.h / zoom) * s, mmH);
      ctx.strokeStyle = COLORS.accent; ctx.lineWidth = 1;
      ctx.strokeRect(Math.max(0, vx), Math.max(0, vy), Math.min(vw, mmW - Math.max(0, vx)), Math.min(vh, mmH - Math.max(0, vy)));
    }
  }, [objects, canvasSize, zoom, offset, mapCenter, ovZoom, tileTick]);

  return (
    <canvas ref={ref} width={mmW} height={mmH}
      style={{ borderRadius: 6, border: `1px solid ${COLORS.panelBorder}` }} />
  );
}
