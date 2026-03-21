import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TrafficControlPlanner from '../traffic-control-planner'
import { stageStub, mockCanvas } from './konva-stub'

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

// ─── North arrow ──────────────────────────────────────────────────────────────
describe('North arrow', () => {
  it('is visible by default and does not block canvas interactions', () => {
    setup()
    const el = screen.getByTestId('north-arrow')
    expect(el).toBeInTheDocument()
    expect(el).toHaveStyle({ pointerEvents: 'none' })
  })

  it('toggle checkbox hides the north arrow', async () => {
    const { user } = setup()
    await user.click(screen.getByTestId('north-arrow-toggle'))
    expect(screen.queryByTestId('north-arrow')).not.toBeInTheDocument()
  })

  it('toggle checkbox shows the north arrow again', async () => {
    const { user } = setup()
    await user.click(screen.getByTestId('north-arrow-toggle'))
    await user.click(screen.getByTestId('north-arrow-toggle'))
    expect(screen.getByTestId('north-arrow')).toBeInTheDocument()
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

  it('clicking Export PNG with mocked stage completes without error', async () => {
    const { user } = setup()
    await expect(user.click(screen.getByTestId('export-png-button'))).resolves.not.toThrow()
  })

  it('triggers a PNG download via Blob with pixelRatio 2 and revokes the URL', async () => {
    stageStub.toCanvas.mockClear()
    mockCanvas.toBlob.mockClear()
    ;(URL.createObjectURL as ReturnType<typeof vi.fn>).mockClear()
    ;(URL.revokeObjectURL as ReturnType<typeof vi.fn>).mockClear()

    const mockAnchor = { href: '', download: '', click: vi.fn() }
    const realCreateElement = document.createElement.bind(document)
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
      tag === 'a' ? (mockAnchor as unknown as HTMLElement) : realCreateElement(tag),
    )

    const { user } = setup()
    await user.click(screen.getByTestId('export-png-button'))

    expect(stageStub.toCanvas).toHaveBeenCalledWith({ pixelRatio: 2 })
    expect(mockCanvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png')
    expect(mockAnchor.href).toBe('blob:mock-url')
    expect(mockAnchor.download).toMatch(/\.png$/)
    expect(mockAnchor.click).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')

    createElementSpy.mockRestore()
  })
})

// ─── Copy / paste / duplicate ─────────────────────────────────────────────────
describe('Copy/paste/duplicate', () => {
  it('Ctrl+C + Ctrl+V pastes a second object (count goes to 2)', () => {
    setup()
    fireEvent.keyDown(window, { key: 'S' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
    fireEvent.keyDown(window, { key: 'c', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'v', ctrlKey: true })
    expect(screen.getByTestId('object-count')).toHaveTextContent('2 objects')
  })

  it('Ctrl+V with nothing in clipboard does nothing', () => {
    setup()
    fireEvent.keyDown(window, { key: 'v', ctrlKey: true })
    expect(screen.getByTestId('object-count')).toHaveTextContent('0 objects')
  })

  it('Ctrl+D duplicates the selected object (count goes to 2)', () => {
    setup()
    fireEvent.keyDown(window, { key: 'S' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    fireEvent.keyDown(window, { key: 'd', ctrlKey: true })
    expect(screen.getByTestId('object-count')).toHaveTextContent('2 objects')
  })

  it('undo after paste restores count to 1', async () => {
    const { user } = setup()
    fireEvent.keyDown(window, { key: 'S' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    fireEvent.keyDown(window, { key: 'c', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'v', ctrlKey: true })
    expect(screen.getByTestId('object-count')).toHaveTextContent('2 objects')
    await user.click(screen.getByTestId('undo-button'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
  })

  it('Delete key removes the selected object', () => {
    setup()
    fireEvent.keyDown(window, { key: 'S' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
    fireEvent.keyDown(window, { key: 'Delete' })
    expect(screen.getByTestId('object-count')).toHaveTextContent('0 objects')
  })

  it('Ctrl+Y redoes after undo', async () => {
    const { user } = setup()
    fireEvent.keyDown(window, { key: 'S' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    await user.click(screen.getByTestId('undo-button'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('0 objects')
    fireEvent.keyDown(window, { key: 'y', ctrlKey: true })
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
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

// ─── Additional keyboard shortcuts ───────────────────────────────────────────
describe('Additional keyboard shortcuts', () => {
  it('pressing R activates the road tool', () => {
    setup()
    fireEvent.keyDown(window, { key: 'R' })
    expect(screen.getByTestId('object-count').closest('div')?.textContent).toContain('Tool: ROAD')
  })

  it('pressing V activates the select tool after switching away', () => {
    setup()
    fireEvent.keyDown(window, { key: 'S' })
    fireEvent.keyDown(window, { key: 'V' })
    expect(screen.getByTestId('object-count').closest('div')?.textContent).toContain('Tool: SELECT')
  })

  it('pressing H activates the pan tool', () => {
    setup()
    fireEvent.keyDown(window, { key: 'H' })
    expect(screen.getByTestId('object-count').closest('div')?.textContent).toContain('Tool: PAN')
  })

  it('pressing D activates the device tool', () => {
    setup()
    fireEvent.keyDown(window, { key: 'D' })
    expect(screen.getByTestId('object-count').closest('div')?.textContent).toContain('Tool: DEVICE')
  })

  it('pressing Z activates the zone tool', () => {
    setup()
    fireEvent.keyDown(window, { key: 'Z' })
    expect(screen.getByTestId('object-count').closest('div')?.textContent).toContain('Tool: ZONE')
  })

  it('pressing A activates the arrow tool', () => {
    setup()
    fireEvent.keyDown(window, { key: 'A' })
    expect(screen.getByTestId('object-count').closest('div')?.textContent).toContain('Tool: ARROW')
  })

  it('pressing T activates the text tool', () => {
    setup()
    fireEvent.keyDown(window, { key: 'T' })
    expect(screen.getByTestId('object-count').closest('div')?.textContent).toContain('Tool: TEXT')
  })

  it('pressing M activates the measure tool', () => {
    setup()
    fireEvent.keyDown(window, { key: 'M' })
    expect(screen.getByTestId('object-count').closest('div')?.textContent).toContain('Tool: MEASURE')
  })

  it('pressing X activates the erase tool', () => {
    setup()
    fireEvent.keyDown(window, { key: 'X' })
    expect(screen.getByTestId('object-count').closest('div')?.textContent).toContain('Tool: ERASE')
  })

  it('pressing Escape clears drawing state without crashing', () => {
    setup()
    fireEvent.keyDown(window, { key: 'S' })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByTestId('object-count')).toHaveTextContent('0 objects')
  })

  it('pressing Backspace removes the selected object', () => {
    setup()
    fireEvent.keyDown(window, { key: 'S' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
    fireEvent.keyDown(window, { key: 'Backspace' })
    expect(screen.getByTestId('object-count')).toHaveTextContent('0 objects')
  })

  it('Ctrl+Shift+Z redoes after undo', async () => {
    const { user } = setup()
    fireEvent.keyDown(window, { key: 'S' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    await user.click(screen.getByTestId('undo-button'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('0 objects')
    fireEvent.keyDown(window, { key: 'Z', ctrlKey: true, shiftKey: true })
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
  })
})

// ─── Canvas toggles ───────────────────────────────────────────────────────────
describe('Canvas toggles', () => {
  it('Show Grid checkbox is checked by default', () => {
    setup()
    expect(screen.getByLabelText(/show grid/i)).toBeChecked()
  })

  it('unchecking Show Grid reflects Grid OFF in the status bar', async () => {
    const { user } = setup()
    await user.click(screen.getByLabelText(/show grid/i))
    expect(screen.getByTestId('object-count').closest('div')?.textContent).toContain('Grid OFF')
  })

  it('re-checking Show Grid reflects Grid ON in the status bar', async () => {
    const { user } = setup()
    await user.click(screen.getByLabelText(/show grid/i))
    await user.click(screen.getByLabelText(/show grid/i))
    expect(screen.getByTestId('object-count').closest('div')?.textContent).toContain('Grid ON')
  })

  it('Snap to Endpoints checkbox is checked by default', () => {
    setup()
    expect(screen.getByLabelText(/snap to endpoints/i)).toBeChecked()
  })

  it('unchecking Snap to Endpoints reflects Snap OFF in the status bar', async () => {
    const { user } = setup()
    await user.click(screen.getByLabelText(/snap to endpoints/i))
    expect(screen.getByTestId('object-count').closest('div')?.textContent).toContain('Snap OFF')
  })

  it('re-enabling Snap to Endpoints reflects Snap: endpoint in the status bar', async () => {
    const { user } = setup()
    await user.click(screen.getByLabelText(/snap to endpoints/i))
    await user.click(screen.getByLabelText(/snap to endpoints/i))
    expect(screen.getByTestId('object-count').closest('div')?.textContent).toContain('Snap: endpoint')
  })
})

// ─── Zoom controls ────────────────────────────────────────────────────────────
describe('Zoom controls', () => {
  it('initial zoom is 100% in the status bar', () => {
    setup()
    expect(screen.getByText('Zoom: 100%')).toBeInTheDocument()
  })

  it('clicking Zoom In increases zoom to 120%', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: '+' }))
    expect(screen.getByText('Zoom: 120%')).toBeInTheDocument()
  })

  it('clicking Zoom Out after Zoom In returns to 100%', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: '+' }))
    await user.click(screen.getByRole('button', { name: '−' }))
    expect(screen.getByText('Zoom: 100%')).toBeInTheDocument()
  })

  it('clicking Fit resets an increased zoom back to 100%', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: '+' }))
    expect(screen.getByText('Zoom: 120%')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Fit' }))
    expect(screen.getByText('Zoom: 100%')).toBeInTheDocument()
  })
})

// ─── Device tool ──────────────────────────────────────────────────────────────
describe('Device tool', () => {
  it('device tool + canvas click places a device (object count 1)', () => {
    setup()
    fireEvent.keyDown(window, { key: 'D' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
  })

  it('placing a device shows Device Properties in right panel', () => {
    setup()
    fireEvent.keyDown(window, { key: 'D' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    expect(within(screen.getByTestId('right-panel')).getByText(/device Properties/i)).toBeInTheDocument()
  })

  it('undo after placing a device restores count to 0', async () => {
    const { user } = setup()
    fireEvent.keyDown(window, { key: 'D' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
    await user.click(screen.getByTestId('undo-button'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('0 objects')
  })

  it('Ctrl+D duplicates a placed device (count goes to 2)', () => {
    setup()
    fireEvent.keyDown(window, { key: 'D' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    fireEvent.keyDown(window, { key: 'd', ctrlKey: true })
    expect(screen.getByTestId('object-count')).toHaveTextContent('2 objects')
  })
})

// ─── Erase tool ───────────────────────────────────────────────────────────────
describe('Erase tool', () => {
  it('erase tool clicking on a placed sign removes it', () => {
    setup()
    fireEvent.keyDown(window, { key: 'S' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
    fireEvent.keyDown(window, { key: 'X' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('0 objects')
  })

  it('erase tool on an empty canvas does not crash', () => {
    setup()
    fireEvent.keyDown(window, { key: 'X' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('0 objects')
  })

  it('undo after erase restores the erased object', async () => {
    const { user } = setup()
    fireEvent.keyDown(window, { key: 'S' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    fireEvent.keyDown(window, { key: 'X' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('0 objects')
    await user.click(screen.getByTestId('undo-button'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
  })
})

// ─── Text tool ────────────────────────────────────────────────────────────────
describe('Text tool', () => {
  const mockPrompt = (value: string) =>
    (globalThis.prompt as ReturnType<typeof vi.fn>).mockReturnValueOnce(value)

  it('text tool + canvas click with prompt input places a text object', () => {
    mockPrompt('Hello World')
    setup()
    fireEvent.keyDown(window, { key: 'T' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
  })

  it('text tool + canvas click when prompt is cancelled places no object', () => {
    // prompt already returns null from setup.ts — no override needed
    setup()
    fireEvent.keyDown(window, { key: 'T' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('0 objects')
  })

  it('placed text object shows Text Properties in right panel', () => {
    mockPrompt('Label')
    setup()
    fireEvent.keyDown(window, { key: 'T' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    expect(within(screen.getByTestId('right-panel')).getByText(/text Properties/i)).toBeInTheDocument()
  })

  it('undo after placing text restores count to 0', async () => {
    mockPrompt('Undo me')
    const { user } = setup()
    fireEvent.keyDown(window, { key: 'T' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
    await user.click(screen.getByTestId('undo-button'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('0 objects')
  })
})

// ─── Clear All ────────────────────────────────────────────────────────────────
describe('Clear All', () => {
  it('Clear All button is present in the toolbar', () => {
    setup()
    expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument()
  })

  it('Clear All with confirm=true removes all objects', async () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true)
    const { user } = setup()
    fireEvent.keyDown(window, { key: 'S' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
    await user.click(screen.getByRole('button', { name: /clear all/i }))
    expect(screen.getByTestId('object-count')).toHaveTextContent('0 objects')
  })

  it('Clear All with confirm=false leaves objects intact', async () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false)
    const { user } = setup()
    fireEvent.keyDown(window, { key: 'S' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
    await user.click(screen.getByRole('button', { name: /clear all/i }))
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
  })
})

// ─── Plan metadata (additional fields) ───────────────────────────────────────
describe('Plan metadata (additional fields)', () => {
  it('typing in Location input updates the value', async () => {
    const { user } = setup()
    const input = screen.getByLabelText('Location')
    await user.type(input, 'Main St & 5th Ave')
    expect(input).toHaveValue('Main St & 5th Ave')
  })

  it('typing in Notes textarea updates the value', async () => {
    const { user } = setup()
    const textarea = screen.getByLabelText('Notes')
    await user.type(textarea, 'Night work only')
    expect(textarea).toHaveValue('Night work only')
  })

  it('Location value is persisted in autosave', async () => {
    const setItemSpy = vi.spyOn(window.localStorage, 'setItem')
    const { user } = setup()
    await user.type(screen.getByLabelText('Location'), 'Downtown')
    const autosaveCalls = setItemSpy.mock.calls.filter(([k]) => k === 'tcp_autosave')
    expect(autosaveCalls.length).toBeGreaterThan(0)
    const payload = JSON.parse(autosaveCalls[autosaveCalls.length - 1][1] as string)
    expect(payload.metadata.location).toContain('Downtown')
  })
})

// ─── Left panel navigation ────────────────────────────────────────────────────
describe('Left panel navigation', () => {
  it('clicking Devices tab shows the Traffic Devices list', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'devices' }))
    expect(screen.getByText('Traffic Devices')).toBeInTheDocument()
  })

  it('clicking a device in Devices tab activates the device tool', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'devices' }))
    // The first device is Traffic Cone
    await user.click(screen.getByText('Traffic Cone'))
    expect(screen.getByTestId('object-count').closest('div')?.textContent).toContain('Tool: DEVICE')
  })

  it('clicking Roads tab shows road type buttons', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'roads' }))
    expect(screen.getByText('2-Lane Road')).toBeInTheDocument()
  })

  it('clicking a road type in Roads tab activates the road tool', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'roads' }))
    await user.click(screen.getByText('2-Lane Road'))
    expect(screen.getByTestId('object-count').closest('div')?.textContent).toContain('Tool: ROAD')
  })
})

// ─── Layers section ───────────────────────────────────────────────────────────
describe('Layers section', () => {
  it('shows "No objects yet" when canvas is empty', () => {
    setup()
    const rightPanel = screen.getByTestId('right-panel')
    // The layers section at the bottom of the right panel shows this when empty
    expect(within(rightPanel).getByText('No objects yet')).toBeInTheDocument()
  })

  it('shows placed sign label in layers list', () => {
    setup()
    fireEvent.keyDown(window, { key: 'S' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    // The default selected sign is STOP — its label appears in the layers list
    const rightPanel = screen.getByTestId('right-panel')
    expect(within(rightPanel).getByText('STOP')).toBeInTheDocument()
  })

  it('clicking a layer row selects that object', () => {
    setup()
    fireEvent.keyDown(window, { key: 'D' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    // Deselect by pressing Escape then V (select tool with no canvas hit)
    fireEvent.keyDown(window, { key: 'V' })
    // Now click the layer row for the device — it shows "Traffic Cone" in the layers list
    const rightPanel = screen.getByTestId('right-panel')
    const layerRow = within(rightPanel).getByText('Traffic Cone')
    fireEvent.click(layerRow)
    // After clicking, the properties panel should show device Properties
    expect(within(rightPanel).getByText(/device Properties/i)).toBeInTheDocument()
  })
})

// ─── Right panel tab keyboard navigation ─────────────────────────────────────
describe('Right panel tab keyboard navigation', () => {
  it('ArrowRight on Properties tab switches to Manifest tab', () => {
    setup()
    fireEvent.keyDown(screen.getByTestId('tab-properties'), { key: 'ArrowRight' })
    expect(screen.getByTestId('manifest-panel')).toBeInTheDocument()
  })

  it('ArrowDown on Properties tab also switches to Manifest tab', () => {
    setup()
    fireEvent.keyDown(screen.getByTestId('tab-properties'), { key: 'ArrowDown' })
    expect(screen.getByTestId('manifest-panel')).toBeInTheDocument()
  })

  it('End key on Properties tab switches to Manifest tab', () => {
    setup()
    fireEvent.keyDown(screen.getByTestId('tab-properties'), { key: 'End' })
    expect(screen.getByTestId('manifest-panel')).toBeInTheDocument()
  })

  it('ArrowLeft on Manifest tab switches back to Properties tab', () => {
    setup()
    fireEvent.keyDown(screen.getByTestId('tab-properties'), { key: 'ArrowRight' })
    expect(screen.getByTestId('manifest-panel')).toBeInTheDocument()
    fireEvent.keyDown(screen.getByTestId('tab-manifest'), { key: 'ArrowLeft' })
    expect(screen.queryByTestId('manifest-panel')).not.toBeInTheDocument()
  })

  it('Home key on Manifest tab switches back to Properties tab', () => {
    setup()
    fireEvent.keyDown(screen.getByTestId('tab-properties'), { key: 'End' })
    expect(screen.getByTestId('manifest-panel')).toBeInTheDocument()
    fireEvent.keyDown(screen.getByTestId('tab-manifest'), { key: 'Home' })
    expect(screen.queryByTestId('manifest-panel')).not.toBeInTheDocument()
  })

  it('unrecognised key on Properties tab does not change active tab', () => {
    setup()
    fireEvent.keyDown(screen.getByTestId('tab-properties'), { key: 'Tab' })
    // Still on properties — manifest panel absent
    expect(screen.queryByTestId('manifest-panel')).not.toBeInTheDocument()
  })
})

// ─── Save plan ────────────────────────────────────────────────────────────────
describe('Save plan', () => {
  it('Save button is present in the toolbar', () => {
    setup()
    expect(screen.getByTitle('Download plan as .tcp.json')).toBeInTheDocument()
  })

  it('clicking Save triggers a .tcp.json download', async () => {
    ;(URL.createObjectURL as ReturnType<typeof vi.fn>).mockClear()
    ;(URL.revokeObjectURL as ReturnType<typeof vi.fn>).mockClear()

    const mockAnchor = { href: '', download: '', click: vi.fn() }
    const realCreateElement = document.createElement.bind(document)
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(
      (tag: string) => tag === 'a' ? (mockAnchor as unknown as HTMLElement) : realCreateElement(tag),
    )

    const { user } = setup()
    await user.click(screen.getByTitle('Download plan as .tcp.json'))

    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(mockAnchor.download).toMatch(/\.tcp\.json$/)
    expect(mockAnchor.click).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalled()

    createElementSpy.mockRestore()
  })

  it('saved JSON includes planTitle, canvasState and metadata', async () => {
    ;(URL.createObjectURL as ReturnType<typeof vi.fn>).mockClear()

    let capturedBlob: Blob | undefined
    ;(URL.createObjectURL as ReturnType<typeof vi.fn>).mockImplementation((b: Blob) => {
      capturedBlob = b
      return 'blob:mock-url'
    })

    const mockAnchor = { href: '', download: '', click: vi.fn() }
    const realCreateElement = document.createElement.bind(document)
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(
      (tag: string) => tag === 'a' ? (mockAnchor as unknown as HTMLElement) : realCreateElement(tag),
    )

    const { user } = setup()
    // Set a recognisable title
    await user.type(screen.getByTestId('plan-title'), 'MyPlan')
    await user.click(screen.getByTitle('Download plan as .tcp.json'))

    expect(capturedBlob).toBeDefined()
    const text = await capturedBlob!.text()
    const parsed = JSON.parse(text)
    expect(parsed).toHaveProperty('name')
    expect(parsed).toHaveProperty('canvasState')
    expect(parsed).toHaveProperty('metadata')

    createElementSpy.mockRestore()
    ;(URL.createObjectURL as ReturnType<typeof vi.fn>).mockReturnValue('blob:mock-url')
  })
})

// ─── Polyline road ────────────────────────────────────────────────────────────
describe('Polyline road', () => {
  it('two canvas clicks then Enter creates a polyline road', async () => {
    const { user } = setup()
    // Navigate to roads tab and select Polyline drawing mode
    await user.click(screen.getByRole('button', { name: 'roads' }))
    await user.click(screen.getByRole('button', { name: /polyline/i }))
    const canvas = screen.getByTestId('konva-stage')
    fireEvent.mouseDown(canvas)
    fireEvent.mouseDown(canvas)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
  })

  it('Escape after adding polyline points cancels the road (count stays 0)', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'roads' }))
    await user.click(screen.getByRole('button', { name: /polyline/i }))
    const canvas = screen.getByTestId('konva-stage')
    fireEvent.mouseDown(canvas)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByTestId('object-count')).toHaveTextContent('0 objects')
  })

  it('status bar shows in-progress point count while drawing polyline', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'roads' }))
    await user.click(screen.getByRole('button', { name: /polyline/i }))
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    expect(screen.getByText(/1 pts/)).toBeInTheDocument()
  })
})
