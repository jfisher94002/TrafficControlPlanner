import { vi } from 'vitest'

/** Shared Konva Stage stub — imported by setup.ts mock factory and test files. */
const mockBlob = new Blob([''], { type: 'image/png' })

export const mockCanvas = {
  toBlob: vi.fn((cb: (b: Blob | null) => void) => cb(mockBlob)),
  toDataURL: vi.fn(() => 'data:image/png;base64,mockdata'),
}

export const stageStub = {
  getPointerPosition: () => ({ x: 0, y: 0 }),
  container: () => document.createElement('div'),
  toCanvas: vi.fn(() => mockCanvas),
}
