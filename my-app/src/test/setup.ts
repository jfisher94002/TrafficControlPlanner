import '@testing-library/jest-dom'
import { vi } from 'vitest'
import React from 'react'

// ─── Konva mock ───────────────────────────────────────────────────────────────
// jsdom has no canvas; render Stage as a plain div and pass children through.
vi.mock('react-konva', () => {
  const passThrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children ?? null)

  return {
    Stage: ({
      children,
      onMouseDown,
      onMouseMove,
      onMouseUp,
      ...rest
    }: {
      children?: React.ReactNode
      onMouseDown?: (e: unknown) => void
      onMouseMove?: (e: unknown) => void
      onMouseUp?: (e: unknown) => void
      [k: string]: unknown
    }) =>
      React.createElement(
        'div',
        {
          'data-testid': rest['data-testid'] ?? 'konva-stage',
          onMouseDown: onMouseDown
            ? (e: React.MouseEvent) => onMouseDown({ evt: e.nativeEvent })
            : undefined,
          onMouseMove: onMouseMove
            ? (e: React.MouseEvent) => onMouseMove({ evt: e.nativeEvent })
            : undefined,
          onMouseUp: onMouseUp
            ? (e: React.MouseEvent) => onMouseUp({ evt: e.nativeEvent })
            : undefined,
        },
        children,
      ),
    Layer: passThrough,
    Group: passThrough,
    // Drawing primitives — no visual output needed in tests
    Line: () => null,
    Rect: () => null,
    Circle: () => null,
    Shape: () => null,
    Image: () => null,
    Text: () => null,
  }
})

vi.mock('konva', () => {
  const Stage = vi.fn().mockImplementation(() => ({
    getPointerPosition: () => ({ x: 0, y: 0 }),
    container: () => document.createElement('div'),
  }))
  return { default: { Stage } }
})

// ─── Browser API stubs ────────────────────────────────────────────────────────
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const store: Record<string, string> = {}
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]) },
  },
  writable: true,
})

globalThis.prompt = vi.fn().mockReturnValue(null)
