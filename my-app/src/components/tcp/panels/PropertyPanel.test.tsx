import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PropertyPanel } from './PropertyPanel'
import type { CanvasObject, PlanMeta } from '../../../types'

const emptyMeta: PlanMeta = {
  projectNumber: '',
  client: '',
  location: '',
  notes: '',
}

function renderPanel(objects: CanvasObject[], selected = objects[0]?.id) {
  const props = {
    selected: selected ?? null,
    objects,
    onUpdate: vi.fn(),
    onDelete: vi.fn(),
    onReorder: vi.fn(),
    planMeta: emptyMeta,
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
  it('updates arrow board mode while preserving the selected device id', async () => {
    const user = userEvent.setup()
    const props = renderPanel([
      {
        id: 'arrow-board-1',
        type: 'device',
        x: 10,
        y: 20,
        rotation: 0,
        deviceData: { id: 'arrow_board', label: 'Arrow Board', icon: '=>', color: '#fbbf24' },
        arrowBoardMode: 'left',
      },
    ])

    const controls = screen.getByText('Arrow Board Mode').parentElement as HTMLElement
    expect(within(controls).getByRole('button', { name: /left/i })).toHaveAttribute('aria-pressed', 'true')

    await user.click(within(controls).getByRole('button', { name: /flash/i }))

    expect(props.onUpdate).toHaveBeenCalledWith('arrow-board-1', { arrowBoardMode: 'flashing' })
  })

  it('omits arrow board mode controls for non-arrow devices', () => {
    renderPanel([
      {
        id: 'cone-1',
        type: 'device',
        x: 10,
        y: 20,
        rotation: 0,
        deviceData: { id: 'cone', label: 'Traffic Cone', icon: '^', color: '#f97316' },
      },
    ])

    expect(screen.queryByText('Arrow Board Mode')).not.toBeInTheDocument()
  })
})
