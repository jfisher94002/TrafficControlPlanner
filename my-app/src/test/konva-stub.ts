import { vi } from 'vitest'

/** Shared Konva Stage stub — imported by setup.ts mock factory and test files. */
export const stageStub = {
  getPointerPosition: () => ({ x: 0, y: 0 }),
  container: () => document.createElement('div'),
  toDataURL: vi.fn(() => 'data:image/png;base64,mock'),
}
