import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TrafficControlPlanner from '../traffic-control-planner'

beforeEach(() => { localStorage.clear() })

function setup() {
  const user = userEvent.setup()
  render(<TrafficControlPlanner />)
  return { user }
}

// ─── Tool selection ───────────────────────────────────────────────────────────
describe('Tool selection', () => {
  it('clicking the Sign tab shows the sign panel', async () => {
    const { user } = setup()
    const signsTab = screen.getByRole('button', { name: /signs/i })
    await user.click(signsTab)
    expect(screen.getByRole('button', { name: /library/i })).toBeInTheDocument()
  })

  it('pressing S activates the sign tool', async () => {
    setup()
    fireEvent.keyDown(window, { key: 'S' })
    expect(screen.getByTestId('object-count').closest('div')?.textContent).toContain('Tool: SIGN')
  })
})

// ─── Undo / Redo ──────────────────────────────────────────────────────────────
describe('Undo/Redo', () => {
  it('clicking undo with no history does not crash and count stays 0', async () => {
    const { user } = setup()
    await user.click(screen.getByTestId('undo-button'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('0 objects')
  })

  it('after placing a sign, object count is 1', () => {
    setup()
    fireEvent.keyDown(window, { key: 'S' })
    const canvas = screen.getByTestId('konva-stage')
    fireEvent.mouseDown(canvas)
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
  })

  it('undo after placing a sign restores count to 0', async () => {
    const { user } = setup()
    fireEvent.keyDown(window, { key: 'S' })
    const canvas = screen.getByTestId('konva-stage')
    fireEvent.mouseDown(canvas)
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
    await user.click(screen.getByTestId('undo-button'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('0 objects')
  })

  it('undo then redo restores the sign', async () => {
    const { user } = setup()
    fireEvent.keyDown(window, { key: 'S' })
    const canvas = screen.getByTestId('konva-stage')
    fireEvent.mouseDown(canvas)
    await user.click(screen.getByTestId('undo-button'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('0 objects')
    await user.click(screen.getByTestId('redo-button'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
  })
})

// ─── Plan metadata ────────────────────────────────────────────────────────────
describe('Plan metadata', () => {
  it('typing in Project # input updates the value', async () => {
    const { user } = setup()
    const input = screen.getByLabelText('Project #')
    await user.type(input, 'TCP-001')
    expect(input).toHaveValue('TCP-001')
  })

  it('typing in Client input updates the value', async () => {
    const { user } = setup()
    const input = screen.getByLabelText('Client')
    await user.type(input, 'Acme Corp')
    expect(input).toHaveValue('Acme Corp')
  })
})

// ─── Right panel ──────────────────────────────────────────────────────────────
describe('Right panel', () => {
  it('close button hides the right panel', async () => {
    const { user } = setup()
    expect(screen.getByTestId('right-panel')).toBeInTheDocument()
    await user.click(screen.getByTestId('close-right-panel'))
    expect(screen.queryByTestId('right-panel')).not.toBeInTheDocument()
  })

  it('toggle button shows the right panel again', async () => {
    const { user } = setup()
    await user.click(screen.getByTestId('close-right-panel'))
    const toggle = screen.getByTestId('toggle-right-panel')
    await user.click(toggle)
    expect(screen.getByTestId('right-panel')).toBeInTheDocument()
  })
})

// ─── Object creation ──────────────────────────────────────────────────────────
describe('Object creation', () => {
  it('sign tool + canvas click shows sign Properties in right panel', () => {
    setup()
    fireEvent.keyDown(window, { key: 'S' })
    const canvas = screen.getByTestId('konva-stage')
    fireEvent.mouseDown(canvas)
    const rightPanel = screen.getByTestId('right-panel')
    expect(within(rightPanel).getByText(/sign Properties/i)).toBeInTheDocument()
  })
})

// ─── Taper tool ───────────────────────────────────────────────────────────────
describe('Taper tool', () => {
  it('pressing P activates the taper tool', () => {
    setup()
    fireEvent.keyDown(window, { key: 'P' })
    expect(screen.getByTestId('object-count').closest('div')?.textContent).toContain('Tool: TAPER')
  })

  it('taper tool + canvas click places a taper (object count 1)', () => {
    setup()
    fireEvent.keyDown(window, { key: 'P' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
  })

  it('placing a taper shows Taper Properties in right panel', () => {
    setup()
    fireEvent.keyDown(window, { key: 'P' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    expect(within(screen.getByTestId('right-panel')).getByText(/taper Properties/i)).toBeInTheDocument()
  })
})
