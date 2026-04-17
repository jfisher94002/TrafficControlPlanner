import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHistory } from './useHistory'
import type { CanvasObject, SignObject } from '../types'

function makeSign(id: string, x: number): SignObject {
  return {
    id,
    type: 'sign',
    x,
    y: 0,
    rotation: 0,
    scale: 1,
    signData: {
      id: `sign-${id}`,
      label: 'STOP',
      shape: 'octagon',
      color: '#ff0000',
      textColor: '#ffffff',
    },
  }
}

describe('useHistory', () => {
  it('truncates redo branch after undo followed by a new history push', () => {
    const initial: CanvasObject[] = [makeSign('a', 0)]
    const second: CanvasObject[] = [makeSign('a', 0), makeSign('b', 10)]
    const replacement: CanvasObject[] = [makeSign('a', 0), makeSign('c', 20)]

    const { result } = renderHook(() => useHistory(initial))

    act(() => {
      result.current.pushHistory(second)
    })
    expect(result.current.objects).toEqual(second)

    act(() => {
      result.current.undo()
    })
    expect(result.current.objects).toEqual(initial)

    act(() => {
      result.current.pushHistory(replacement)
    })
    expect(result.current.objects).toEqual(replacement)

    act(() => {
      result.current.redo()
    })
    expect(result.current.objects).toEqual(replacement)
  })

  it('resetHistory replaces stack so undo and redo are no-ops', () => {
    const initial: CanvasObject[] = [makeSign('a', 0)]
    const second: CanvasObject[] = [makeSign('a', 0), makeSign('b', 10)]
    const resetTo: CanvasObject[] = [makeSign('z', 99)]

    const { result } = renderHook(() => useHistory(initial))

    act(() => {
      result.current.pushHistory(second)
    })
    expect(result.current.objects).toEqual(second)

    act(() => {
      result.current.resetHistory(resetTo)
    })
    expect(result.current.objects).toEqual(resetTo)

    act(() => {
      result.current.undo()
    })
    expect(result.current.objects).toEqual(resetTo)

    act(() => {
      result.current.redo()
    })
    expect(result.current.objects).toEqual(resetTo)
  })
})
