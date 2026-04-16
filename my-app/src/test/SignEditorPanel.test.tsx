import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../utils', async () => {
  const actual = await vi.importActual<typeof import('../utils')>('../utils')
  return { ...actual, uid: () => 'mock-uid' }
})

vi.mock('../shapes/drawSign', () => ({
  drawSign: vi.fn(),
}))

import { SignEditorPanel } from '../components/tcp/panels/SignEditorPanel'
import { drawSign } from '../shapes/drawSign'
import type { SignData } from '../types'

function setup() {
  const onUseSign = vi.fn()
  const onSaveToLibrary = vi.fn()
  const onSignChange = vi.fn()
  const user = userEvent.setup()
  render(
    <SignEditorPanel
      onUseSign={onUseSign}
      onSaveToLibrary={onSaveToLibrary}
      onSignChange={onSignChange}
    />,
  )
  return { user, onUseSign, onSaveToLibrary, onSignChange }
}

describe('SignEditorPanel', () => {
  const ctx = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D

  let getContextSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
  })

  afterEach(() => {
    getContextSpy.mockRestore()
    vi.clearAllMocks()
  })

  it('emits normalized custom id when text and shape change', async () => {
    const { user, onSignChange } = setup()
    const textInput = screen.getByPlaceholderText('SIGN TEXT')

    await user.clear(textInput)
    await user.type(textInput, 'ROAD  WORK')
    await user.click(screen.getByRole('button', { name: /circle/i }))

    const latestSign = onSignChange.mock.calls.at(-1)?.[0] as SignData
    expect(latestSign).toMatchObject({
      id: 'custom_circle_road_work',
      label: 'ROAD  WORK',
      shape: 'circle',
      color: '#f97316',
      textColor: '#111111',
      border: '#333',
    })
  })

  it('limits sign text to 14 characters', async () => {
    const { user, onSignChange } = setup()
    const textInput = screen.getByPlaceholderText('SIGN TEXT')

    await user.clear(textInput)
    await user.type(textInput, 'THIS TEXT IS WAY TOO LONG')

    expect(textInput).toHaveValue('THIS TEXT IS W')
    const latestSign = onSignChange.mock.calls.at(-1)?.[0] as SignData
    expect(latestSign.label).toBe('THIS TEXT IS W')
    expect(latestSign.label).toHaveLength(14)
  })

  it('calls onUseSign when Place is clicked', async () => {
    const { user, onUseSign } = setup()
    await user.click(screen.getByRole('button', { name: /place/i }))
    expect(onUseSign).toHaveBeenCalledTimes(1)
  })

  it('saves current sign data with generated custom id', async () => {
    const { user, onSaveToLibrary } = setup()
    const textInput = screen.getByPlaceholderText('SIGN TEXT')

    await user.clear(textInput)
    await user.type(textInput, 'DETOUR')
    await user.click(screen.getByRole('button', { name: /\+ save/i }))

    expect(onSaveToLibrary).toHaveBeenCalledWith(expect.objectContaining({
      id: 'custom_mock-uid',
      label: 'DETOUR',
      shape: 'diamond',
      color: '#f97316',
      textColor: '#111111',
      border: '#333',
    }))
  })

  it('draws preview canvas with current sign data', async () => {
    const { onSignChange } = setup()

    await waitFor(() => {
      expect(drawSign).toHaveBeenCalledTimes(1)
    })

    const signData = onSignChange.mock.calls[0][0] as SignData
    expect(drawSign).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        x: 50,
        y: 50,
        rotation: 0,
        scale: 2.2,
        signData,
      }),
      false,
    )
  })
})
