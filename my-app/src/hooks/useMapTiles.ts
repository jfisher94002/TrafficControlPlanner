import { useState, useRef, useEffect, useMemo } from 'react';
import type { MapCenter, MapTile, MapTileEntry } from '../types';
import { buildTileUrl } from '../utils';
import { TILE_URL_TEMPLATE } from '../features/tcp/tileUrl';

/**
 * Computes the set of map tiles visible for the given center/canvas size,
 * loads them into an image cache, and triggers re-renders as tiles arrive.
 *
 * Returns `mapTiles` (geometry for the current viewport) and `mapTileCacheRef`
 * (the image cache the caller should use when rendering Konva KonvaImage nodes).
 */
export function useMapTiles(
  mapCenter: MapCenter | null,
  canvasSize: { w: number; h: number },
) {
  const [, setMapRenderTick] = useState(0);
  const mapTileCacheRef = useRef<Record<string, MapTileEntry>>({});

  const mapTiles = useMemo<MapTile[]>(() => {
    if (!mapCenter) return [];
    const tileSize = 256;
    const zoomLevel = mapCenter.zoom;
    const scale = Math.pow(2, zoomLevel) * tileSize;
    const sinLat = Math.sin((mapCenter.lat * Math.PI) / 180);
    const centerX = ((mapCenter.lon + 180) / 360) * scale;
    const centerY = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
    const left = centerX - canvasSize.w / 2, top = centerY - canvasSize.h / 2;
    const startTileX = Math.floor(left / tileSize), endTileX = Math.floor((left + canvasSize.w) / tileSize);
    const startTileY = Math.floor(top / tileSize), endTileY = Math.floor((top + canvasSize.h) / tileSize);
    const maxTile = Math.pow(2, zoomLevel);
    const tiles: MapTile[] = [];
    for (let ty = startTileY; ty <= endTileY; ty++) {
      if (ty < 0 || ty >= maxTile) continue;
      for (let tx = startTileX; tx <= endTileX; tx++) {
        const wrappedX = ((tx % maxTile) + maxTile) % maxTile;
        tiles.push({
          url: buildTileUrl(TILE_URL_TEMPLATE, zoomLevel, wrappedX, ty),
          x: tx * tileSize - left,
          y: ty * tileSize - top,
          size: tileSize,
        });
      }
    }
    return tiles;
  }, [mapCenter, canvasSize.w, canvasSize.h]);

  useEffect(() => {
    mapTiles.forEach((tile) => {
      if (mapTileCacheRef.current[tile.url]) return;
      const image = new Image();
      image.crossOrigin = "anonymous";
      const entry: MapTileEntry = { image, loaded: false };
      mapTileCacheRef.current[tile.url] = entry;
      image.onload = () => { entry.loaded = true; setMapRenderTick((t) => t + 1); };
      image.onerror = () => { delete mapTileCacheRef.current[tile.url]; };
      image.src = tile.url;
    });
  }, [mapTiles]);

  return { mapTiles, mapTileCacheRef };
}
