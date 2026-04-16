import { resolveTileUrl } from '../../utils';

// Isolated from constants.ts so that importing COLORS/grid constants
// does not trigger env reads or console.warn side effects.
export const TILE_URL_TEMPLATE = resolveTileUrl(import.meta.env.VITE_TILE_URL as string | undefined);
