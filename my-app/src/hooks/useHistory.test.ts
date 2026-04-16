import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHistory } from './useHistory'
import type { CanvasObject } from '../types'

function textObject(id: string, x = 0): CanvasObject {
  return { id, type: 'text', x, y: 0, text: id, fontSize: 14, bold: false, color: '#fff' }
}

describe('useHistory', () => {
  it('truncates the redo branch when pushing after undo', () => {
    const a = textObject('a')
    const b = textObject('b', 10)
    const c = textObject('c', 20)
    const d = textObject('d', 30)
    const { result } = renderHook(() => useHistory([a]))

    act(() => {
      result.current.pushHistory([a, b])
    })
    act(() => {
      result.current.pushHistory([a, b, c])
    })
    act(() => {
      result.current.undo() // back to [a, b]
    })
    act(() => {
      result.current.pushHistory([a, b, d]) // should replace [a, b, c] branch
    })
    act(() => {
      result.current.undo()
    })

    expect(result.current.objects.map((o) => o.id)).toEqual(['a', 'b'])

    act(() => {
      result.current.redo()
    })
    expect(result.current.objects.map((o) => o.id)).toEqual(['a', 'b', 'd'])
  })

  it('resetHistory clears prior undo/redo snapshots', () => {
    const a = textObject('a')
    const b = textObject('b', 10)
    const z = textObject('z', 99)
    const { result } = renderHook(() => useHistory([a]))

    act(() => {
      result.current.pushHistory([a, b])
    })
    act(() => {
      result.current.resetHistory([z])
    })
    act(() => {
      result.current.undo()
      result.current.redo()
    })

    expect(result.current.objects.map((o) => o.id)).toEqual(['z'])
  })
})
