import { useState, useCallback } from 'react';
import type { CanvasObject } from '../types';

/**
 * Manages undo/redo history for canvas objects.
 *
 * - `setObjects`   — live setter (no history entry); use during dragging
 * - `pushHistory`  — commits a new snapshot and advances the pointer
 * - `resetHistory` — replaces the entire stack; use when loading a plan
 */
export function useHistory(initial: CanvasObject[]) {
  const [objects, setObjectsDirect] = useState<CanvasObject[]>(initial);
  const [stack, setStack] = useState<CanvasObject[][]>([initial]);
  const [index, setIndex] = useState(0);

  const pushHistory = useCallback((next: CanvasObject[]) => {
    const newStack = stack.slice(0, index + 1);
    newStack.push(next);
    setStack(newStack);
    setIndex(newStack.length - 1);
    setObjectsDirect(next);
  }, [stack, index]);

  const undo = useCallback(() => {
    if (index > 0) {
      setIndex(index - 1);
      setObjectsDirect(stack[index - 1]);
    }
  }, [stack, index]);

  const redo = useCallback(() => {
    if (index < stack.length - 1) {
      setIndex(index + 1);
      setObjectsDirect(stack[index + 1]);
    }
  }, [stack, index]);

  const resetHistory = useCallback((next: CanvasObject[]) => {
    setObjectsDirect(next);
    setStack([next]);
    setIndex(0);
  }, []);

  return {
    objects,
    setObjects: setObjectsDirect,
    pushHistory,
    undo,
    redo,
    resetHistory,
  };
}
