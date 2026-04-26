import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PropertyPanel } from '../components/tcp/panels/PropertyPanel'
import type { CanvasObject, PlanMeta } from '../types'

const planMeta: PlanMeta = {
  projectNumber: '',
  client: '',
  location: '',
  notes: '',
}

const noop = () => {}

function renderPanel(objects: CanvasObject[], selected: string | null = objects[0]?.id ?? null) {
  const onUpdate = vi.fn()
  render(
    <PropertyPanel
      selected={selected}
      objects={objects}
      onUpdate={onUpdate}
      onDelete={noop}
      onReorder={noop}
      planMeta={planMeta}
      onUpdateMeta={noop}
      onAutoChannelize={noop}
      showSpacingGuide={false}
      onToggleSpacingGuide={noop}
      showBufferZone={false}
      onToggleBufferZone={noop}
    />,
  )
  return { onUpdate }
}

describe('PropertyPanel arrow board controls', () => {
  const arrowBoard: CanvasObject = {
    id: 'arrow-board-1',
    type: 'device',
    x: 100,
    y: 120,
    deviceData: { id: 'arrow_board', label: 'Arrow Board', icon: '⟹', color: '#fbbf24' },
    rotation: 0,
  }

  it('defaults legacy arrow boards to right mode in the selector state', () => {
    renderPanel([arrowBoard])

    expect(screen.getByRole('button', { name: /right/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /left/i })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /caution/i })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /flash/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('persists the selected arrow board mode through object updates', async () => {
    const user = userEvent.setup()
    const { onUpdate } = renderPanel([{ ...arrowBoard, arrowBoardMode: 'left' }])

    expect(screen.getByRole('button', { name: /left/i })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: /caution/i }))
    await user.click(screen.getByRole('button', { name: /flash/i }))

    expect(onUpdate).toHaveBeenNthCalledWith(1, 'arrow-board-1', { arrowBoardMode: 'caution' })
    expect(onUpdate).toHaveBeenNthCalledWith(2, 'arrow-board-1', { arrowBoardMode: 'flashing' })
  })

  it('does not show arrow board mode controls for other traffic devices', () => {
    renderPanel([
      {
        ...arrowBoard,
        id: 'cone-1',
        deviceData: { id: 'cone', label: 'Traffic Cone', icon: '▲', color: '#f97316' },
      },
    ])

    expect(screen.queryByText(/arrow board mode/i)).not.toBeInTheDocument()
  })
})
