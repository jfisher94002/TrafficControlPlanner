import { describe, expect, it, vi } from 'vitest'
import type { SignData } from '../types'
import { COLORS } from '../features/tcp/constants'
import { drawSign } from './drawSign'

function createCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    set fillStyle(_: string) {},
    set strokeStyle(_: string) {},
    set lineWidth(_: number) {},
    set font(_: string) {},
    set textAlign(_: CanvasTextAlign) {},
    set textBaseline(_: CanvasTextBaseline) {},
    set shadowColor(_: string) {},
    set shadowBlur(_: number) {},
  } as unknown as CanvasRenderingContext2D
}

describe('drawSign', () => {
  it('applies rotation in radians and restores canvas state', () => {
    const ctx = createCtx()
    const signData: SignData = {
      id: 'stop',
      label: 'STOP',
      shape: 'octagon',
      color: '#ef4444',
      textColor: '#fff',
    }

    drawSign(ctx, { x: 10, y: 20, signData, rotation: 180, scale: 1 }, false)

    expect(ctx.save).toHaveBeenCalledTimes(1)
    expect(ctx.translate).toHaveBeenCalledWith(10, 20)
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI)
    expect(ctx.restore).toHaveBeenCalledTimes(1)
  })

  it('enables selected shadow styling when sign is selected', () => {
    const ctx = createCtx()
    const shadowColorSetter = vi.spyOn(ctx, 'shadowColor', 'set')
    const shadowBlurSetter = vi.spyOn(ctx, 'shadowBlur', 'set')
    const signData: SignData = {
      id: 'custom',
      label: 'GO',
      shape: 'rect',
      color: '#111827',
      textColor: '#ffffff',
    }

    drawSign(ctx, { x: 0, y: 0, signData, rotation: 0, scale: 1 }, true)

    expect(shadowColorSetter).toHaveBeenCalledWith(COLORS.selected)
    expect(shadowBlurSetter).toHaveBeenCalledWith(12)
  })

  it('truncates long labels and nudges text for triangle signs', () => {
    const ctx = createCtx()
    const signData: SignData = {
      id: 'yield',
      label: 'YIELD AHEAD',
      shape: 'triangle',
      color: '#f59e0b',
      textColor: '#000000',
    }

    drawSign(ctx, { x: 0, y: 0, signData, rotation: 0, scale: 1 }, false)

    expect(ctx.fillText).toHaveBeenCalledWith('YIELD AHEAD', 0, 4)
  })

  it('draws fallback rectangular sign and shortens very long labels', () => {
    const ctx = createCtx()
    const signData = {
      id: 'fallback',
      label: 'SUPER LONG CUSTOM LABEL',
      shape: 'rect' as const,
      color: '#ffffff',
      textColor: '#000000',
      border: '#123456',
    }

    drawSign(ctx, { x: 0, y: 0, signData, rotation: 0, scale: 1 }, false)

    expect(ctx.fillRect).toHaveBeenCalledTimes(1)
    expect(ctx.strokeRect).toHaveBeenCalledTimes(1)
    expect(ctx.fillText).toHaveBeenCalledWith('SUPER LONG …', 0, 0)
  })
})
