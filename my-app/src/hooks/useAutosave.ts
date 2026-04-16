import { useState, useEffect } from 'react';
import type { CanvasObject, MapCenter, PlanMeta, Point } from '../types';
import { AUTOSAVE_KEY } from '../features/tcp/planUtils';

interface AutosaveParams {
  objects: CanvasObject[];
  planId: string;
  planTitle: string;
  planCreatedAt: string;
  planMeta: PlanMeta;
  zoom: number;
  offset: Point;
  mapCenter: MapCenter | null;
  userId: string | null;
}

/** Writes plan state to localStorage on every change. Returns autosave error if any. */
export function useAutosave({
  objects, planId, planTitle, planCreatedAt, planMeta,
  zoom, offset, mapCenter, userId,
}: AutosaveParams) {
  const [autosaveError, setAutosaveError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
        id: planId,
        name: planTitle,
        createdAt: planCreatedAt,
        updatedAt: new Date().toISOString(),
        userId,
        canvasOffset: offset,
        canvasZoom: zoom,
        canvasState: { objects },
        metadata: planMeta,
        mapCenter,
      }));
      setAutosaveError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[TCP] Auto-save failed:", msg);
      setAutosaveError(msg);
    }
  }, [objects, planTitle, planMeta, planId, planCreatedAt, zoom, offset, mapCenter, userId]);

  return { autosaveError };
}
