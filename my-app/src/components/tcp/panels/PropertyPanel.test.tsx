import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PropertyPanel } from './PropertyPanel'
import type { CanvasObject, PlanMeta } from '../../../types'

const planMeta: PlanMeta = {
  projectNumber: '',
  client: '',
  location: '',
  notes: '',
}

const renderPanel = (objects: CanvasObject[], selected = objects[0]?.id ?? null) => {
  const props = {
    selected,
    objects,
    onUpdate: vi.fn(),
    onDelete: vi.fn(),
    onReorder: vi.fn(),
    planMeta,
    onUpdateMeta: vi.fn(),
    onAutoChannelize: vi.fn(),
    showSpacingGuide: false,
    onToggleSpacingGuide: vi.fn(),
    showBufferZone: false,
    onToggleBufferZone: vi.fn(),
  }

  render(<PropertyPanel {...props} />)
  return props
}

describe('PropertyPanel arrow board controls', () => {
  const arrowBoard: CanvasObject = {
    id: 'arrow-board-1',
    type: 'device',
    x: 0,
    y: 0,
    rotation: 0,
    deviceData: { id: 'arrow_board', label: 'Arrow Board', icon: '->', color: '#fbbf24' },
    arrowBoardMode: 'left',
  }

  it('shows current arrow board mode and updates selected mode', async () => {
    const user = userEvent.setup()
    const props = renderPanel([arrowBoard])

    expect(screen.getByText('Arrow Board Mode')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /left/i })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: /flash/i }))

    expect(props.onUpdate).toHaveBeenCalledWith('arrow-board-1', { arrowBoardMode: 'flashing' })
  })

  it('defaults legacy arrow boards to right mode in the panel state', () => {
    renderPanel([{ ...arrowBoard, arrowBoardMode: undefined }])

    expect(screen.getByRole('button', { name: /right/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('does not show arrow board controls for other devices', () => {
    renderPanel([
      {
        ...arrowBoard,
        id: 'cone-1',
        deviceData: { id: 'cone', label: 'Traffic Cone', icon: '^', color: '#f97316' },
      },
    ])

    expect(screen.queryByText('Arrow Board Mode')).not.toBeInTheDocument()
  })
})
