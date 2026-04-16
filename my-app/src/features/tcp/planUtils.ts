import type { StraightRoadObject, RoadType } from '../../types';
import { uid } from '../../utils';

// ─── Search helpers ───────────────────────────────────────────────────────────

/** Strips hyphens, spaces, and dots then lowercases — used for fuzzy MUTCD matching. */
export function normalizeForSearch(s: string): string {
  return s.toLowerCase().replace(/[\s\-./]/g, '');
}

// ─── Intersection templates ───────────────────────────────────────────────────

export function createIntersectionRoads(
  cx: number, cy: number,
  type: 't' | '4way',
  roadType: RoadType,
): StraightRoadObject[] {
  const L = roadType.width * 3;
  const base = { width: roadType.width, realWidth: roadType.realWidth, lanes: roadType.lanes, roadType: roadType.id };
  if (type === '4way') return [
    { id: uid(), type: 'road', x1: cx - L, y1: cy, x2: cx + L, y2: cy, ...base },
    { id: uid(), type: 'road', x1: cx, y1: cy - L, x2: cx, y2: cy + L, ...base },
  ];
  return [
    { id: uid(), type: 'road', x1: cx - L, y1: cy, x2: cx + L, y2: cy, ...base },
    { id: uid(), type: 'road', x1: cx, y1: cy, x2: cx, y2: cy - L, ...base },
  ];
}

// ─── Autosave ─────────────────────────────────────────────────────────────────

export const AUTOSAVE_KEY = 'tcp_autosave';

export function readAutosave() {
  try { return JSON.parse(localStorage.getItem(AUTOSAVE_KEY) || 'null'); }
  catch { return null; }
}
