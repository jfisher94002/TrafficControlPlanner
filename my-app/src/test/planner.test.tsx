import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TrafficControlPlanner from '../traffic-control-planner'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

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

// ─── Manifest panel ───────────────────────────────────────────────────────────
describe('Manifest panel', () => {
  it('clicking the Manifest tab shows the manifest panel', async () => {
    const { user } = setup()
    await user.click(screen.getByTestId('tab-manifest'))
    expect(screen.getByTestId('manifest-panel')).toBeInTheDocument()
  })

  it('manifest shows "No objects yet" when canvas is empty', async () => {
    const { user } = setup()
    await user.click(screen.getByTestId('tab-manifest'))
    expect(screen.getByTestId('manifest-panel')).toHaveTextContent(/no objects yet/i)
  })

  it('placing a sign then opening manifest shows count 1 in the Signs row', async () => {
    const { user } = setup()
    fireEvent.keyDown(window, { key: 'S' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    await user.click(screen.getByTestId('tab-manifest'))
    const panel = screen.getByTestId('manifest-panel')
    // Signs section heading is present
    expect(within(panel).getByText(/signs/i)).toBeInTheDocument()
    // Default selected sign is STOP — scope to that row and assert count = 1
    const signRow = within(panel).getByText('STOP').closest('div') as HTMLElement
    expect(within(signRow).getByTestId('manifest-count')).toHaveTextContent('1')
  })

  it('placing a taper then opening manifest shows Tapers row', async () => {
    const { user } = setup()
    fireEvent.keyDown(window, { key: 'P' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    await user.click(screen.getByTestId('tab-manifest'))
    expect(screen.getByTestId('manifest-panel')).toHaveTextContent(/tapers/i)
  })

  it('aggregates multiple identical signs and reflects the correct total', async () => {
    const { user } = setup()
    // Place two identical signs
    fireEvent.keyDown(window, { key: 'S' })
    const canvas = screen.getByTestId('konva-stage')
    fireEvent.mouseDown(canvas)
    fireEvent.mouseDown(canvas)

    // Global object counter should show 2 objects
    expect(screen.getByTestId('object-count').textContent).toContain('2 objects')

    // Open manifest and ensure a count of 2 is shown (row and/or total)
    await user.click(screen.getByTestId('tab-manifest'))
    const panel = screen.getByTestId('manifest-panel')
    const counts = within(panel).getAllByTestId('manifest-count')
    expect(counts.some(el => el.textContent === '2')).toBe(true)
  })

  it('aggregates multiple identical devices (tapers) into device grouping and total', async () => {
    const { user } = setup()
    // Place two tapers using the taper tool
    fireEvent.keyDown(window, { key: 'P' })
    const canvas = screen.getByTestId('konva-stage')
    fireEvent.mouseDown(canvas)
    fireEvent.mouseDown(canvas)

    // Global object counter should reflect 2 objects
    expect(screen.getByTestId('object-count').textContent).toContain('2 objects')

    // Open manifest and check that tapers are grouped and counted
    await user.click(screen.getByTestId('tab-manifest'))
    const panel = screen.getByTestId('manifest-panel')
    expect(panel).toHaveTextContent(/tapers/i)
    const counts = within(panel).getAllByTestId('manifest-count')
    expect(counts.some(el => el.textContent === '2')).toBe(true)
  })

  it('shows a manifest Total that matches the number of canvas objects', async () => {
    const { user } = setup()
    const canvas = screen.getByTestId('konva-stage')

    // Place one sign
    fireEvent.keyDown(window, { key: 'S' })
    fireEvent.mouseDown(canvas)

    // Place one taper (device)
    fireEvent.keyDown(window, { key: 'P' })
    fireEvent.mouseDown(canvas)

    // Read the global object counter to determine how many objects exist
    const objectCountText = screen.getByTestId('object-count').textContent ?? ''
    const match = objectCountText.match(/(\d+)\s+objects?/)
    const totalObjects = match ? Number(match[1]) : NaN
    expect(Number.isNaN(totalObjects)).toBe(false)
    expect(totalObjects).toBeGreaterThan(0)

    // Open manifest and ensure that at least one manifest-count equals totalObjects
    await user.click(screen.getByTestId('tab-manifest'))
    const panel = screen.getByTestId('manifest-panel')
    const counts = within(panel).getAllByTestId('manifest-count')
    const hasMatchingTotal = counts.some(el => el.textContent === String(totalObjects))
    expect(hasMatchingTotal).toBe(true)
  })
})

// ─── PNG export ───────────────────────────────────────────────────────────────
describe('PNG export', () => {
  it('Export PNG button is present in the toolbar', () => {
    setup()
    expect(screen.getByTestId('export-png-button')).toBeInTheDocument()
  })

  it('clicking Export PNG does not throw when stage is not available', async () => {
    const { user } = setup()
    await expect(user.click(screen.getByTestId('export-png-button'))).resolves.not.toThrow()
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

// ─── localStorage auto-save ───────────────────────────────────────────────────
describe('localStorage auto-save', () => {
  const AUTOSAVE_KEY = 'tcp_autosave'

  const seedAutosave = (overrides = {}) => {
    const state = {
      id: 'seed-id',
      name: 'Saved Plan',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      canvasZoom: 1,
      canvasOffset: { x: 0, y: 0 },
      canvasState: { objects: [] },
      metadata: { projectNumber: 'P-001', client: 'Acme', location: '', notes: '' },
      ...overrides,
    }
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(state))
  }

  it('hydrates plan title from existing autosave on mount', () => {
    seedAutosave({ name: 'My Restored Plan' })
    setup()
    expect(screen.getByTestId('plan-title')).toHaveValue('My Restored Plan')
  })

  it('hydrates plan metadata from existing autosave on mount', () => {
    seedAutosave({ metadata: { projectNumber: 'TCP-99', client: 'City DOT', location: '', notes: '' } })
    setup()
    expect(screen.getByLabelText('Client')).toHaveValue('City DOT')
  })

  it('writes to tcp_autosave when plan title changes', async () => {
    const setItemSpy = vi.spyOn(window.localStorage, 'setItem')
    const { user } = setup()
    await user.type(screen.getByTestId('plan-title'), 'X')
    // Use the last autosave call — earlier calls capture the pre-type state
    const autosaveCalls = setItemSpy.mock.calls.filter(([k]) => k === AUTOSAVE_KEY)
    expect(autosaveCalls.length).toBeGreaterThan(0)
    const payload = JSON.parse(autosaveCalls[autosaveCalls.length - 1][1] as string)
    expect(payload.name).toContain('X')
    expect(payload).toHaveProperty('updatedAt')
    expect(payload).toHaveProperty('canvasState')
    expect(payload).toHaveProperty('canvasZoom')
    expect(payload).toHaveProperty('metadata')
  })

  it('New Plan resets autosave to blank state', async () => {
    // Seed with a named plan (empty objects so confirm() is skipped)
    seedAutosave({ name: 'Old Plan', canvasState: { objects: [] } })
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /new/i }))
    // The autosave effect fires after state reset — check it reflects the blank plan
    const saved = JSON.parse(localStorage.getItem(AUTOSAVE_KEY) ?? 'null')
    expect(saved?.name).toBe('Untitled Traffic Control Plan')
    expect(saved?.canvasState?.objects).toHaveLength(0)
  })
})
