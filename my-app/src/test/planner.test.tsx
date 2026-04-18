import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TrafficControlPlanner from '../traffic-control-planner'
import { stageStub, mockCanvas } from './konva-stub'
import * as planStorage from '../planStorage'
import * as analytics from '../analytics'
import { DEFAULT_TILE_URL, resolveTileUrl, buildTileUrl } from '../utils'

beforeEach(() => {
  localStorage.clear()
  // Seed a mapCenter so drawing tools are not blocked by the address guard in any test
  localStorage.setItem('tcp_autosave', JSON.stringify({ mapCenter: { lat: 37.7749, lng: -122.4194, zoom: 15 } }))
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

// ─── Legend box ───────────────────────────────────────────────────────────────
describe('Legend box', () => {
  it('legend toggle checkbox is checked by default', () => {
    setup()
    expect(screen.getByTestId('legend-toggle')).toBeChecked()
  })

  it('unchecking legend toggle does not crash', async () => {
    const { user } = setup()
    await expect(user.click(screen.getByTestId('legend-toggle'))).resolves.not.toThrow()
    expect(screen.getByTestId('legend-toggle')).not.toBeChecked()
  })

  it('legend toggle re-checks correctly', async () => {
    const { user } = setup()
    await user.click(screen.getByTestId('legend-toggle'))
    await user.click(screen.getByTestId('legend-toggle'))
    expect(screen.getByTestId('legend-toggle')).toBeChecked()
  })

  it('placing a sign shows its exact label in the legend', () => {
    setup()
    fireEvent.keyDown(window, { key: 'S' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    const labels = screen.getAllByTestId('legend-item-label')
    expect(labels.some(l => l.textContent === 'STOP')).toBe(true)
  })

  it('placing a device shows its exact label in the legend', () => {
    setup()
    fireEvent.keyDown(window, { key: 'D' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    const labels = screen.getAllByTestId('legend-item-label')
    expect(labels.some(l => l.textContent === 'Traffic Cone')).toBe(true)
  })

  it('legend count for the placed sign row shows the correct number', () => {
    setup()
    fireEvent.keyDown(window, { key: 'S' })
    const canvas = screen.getByTestId('konva-stage')
    fireEvent.mouseDown(canvas)
    fireEvent.mouseDown(canvas)
    fireEvent.mouseDown(canvas)
    // Find the STOP label, then its sibling count in the same row
    const stopLabel = screen.getAllByTestId('legend-item-label').find(l => l.textContent === 'STOP')!
    const row = stopLabel.closest('div') as HTMLElement
    expect(within(row).getByTestId('legend-count')).toHaveTextContent('3')
  })

  it('legend box is absent when canvas is empty', () => {
    setup()
    expect(screen.queryByTestId('legend-box')).not.toBeInTheDocument()
  })

  it('hiding toggle removes legend box from DOM', async () => {
    const { user } = setup()
    fireEvent.keyDown(window, { key: 'S' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    expect(screen.getByTestId('legend-box')).toBeInTheDocument()
    await user.click(screen.getByTestId('legend-toggle'))
    expect(screen.queryByTestId('legend-box')).not.toBeInTheDocument()
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
    const trackSpy = vi.spyOn(analytics, 'track')

    // Render first so React's <a> elements are created before the spy is set up
    const { user } = setup()

    const mockAnchor = { href: '', download: '', click: vi.fn() }
    const realCreateElement = document.createElement.bind(document)
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
      tag === 'a' ? (mockAnchor as unknown as HTMLElement) : realCreateElement(tag),
    )

    await user.click(screen.getByTestId('export-png-button'))

    expect(stageStub.toCanvas).toHaveBeenCalledWith({ pixelRatio: 2 })
    expect(mockCanvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png')
    expect(mockAnchor.href).toBe('blob:mock-url')
    expect(mockAnchor.download).toMatch(/\.png$/)
    expect(mockAnchor.click).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
    expect(trackSpy).toHaveBeenCalledWith('plan_exported_png', expect.objectContaining({ object_count: expect.any(Number) }))

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

  it('autosave payload includes userId when provided', async () => {
    const setItemSpy = vi.spyOn(window.localStorage, 'setItem')
    const user = userEvent.setup()
    render(<TrafficControlPlanner userId="user-42" />)
    await user.type(screen.getByTestId('plan-title'), 'X')
    const autosaveCalls = setItemSpy.mock.calls.filter(([k]) => k === AUTOSAVE_KEY)
    expect(autosaveCalls.length).toBeGreaterThan(0)
    const payload = JSON.parse(autosaveCalls[autosaveCalls.length - 1][1] as string)
    expect(payload.userId).toBe('user-42')
  })
})

// ─── Auth props (userId / onSignOut) ──────────────────────────────────────────
describe('Auth props', () => {
  it('sign-out button is not rendered when onSignOut is not provided', () => {
    render(<TrafficControlPlanner userId={null} />)
    expect(screen.queryByTestId('sign-out-button')).not.toBeInTheDocument()
  })

  it('sign-out button is rendered when onSignOut is provided', () => {
    const onSignOut = vi.fn()
    render(<TrafficControlPlanner userId="user-abc" onSignOut={onSignOut} />)
    expect(screen.getByTestId('sign-out-button')).toBeInTheDocument()
  })

  it('sign-out button title shows userEmail when provided', () => {
    render(<TrafficControlPlanner userId="cognito-uuid" userEmail="alice@example.com" onSignOut={vi.fn()} />)
    expect(screen.getByTestId('sign-out-button').title).toBe('alice@example.com')
  })

  it('sign-out button does not expose email in visible text', () => {
    render(<TrafficControlPlanner userId="cognito-uuid" userEmail="alice@example.com" onSignOut={vi.fn()} />)
    expect(screen.getByTestId('sign-out-button').textContent).not.toContain('alice@example.com')
  })

  it('sign-out button title falls back to userId when no email provided', () => {
    render(<TrafficControlPlanner userId="cognito-uuid" onSignOut={vi.fn()} />)
    expect(screen.getByTestId('sign-out-button').title).toBe('cognito-uuid')
  })

  it('sign-out button title shows "Signed in" when neither userId nor userEmail provided', () => {
    render(<TrafficControlPlanner onSignOut={vi.fn()} />)
    expect(screen.getByTestId('sign-out-button').title).toBe('Signed in')
  })

  it('clicking sign-out button calls onSignOut', async () => {
    const onSignOut = vi.fn()
    const user = userEvent.setup()
    render(<TrafficControlPlanner userId="user-abc" onSignOut={onSignOut} />)
    await user.click(screen.getByTestId('sign-out-button'))
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })

  it('sign-out button is visible and appears after export buttons in the page', () => {
    render(<TrafficControlPlanner userId="user-abc" onSignOut={vi.fn()} />)
    const allButtons = screen.getAllByRole('button')
    const pngIdx = allButtons.findIndex(b => b.getAttribute('data-testid') === 'export-png-button')
    const pdfIdx = allButtons.findIndex(b => b.getAttribute('data-testid') === 'export-pdf-button')
    const signOutIdx = allButtons.findIndex(b => b.getAttribute('data-testid') === 'sign-out-button')
    expect(signOutIdx).toBeGreaterThan(pngIdx)
    expect(signOutIdx).toBeGreaterThan(pdfIdx)
  })

  it('clicking Export PDF when anonymous calls onRequestSignIn instead of opening the preview', async () => {
    const onRequestSignIn = vi.fn()
    const user = userEvent.setup()
    render(<TrafficControlPlanner userId={null} onRequestSignIn={onRequestSignIn} />)
    await user.click(screen.getByTestId('export-pdf-button'))
    expect(onRequestSignIn).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('export-preview-modal')).not.toBeInTheDocument()
  })

  it('clicking Export PDF when signed in does NOT call onRequestSignIn', async () => {
    const onRequestSignIn = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['%PDF'], { type: 'application/pdf' })),
    }))
    const user = userEvent.setup()
    render(<TrafficControlPlanner userId="user-abc" onRequestSignIn={onRequestSignIn} />)
    await user.click(screen.getByTestId('export-pdf-button'))
    expect(onRequestSignIn).not.toHaveBeenCalled()
    expect(await screen.findByTestId('export-preview-modal')).toBeInTheDocument()
    vi.unstubAllGlobals()
  })
})

// ─── Pre-beta banner ──────────────────────────────────────────────────────────
describe('Pre-beta banner', () => {
  beforeEach(() => sessionStorage.clear())

  it('shows the banner by default', () => {
    render(<TrafficControlPlanner />)
    expect(screen.getByTestId('prebeta-banner')).toBeInTheDocument()
  })

  it('hides the banner after clicking dismiss', async () => {
    const user = userEvent.setup()
    render(<TrafficControlPlanner />)
    await user.click(screen.getByTestId('dismiss-banner'))
    expect(screen.queryByTestId('prebeta-banner')).not.toBeInTheDocument()
  })

  it('does not show the banner if already dismissed this session', () => {
    sessionStorage.setItem('tcp_prebeta_banner_dismissed', '1')
    render(<TrafficControlPlanner />)
    expect(screen.queryByTestId('prebeta-banner')).not.toBeInTheDocument()
  })

  it('contact email link is not shown in the toolbar', () => {
    render(<TrafficControlPlanner />)
    expect(screen.queryByTestId('contact-email')).not.toBeInTheDocument()
  })
})

// ─── Position inputs ───────────────────────────────────────────────────────────
describe('Position inputs', () => {
  function placeSign() {
    fireEvent.keyDown(window, { key: 'S' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
  }

  it('renders X and Y inputs in properties panel when a sign is selected', () => {
    setup()
    placeSign()
    const panel = screen.getByTestId('right-panel')
    expect(within(panel).getByLabelText('X')).toBeInTheDocument()
    expect(within(panel).getByLabelText('Y')).toBeInTheDocument()
  })

  it('X and Y inputs have step="any" to allow fractional coordinates', () => {
    setup()
    placeSign()
    const panel = screen.getByTestId('right-panel')
    expect(within(panel).getByLabelText('X')).toHaveAttribute('step', 'any')
    expect(within(panel).getByLabelText('Y')).toHaveAttribute('step', 'any')
  })

  it('typing a valid number in the X input updates the displayed value', async () => {
    const { user } = setup()
    placeSign()
    const xInput = within(screen.getByTestId('right-panel')).getByLabelText('X')
    await user.clear(xInput)
    await user.type(xInput, '42')
    expect(xInput).toHaveValue(42)
  })

  it('clearing the X input (empty → NaN) does not crash or update the object', async () => {
    const { user } = setup()
    placeSign()
    const panel = screen.getByTestId('right-panel')
    const xInput = within(panel).getByLabelText('X')
    await user.clear(xInput)
    // Object must still exist — isFinite('') is false so update is skipped
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
  })
})

// ─── Z-order controls ─────────────────────────────────────────────────────────
describe('Z-order controls', () => {
  const AUTOSAVE_KEY = 'tcp_autosave'

  function placeSign() {
    fireEvent.keyDown(window, { key: 'S' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
  }

  it('layer order buttons appear in properties panel when an object is selected', () => {
    setup()
    placeSign()
    const panel = screen.getByTestId('right-panel')
    expect(within(panel).getByRole('button', { name: 'Bring to Front' })).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Bring Forward' })).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Send Backward' })).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Send to Back' })).toBeInTheDocument()
  })

  it('z-order buttons have aria-label for screen-reader accessibility', () => {
    setup()
    placeSign()
    const panel = screen.getByTestId('right-panel')
    for (const label of ['Bring to Front', 'Bring Forward', 'Send Backward', 'Send to Back']) {
      expect(within(panel).getByRole('button', { name: label })).toHaveAttribute('aria-label', label)
    }
  })

  it('Bring to Front with one object is a no-op (object count unchanged, no crash)', async () => {
    const { user } = setup()
    placeSign()
    await user.click(within(screen.getByTestId('right-panel')).getByRole('button', { name: 'Bring to Front' }))
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
  })

  it('Send to Back with one object is a no-op (object count unchanged, no crash)', async () => {
    const { user } = setup()
    placeSign()
    await user.click(within(screen.getByTestId('right-panel')).getByRole('button', { name: 'Send to Back' }))
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
  })

  it('Send to Back reorders objects in autosave (top object moves to first position)', async () => {
    const { user } = setup()
    const canvas = screen.getByTestId('konva-stage')
    // Place sign 1 then sign 2 — sign 2 ends up selected (top of stack, index 1)
    placeSign()
    fireEvent.mouseDown(canvas)
    expect(screen.getByTestId('object-count')).toHaveTextContent('2 objects')

    const beforeSave = JSON.parse(localStorage.getItem(AUTOSAVE_KEY) ?? 'null')
    const beforeFirstId = beforeSave?.canvasState?.objects[0]?.id

    // Send sign 2 to back → it should now be at index 0
    await user.click(within(screen.getByTestId('right-panel')).getByRole('button', { name: 'Send to Back' }))

    const afterSave = JSON.parse(localStorage.getItem(AUTOSAVE_KEY) ?? 'null')
    expect(afterSave?.canvasState?.objects).toHaveLength(2)
    // The object that was first before should now be second
    expect(afterSave?.canvasState?.objects[0]?.id).not.toBe(beforeFirstId)
  })

  it('reorder is undoable and restores the previous object order', async () => {
    const { user } = setup()
    const canvas = screen.getByTestId('konva-stage')
    placeSign()
    fireEvent.mouseDown(canvas)
    expect(screen.getByTestId('object-count')).toHaveTextContent('2 objects')

    const beforeSave = JSON.parse(localStorage.getItem(AUTOSAVE_KEY) ?? 'null')
    const beforeOrder = beforeSave?.canvasState?.objects.map((o: { id: string }) => o.id)

    await user.click(within(screen.getByTestId('right-panel')).getByRole('button', { name: 'Send to Back' }))
    await user.click(screen.getByTestId('undo-button'))

    const afterSave = JSON.parse(localStorage.getItem(AUTOSAVE_KEY) ?? 'null')
    const afterOrder = afterSave?.canvasState?.objects.map((o: { id: string }) => o.id)
    expect(afterOrder).toEqual(beforeOrder)
  })

  it('no-op reorder does not add an extra undo step', async () => {
    const { user } = setup()
    placeSign()
    // With 1 object, "Bring to Front" is a no-op — undo should still go to 0 objects
    await user.click(within(screen.getByTestId('right-panel')).getByRole('button', { name: 'Bring to Front' }))
    await user.click(screen.getByTestId('undo-button'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('0 objects')
  })
})

// ─── Cubic Bézier road ────────────────────────────────────────────────────────
describe('Cubic Bézier road', () => {
  async function activateCubicMode(user: ReturnType<typeof userEvent.setup>) {
    // Navigate to the Roads tab and click the Cubic mode button
    await user.click(screen.getByRole('button', { name: /^roads$/i }))
    await user.click(screen.getByRole('button', { name: /cubic/i }))
  }

  it('activating Cubic mode sets tool to ROAD (cubic)', async () => {
    const { user } = setup()
    await activateCubicMode(user)
    expect(screen.getByTestId('object-count').closest('div')?.textContent).toContain('Tool: ROAD (cubic)')
  })

  it('4 canvas clicks place one cubic_bezier_road (object count 1)', async () => {
    const { user } = setup()
    await activateCubicMode(user)
    const canvas = screen.getByTestId('konva-stage')
    fireEvent.mouseDown(canvas)
    fireEvent.mouseDown(canvas)
    fireEvent.mouseDown(canvas)
    fireEvent.mouseDown(canvas)
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
  })

  it('3 clicks do not yet place an object', async () => {
    const { user } = setup()
    await activateCubicMode(user)
    const canvas = screen.getByTestId('konva-stage')
    fireEvent.mouseDown(canvas)
    fireEvent.mouseDown(canvas)
    fireEvent.mouseDown(canvas)
    expect(screen.getByTestId('object-count')).toHaveTextContent('0 objects')
  })

  it('placing a cubic road shows Cubic Bézier Road in the properties panel', async () => {
    const { user } = setup()
    await activateCubicMode(user)
    const canvas = screen.getByTestId('konva-stage')
    fireEvent.mouseDown(canvas)
    fireEvent.mouseDown(canvas)
    fireEvent.mouseDown(canvas)
    fireEvent.mouseDown(canvas)
    expect(within(screen.getByTestId('right-panel')).getByText(/cubic bézier road/i)).toBeInTheDocument()
  })

  it('Escape mid-draw cancels without placing an object', async () => {
    const { user } = setup()
    await activateCubicMode(user)
    const canvas = screen.getByTestId('konva-stage')
    fireEvent.mouseDown(canvas)
    fireEvent.mouseDown(canvas)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByTestId('object-count')).toHaveTextContent('0 objects')
  })

  it('Escape after three clicks cancels without placing an object', async () => {
    const { user } = setup()
    await activateCubicMode(user)
    const canvas = screen.getByTestId('konva-stage')
    fireEvent.mouseDown(canvas)  // p0
    fireEvent.mouseDown(canvas)  // cp1
    fireEvent.mouseDown(canvas)  // cp2
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByTestId('object-count')).toHaveTextContent('0 objects')
  })

  it('placed cubic road is undoable', async () => {
    const { user } = setup()
    await activateCubicMode(user)
    const canvas = screen.getByTestId('konva-stage')
    fireEvent.mouseDown(canvas)
    fireEvent.mouseDown(canvas)
    fireEvent.mouseDown(canvas)
    fireEvent.mouseDown(canvas)
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
    await user.click(screen.getByTestId('undo-button'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('0 objects')
  })
})

// ─── Legend Box ───────────────────────────────────────────────────────────────
describe('Legend Box', () => {
  it('is not shown when canvas is empty', () => {
    setup()
    expect(screen.queryByTestId('legend-box')).not.toBeInTheDocument()
  })

  it('appears after placing a sign', () => {
    setup()
    fireEvent.keyDown(window, { key: 'S' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    expect(screen.getByTestId('legend-box')).toBeInTheDocument()
  })

  it('shows count of 1 after placing one sign', () => {
    setup()
    fireEvent.keyDown(window, { key: 'S' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    const counts = screen.getAllByTestId('legend-count')
    expect(counts[0]).toHaveTextContent('1')
  })

  it('updates count to 2 after placing a second identical sign', () => {
    setup()
    fireEvent.keyDown(window, { key: 'S' })
    const canvas = screen.getByTestId('konva-stage')
    fireEvent.mouseDown(canvas)
    fireEvent.mouseDown(canvas)
    const counts = screen.getAllByTestId('legend-count')
    expect(counts[0]).toHaveTextContent('2')
  })

  it('disappears after deleting the only object', () => {
    setup()
    fireEvent.keyDown(window, { key: 'S' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    expect(screen.getByTestId('legend-box')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Delete' })
    expect(screen.queryByTestId('legend-box')).not.toBeInTheDocument()
  })

  it('toggle checkbox hides the legend box', async () => {
    const { user } = setup()
    fireEvent.keyDown(window, { key: 'S' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    expect(screen.getByTestId('legend-box')).toBeInTheDocument()
    await user.click(screen.getByTestId('legend-toggle'))
    expect(screen.queryByTestId('legend-box')).not.toBeInTheDocument()
  })

  it('toggle checkbox shows the legend box again', async () => {
    const { user } = setup()
    fireEvent.keyDown(window, { key: 'S' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    await user.click(screen.getByTestId('legend-toggle'))
    await user.click(screen.getByTestId('legend-toggle'))
    expect(screen.getByTestId('legend-box')).toBeInTheDocument()
  })

  it('does not appear after placing a taper (non-sign, non-device object)', () => {
    setup()
    fireEvent.keyDown(window, { key: 'P' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    expect(screen.queryByTestId('legend-box')).not.toBeInTheDocument()
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
  })

  it('appears after placing a device and shows count of 1', () => {
    setup()
    fireEvent.keyDown(window, { key: 'D' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    expect(screen.getByTestId('legend-box')).toBeInTheDocument()
    const counts = screen.getAllByTestId('legend-count')
    expect(counts[0]).toHaveTextContent('1')
  })

  it('increments device count when placing the same device twice', () => {
    setup()
    fireEvent.keyDown(window, { key: 'D' })
    const canvas = screen.getByTestId('konva-stage')
    fireEvent.mouseDown(canvas)
    fireEvent.mouseDown(canvas)
    const counts = screen.getAllByTestId('legend-count')
    expect(counts[0]).toHaveTextContent('2')
  })

  it('shows separate entries for a sign and a device', () => {
    setup()
    fireEvent.keyDown(window, { key: 'S' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    fireEvent.keyDown(window, { key: 'D' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    const counts = screen.getAllByTestId('legend-count')
    expect(counts).toHaveLength(2)
    expect(counts[0]).toHaveTextContent('1')
    expect(counts[1]).toHaveTextContent('1')
  })
})

// ─── Cloud Save / Load ────────────────────────────────────────────────────────
describe('Cloud Save / Load', () => {
  it('☁ Save button is absent when no userId prop is given', () => {
    render(<TrafficControlPlanner />)
    expect(screen.queryByTestId('cloud-save-button')).not.toBeInTheDocument()
  })

  it('☁ Plans button is absent when no userId prop is given', () => {
    render(<TrafficControlPlanner />)
    expect(screen.queryByTestId('cloud-plans-button')).not.toBeInTheDocument()
  })

  it('☁ Save button is present when userId is provided', () => {
    render(<TrafficControlPlanner userId="user-123" />)
    expect(screen.getByTestId('cloud-save-button')).toBeInTheDocument()
  })

  it('☁ Plans button is present when userId is provided', () => {
    render(<TrafficControlPlanner userId="user-123" />)
    expect(screen.getByTestId('cloud-plans-button')).toBeInTheDocument()
  })

  it('clicking ☁ Save calls savePlanToCloud with correct userId and payload shape', async () => {
    const saveSpy = vi.spyOn(planStorage, 'savePlanToCloud').mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<TrafficControlPlanner userId="user-abc" />)
    await user.click(screen.getByTestId('cloud-save-button'))
    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledTimes(1)
      const [userId, planId, payload] = saveSpy.mock.calls[0] as [string, string, Record<string, unknown>]
      expect(userId).toBe('user-abc')
      expect(typeof planId).toBe('string')
      expect(planId.length).toBeGreaterThan(0)
      expect(payload).toMatchObject({ id: planId, userId: 'user-abc' })
      expect(payload.canvasState).toBeDefined()
      expect(Array.isArray((payload.canvasState as { objects: unknown[] }).objects)).toBe(true)
    })
  })

  it('shows "Saved ✓" in button after successful save', async () => {
    vi.spyOn(planStorage, 'savePlanToCloud').mockResolvedValue(undefined)
    const trackSpy = vi.spyOn(analytics, 'track')
    const user = userEvent.setup()
    render(<TrafficControlPlanner userId="user-abc" />)
    await user.click(screen.getByTestId('cloud-save-button'))
    await waitFor(() =>
      expect(screen.getByTestId('cloud-save-button')).toHaveTextContent('Saved ✓')
    )
    expect(trackSpy).toHaveBeenCalledWith('plan_saved_cloud', expect.objectContaining({ object_count: expect.any(Number) }))
  })

  it('shows error message in button when save fails', async () => {
    vi.spyOn(planStorage, 'savePlanToCloud').mockRejectedValue(new Error('Network error'))
    const user = userEvent.setup()
    render(<TrafficControlPlanner userId="user-abc" />)
    await user.click(screen.getByTestId('cloud-save-button'))
    await waitFor(() =>
      expect(screen.getByTestId('cloud-save-button')).toHaveTextContent('Network error')
    )
  })

  it('clears save status after 3 seconds', async () => {
    vi.spyOn(planStorage, 'savePlanToCloud').mockResolvedValue(undefined)
    let clearCallback: (() => void) | undefined
    const origSetTimeout = globalThis.setTimeout
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: TimerHandler, delay?: number) => {
      if (typeof fn === 'function' && delay === 3000) { clearCallback = fn as () => void; return 0 }
      return origSetTimeout(fn, delay)
    }) as typeof setTimeout)
    const user = userEvent.setup()
    render(<TrafficControlPlanner userId="user-abc" />)
    await user.click(screen.getByTestId('cloud-save-button'))
    await waitFor(() =>
      expect(screen.getByTestId('cloud-save-button')).toHaveTextContent('Saved ✓')
    )
    act(() => { clearCallback?.() })
    expect(screen.getByTestId('cloud-save-button')).not.toHaveTextContent('Saved ✓')
  })

  it('clicking ☁ Plans opens the plan dashboard', async () => {
    const user = userEvent.setup()
    render(<TrafficControlPlanner userId="user-abc" />)
    await user.click(screen.getByTestId('cloud-plans-button'))
    expect(screen.getByTestId('plan-dashboard')).toBeInTheDocument()
  })

  it('closing the dashboard hides it', async () => {
    const user = userEvent.setup()
    render(<TrafficControlPlanner userId="user-abc" />)
    await user.click(screen.getByTestId('cloud-plans-button'))
    await user.click(screen.getByTestId('dashboard-close'))
    expect(screen.queryByTestId('plan-dashboard')).not.toBeInTheDocument()
  })
})

// ─── Save Conflict Detection ──────────────────────────────────────────────────
describe('Save Conflict Detection', () => {
  const MOCK_PLAN_META = {
    path: 'plans/user-abc/plan-abc.tcp.json',
    planId: 'plan-abc',
    name: 'plan-abc',
    lastModified: '2026-04-15T08:00:00.000Z',
    size: 512,
  }
  const REMOTE_PLAN = {
    id: 'plan-abc', name: 'Remote Plan', createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-15T09:00:00.000Z', userId: 'user-abc',
    canvasState: { objects: [] }, metadata: { projectNumber: '', client: '', location: '', notes: '' },
    canvasOffset: { x: 0, y: 0 }, canvasZoom: 1, mapCenter: null,
  }

  /** Opens the dashboard, clicks Open on the first plan row, waits for dashboard to close. */
  async function loadPlanFromDashboard(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByTestId('cloud-plans-button'))
    await screen.findByTestId('dashboard-open-btn')
    await user.click(screen.getByTestId('dashboard-open-btn'))
    // Wait for dashboard to close (plan loaded)
    await waitFor(() => expect(screen.queryByTestId('plan-dashboard')).not.toBeInTheDocument())
  }

  it('conflict modal is not shown on initial render', () => {
    render(<TrafficControlPlanner userId="user-abc" />)
    expect(screen.queryByTestId('save-conflict-modal')).not.toBeInTheDocument()
  })

  it('conflict modal appears when remote updatedAt differs from lastKnownUpdatedAt', async () => {
    vi.spyOn(planStorage, 'listCloudPlans').mockResolvedValue([MOCK_PLAN_META])
    vi.spyOn(planStorage, 'loadPlanFromCloud').mockResolvedValue(REMOTE_PLAN)
    vi.spyOn(planStorage, 'fetchRemoteUpdatedAt').mockResolvedValue('2026-04-15T10:00:00.000Z') // newer than REMOTE_PLAN.updatedAt
    vi.spyOn(planStorage, 'savePlanToCloud').mockResolvedValue(undefined)

    const user = userEvent.setup()
    render(<TrafficControlPlanner userId="user-abc" />)

    await loadPlanFromDashboard(user)
    await user.click(screen.getByTestId('cloud-save-button'))

    await waitFor(() =>
      expect(screen.getByTestId('save-conflict-modal')).toBeInTheDocument()
    )
  })

  it('"Keep unsaved" button closes the conflict modal without saving', async () => {
    vi.spyOn(planStorage, 'listCloudPlans').mockResolvedValue([MOCK_PLAN_META])
    vi.spyOn(planStorage, 'loadPlanFromCloud').mockResolvedValue(REMOTE_PLAN)
    vi.spyOn(planStorage, 'fetchRemoteUpdatedAt').mockResolvedValue('2026-04-15T10:00:00.000Z')
    const saveSpy = vi.spyOn(planStorage, 'savePlanToCloud').mockResolvedValue(undefined)

    const user = userEvent.setup()
    render(<TrafficControlPlanner userId="user-abc" />)

    await loadPlanFromDashboard(user)
    await user.click(screen.getByTestId('cloud-save-button'))
    await waitFor(() => expect(screen.getByTestId('save-conflict-modal')).toBeInTheDocument())

    saveSpy.mockClear()
    await user.click(screen.getByTestId('conflict-dismiss-btn'))

    expect(screen.queryByTestId('save-conflict-modal')).not.toBeInTheDocument()
    expect(saveSpy).not.toHaveBeenCalled()
  })

  it('"Overwrite remote" button saves the plan and closes the modal', async () => {
    vi.spyOn(planStorage, 'listCloudPlans').mockResolvedValue([MOCK_PLAN_META])
    vi.spyOn(planStorage, 'loadPlanFromCloud').mockResolvedValue(REMOTE_PLAN)
    vi.spyOn(planStorage, 'fetchRemoteUpdatedAt').mockResolvedValue('2026-04-15T10:00:00.000Z')
    const saveSpy = vi.spyOn(planStorage, 'savePlanToCloud').mockResolvedValue(undefined)

    const user = userEvent.setup()
    render(<TrafficControlPlanner userId="user-abc" />)

    await loadPlanFromDashboard(user)
    await user.click(screen.getByTestId('cloud-save-button'))
    await waitFor(() => expect(screen.getByTestId('save-conflict-modal')).toBeInTheDocument())

    await user.click(screen.getByTestId('conflict-overwrite-btn'))

    await waitFor(() => expect(screen.queryByTestId('save-conflict-modal')).not.toBeInTheDocument())
    expect(saveSpy).toHaveBeenCalled()
  })

  it('"Load remote version" button loads the remote plan and closes the modal', async () => {
    vi.spyOn(planStorage, 'listCloudPlans').mockResolvedValue([MOCK_PLAN_META])
    vi.spyOn(planStorage, 'loadPlanFromCloud').mockResolvedValue(REMOTE_PLAN)
    vi.spyOn(planStorage, 'fetchRemoteUpdatedAt').mockResolvedValue('2026-04-15T10:00:00.000Z')
    vi.spyOn(planStorage, 'savePlanToCloud').mockResolvedValue(undefined)

    const user = userEvent.setup()
    render(<TrafficControlPlanner userId="user-abc" />)

    await loadPlanFromDashboard(user)
    await user.click(screen.getByTestId('cloud-save-button'))
    await waitFor(() => expect(screen.getByTestId('save-conflict-modal')).toBeInTheDocument())

    await user.click(screen.getByTestId('conflict-load-remote-btn'))

    expect(screen.queryByTestId('save-conflict-modal')).not.toBeInTheDocument()
    // Plan title should switch to the remote plan's name
    expect(screen.getByDisplayValue('Remote Plan')).toBeInTheDocument()
  })

  it('no conflict modal when remote updatedAt matches lastKnownUpdatedAt', async () => {
    const KNOWN_AT = '2026-04-15T09:00:00.000Z' // same as REMOTE_PLAN.updatedAt
    vi.spyOn(planStorage, 'listCloudPlans').mockResolvedValue([MOCK_PLAN_META])
    vi.spyOn(planStorage, 'loadPlanFromCloud').mockResolvedValue(REMOTE_PLAN)
    vi.spyOn(planStorage, 'fetchRemoteUpdatedAt').mockResolvedValue(KNOWN_AT)
    vi.spyOn(planStorage, 'savePlanToCloud').mockResolvedValue(undefined)

    const user = userEvent.setup()
    render(<TrafficControlPlanner userId="user-abc" />)

    await loadPlanFromDashboard(user)
    await user.click(screen.getByTestId('cloud-save-button'))

    await waitFor(() =>
      expect(screen.getByTestId('cloud-save-button')).toHaveTextContent('Saved ✓')
    )
    expect(screen.queryByTestId('save-conflict-modal')).not.toBeInTheDocument()
  })
})

// ─── Map tiles / mapCenter ────────────────────────────────────────────────────
describe('Map tiles — mapCenter persistence', () => {
  it('mapCenter is restored from autosave on remount', () => {
    localStorage.setItem('tcp_autosave', JSON.stringify({
      canvasState: { objects: [] },
      mapCenter: { lat: 37.7749, lon: -122.4194, zoom: 14 },
    }))
    setup()
    // After mount, autosave should be written back with mapCenter preserved
    const saved = JSON.parse(localStorage.getItem('tcp_autosave') || '{}')
    expect(saved.mapCenter).toMatchObject({ lat: 37.7749, lon: -122.4194, zoom: 14 })
  })

  it('mapCenter with legacy lng field is restored correctly from autosave', () => {
    localStorage.setItem('tcp_autosave', JSON.stringify({
      canvasState: { objects: [] },
      mapCenter: { lat: 37.7749, lng: -122.4194, zoom: 14 },
    }))
    setup()
    const saved = JSON.parse(localStorage.getItem('tcp_autosave') || '{}')
    // After restoration the internal format uses lon; autosave should reflect that
    expect(saved.mapCenter).toMatchObject({ lat: 37.7749, zoom: 14 })
    expect(saved.mapCenter.lon ?? saved.mapCenter.lng).toBe(-122.4194)
  })

  it('loading a cloud plan with lng field sets mapCenter correctly', async () => {
    vi.spyOn(planStorage, 'listCloudPlans').mockResolvedValue([
      { path: 'plans/u/p.json', planId: 'plan-1', name: 'Geo Plan', lastModified: '2026-01-01T00:00:00.000Z', size: 100 },
    ])
    vi.spyOn(planStorage, 'loadPlanFromCloud').mockResolvedValue({
      id: 'plan-1', name: 'Geo Plan', canvasState: { objects: [] },
      mapCenter: { lat: 37.7749, lng: -122.4194, zoom: 14 },
    })
    const user = userEvent.setup()
    render(<TrafficControlPlanner userId="user-abc" />)
    await user.click(screen.getByTestId('cloud-plans-button'))
    await user.click(await screen.findByTestId('dashboard-open-btn'))
    await waitFor(() => expect(screen.queryByTestId('plan-dashboard')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByTestId('plan-title')).toHaveValue('Geo Plan'))
    // mapCenter should be written to autosave with lon (not undefined)
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('tcp_autosave') || '{}')
      expect(saved.mapCenter?.lon ?? saved.mapCenter?.lng).toBe(-122.4194)
    })
  })

  it('loading a cloud plan with lon field (cloud-to-cloud) sets mapCenter correctly', async () => {
    vi.spyOn(planStorage, 'listCloudPlans').mockResolvedValue([
      { path: 'plans/u/p.json', planId: 'plan-1', name: 'Geo Plan', lastModified: '2026-01-01T00:00:00.000Z', size: 100 },
    ])
    vi.spyOn(planStorage, 'loadPlanFromCloud').mockResolvedValue({
      id: 'plan-1', name: 'Geo Plan', canvasState: { objects: [] },
      mapCenter: { lat: 37.7749, lon: -122.4194, zoom: 14 },
    })
    const user = userEvent.setup()
    render(<TrafficControlPlanner userId="user-abc" />)
    await user.click(screen.getByTestId('cloud-plans-button'))
    await user.click(await screen.findByTestId('dashboard-open-btn'))
    await waitFor(() => expect(screen.queryByTestId('plan-dashboard')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByTestId('plan-title')).toHaveValue('Geo Plan'))
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('tcp_autosave') || '{}')
      expect(saved.mapCenter?.lon ?? saved.mapCenter?.lng).toBe(-122.4194)
    })
  })
})

// ─── Tile provider ────────────────────────────────────────────────────────────
describe('Tile provider — resolveTileUrl', () => {
  it('returns the default Stadia URL when no env value is provided', () => {
    expect(resolveTileUrl(undefined)).toBe(DEFAULT_TILE_URL)
    expect(resolveTileUrl('')).toBe(DEFAULT_TILE_URL)
    expect(resolveTileUrl('   ')).toBe(DEFAULT_TILE_URL)
  })

  it('default URL does not reference openstreetmap.org', () => {
    expect(DEFAULT_TILE_URL).not.toContain('openstreetmap.org')
    expect(DEFAULT_TILE_URL).toContain('stadiamaps.com')
  })

  it('returns a valid custom URL when all placeholders are present', () => {
    const custom = 'https://example.com/tiles/{z}/{x}/{y}.png'
    expect(resolveTileUrl(custom)).toBe(custom)
  })

  it('falls back to default and warns when {z} is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resolveTileUrl('https://example.com/{x}/{y}.png')).toBe(DEFAULT_TILE_URL)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('{z}'))
    warn.mockRestore()
  })

  it('falls back to default and warns when multiple placeholders are missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resolveTileUrl('https://example.com/tiles.png')).toBe(DEFAULT_TILE_URL)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('{z}'))
    warn.mockRestore()
  })
})

describe('Tile provider — buildTileUrl', () => {
  it('substitutes z, x, y into the template', () => {
    expect(buildTileUrl('https://example.com/{z}/{x}/{y}.png', 14, 3, 7))
      .toBe('https://example.com/14/3/7.png')
  })

  it('produces a Stadia URL with correct coordinates', () => {
    const url = buildTileUrl(DEFAULT_TILE_URL, 12, 100, 200)
    expect(url).toContain('stadiamaps.com')
    expect(url).toContain('/12/100/200')
    expect(url).not.toContain('{z}')
    expect(url).not.toContain('{x}')
    expect(url).not.toContain('{y}')
  })
})

// ─── Status bar road mode hints ───────────────────────────────────────────────
describe('Status bar road mode hints', () => {
  it('shows polyline hint when road tool is active with poly mode', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'roads' }))
    await user.click(screen.getByRole('button', { name: /Polyline/i }))
    expect(screen.getByText(/polyline road/i)).toBeInTheDocument()
  })

  it('shows smooth hint when road tool is active with smooth mode', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'roads' }))
    await user.click(screen.getByRole('button', { name: /Smooth/i }))
    expect(screen.getByText(/smooth road/i)).toBeInTheDocument()
  })

  it('shows intersection hint when intersection tool is active', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'roads' }))
    // Switch to intersection tool via a 4-Way button
    await user.click(screen.getByRole('button', { name: /4-Way/i }))
    expect(screen.getByText(/stamp an intersection/i)).toBeInTheDocument()
  })
})

// ─── Analytics — canvas events ────────────────────────────────────────────────
describe('Analytics — canvas events', () => {
  it('placing a sign fires sign_placed with sign_id and sign_source', () => {
    const trackSpy = vi.spyOn(analytics, 'track')
    setup()
    fireEvent.keyDown(window, { key: 'S' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    expect(trackSpy).toHaveBeenCalledWith('sign_placed', expect.objectContaining({
      sign_id: expect.any(String),
      sign_source: expect.stringMatching(/^builtin|custom$/),
    }))
  })

  it('sign_placed does not include sign_label for custom signs', () => {
    const trackSpy = vi.spyOn(analytics, 'track')
    setup()
    fireEvent.keyDown(window, { key: 'S' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    const call = trackSpy.mock.calls.find(([event]) => event === 'sign_placed')
    // built-in signs include label; custom signs must not
    if (call && (call[1] as Record<string, unknown>).sign_source === 'custom') {
      expect((call[1] as Record<string, unknown>).sign_label).toBeUndefined()
    }
  })

  it('committing a polyline road with Enter fires road_drawn', async () => {
    const trackSpy = vi.spyOn(analytics, 'track')
    const { user } = setup()
    // Open the roads left panel, then switch to poly mode
    await user.click(screen.getByRole('button', { name: 'roads' }))
    await user.click(screen.getByText('Polyline'))
    const canvas = screen.getByTestId('konva-stage')
    // Two clicks add two points (getPointerPosition always returns {0,0} — that's fine for length check)
    fireEvent.mouseDown(canvas)
    fireEvent.mouseDown(canvas)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(trackSpy).toHaveBeenCalledWith('road_drawn', expect.objectContaining({
      road_type: expect.any(String),
      draw_mode: expect.any(String),
    }))
  })

  it('placing a straight road fires road_drawn with draw_mode straight', () => {
    const trackSpy = vi.spyOn(analytics, 'track')
    // Return different positions so the distance check (>5px) passes
    let calls = 0
    vi.spyOn(stageStub, 'getPointerPosition').mockImplementation(() =>
      calls++ === 0 ? { x: 0, y: 0 } : { x: 100, y: 100 }
    )
    setup()
    fireEvent.keyDown(window, { key: 'R' })
    const canvas = screen.getByTestId('konva-stage')
    fireEvent.mouseDown(canvas)
    fireEvent.mouseUp(canvas)
    expect(trackSpy).toHaveBeenCalledWith('road_drawn', expect.objectContaining({
      draw_mode: 'straight',
      road_type: expect.any(String),
    }))
  })

  it('stamping an intersection fires road_drawn with intersection draw_mode', async () => {
    const trackSpy = vi.spyOn(analytics, 'track')
    const { user } = setup()
    // Open roads panel, then click the 4-Way intersection button to activate the tool
    await user.click(screen.getByRole('button', { name: 'roads' }))
    await user.click(screen.getByRole('button', { name: /4-Way/i }))
    const canvas = screen.getByTestId('konva-stage')
    fireEvent.mouseDown(canvas)
    expect(trackSpy).toHaveBeenCalledWith('road_drawn', expect.objectContaining({
      draw_mode: expect.stringMatching(/intersection/),
    }))
  })

  it('stamping a 4-way intersection fires road_drawn with draw_mode intersection_4way', async () => {
    const trackSpy = vi.spyOn(analytics, 'track')
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'roads' }))
    await user.click(screen.getByRole('button', { name: /4-Way/i }))
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    expect(trackSpy).toHaveBeenCalledWith('road_drawn', expect.objectContaining({
      draw_mode: 'intersection_4way',
      road_type: expect.any(String),
    }))
  })

  it('stamping a T-junction intersection fires road_drawn with draw_mode intersection_t', async () => {
    const trackSpy = vi.spyOn(analytics, 'track')
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'roads' }))
    await user.click(screen.getByRole('button', { name: /T-Junction/i }))
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    expect(trackSpy).toHaveBeenCalledWith('road_drawn', expect.objectContaining({
      draw_mode: 'intersection_t',
      road_type: expect.any(String),
    }))
  })

  it('opening a plan from the dashboard fires plan_loaded_cloud', async () => {
    const trackSpy = vi.spyOn(analytics, 'track')
    vi.spyOn(planStorage, 'listCloudPlans').mockResolvedValue([
      { path: 'plans/user-abc/plan-1.tcp.json', planId: 'plan-1', name: 'plan-1', lastModified: '2026-01-01T00:00:00.000Z', size: 100 },
    ])
    vi.spyOn(planStorage, 'loadPlanFromCloud').mockResolvedValue({
      id: 'plan-1', name: 'Test Plan', canvasState: { objects: [] },
    })
    const user = userEvent.setup()
    render(<TrafficControlPlanner userId="user-abc" />)
    await user.click(screen.getByTestId('cloud-plans-button'))
    const openBtn = await screen.findByTestId('dashboard-open-btn')
    await user.click(openBtn)
    expect(trackSpy).toHaveBeenCalledWith('plan_loaded_cloud', expect.any(Object))
  })

  it('confirming the export modal fires plan_exported_pdf', async () => {
    const trackSpy = vi.spyOn(analytics, 'track')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['%PDF'], { type: 'application/pdf' })),
    }))
    const { user } = setup()
    // Click the PDF export button to open the preview modal
    await user.click(screen.getByTestId('export-pdf-button'))
    // Confirm the export in the modal
    const confirmBtn = await screen.findByTestId('export-preview-confirm')
    await user.click(confirmBtn)
    expect(trackSpy).toHaveBeenCalledWith('plan_exported_pdf', expect.any(Object))
    vi.unstubAllGlobals()
  })
})

// ─── Session analytics ────────────────────────────────────────────────────────
describe('Session analytics', () => {
  it('fires app_session_started on mount', () => {
    const trackSpy = vi.spyOn(analytics, 'track')
    setup()
    expect(trackSpy).toHaveBeenCalledWith('app_session_started', expect.objectContaining({
      resumed_plan: expect.any(Boolean),
      object_count: expect.any(Number),
    }))
  })

  it('app_session_started reports resumed_plan: false for a fresh canvas', () => {
    localStorage.clear()
    const trackSpy = vi.spyOn(analytics, 'track')
    setup()
    expect(trackSpy).toHaveBeenCalledWith('app_session_started', expect.objectContaining({
      resumed_plan: false,
      object_count: 0,
    }))
  })

  it('fires app_session_ended with duration_seconds on beforeunload', () => {
    const trackSpy = vi.spyOn(analytics, 'track')
    setup()
    fireEvent(window, new Event('beforeunload'))
    expect(trackSpy).toHaveBeenCalledWith('app_session_ended', expect.objectContaining({
      duration_seconds: expect.any(Number),
      pdf_exported: expect.any(Boolean),
    }))
  })

  it('app_session_ended reports pdf_exported: false when no PDF was generated', () => {
    const trackSpy = vi.spyOn(analytics, 'track')
    setup()
    fireEvent(window, new Event('beforeunload'))
    const call = trackSpy.mock.calls.find(([event]) => event === 'app_session_ended')
    expect(call?.[1]).toMatchObject({ pdf_exported: false })
  })

  it('app_session_ended reports pdf_exported: true after a successful PDF export', async () => {
    const trackSpy = vi.spyOn(analytics, 'track')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['%PDF'], { type: 'application/pdf' })),
    }))
    const { user } = setup()
    await user.click(screen.getByTestId('export-pdf-button'))
    const confirmBtn = await screen.findByTestId('export-preview-confirm')
    await user.click(confirmBtn)
    fireEvent(window, new Event('beforeunload'))
    const call = trackSpy.mock.calls.find(([event]) => event === 'app_session_ended')
    expect(call?.[1]).toMatchObject({ pdf_exported: true })
    vi.unstubAllGlobals()
  })
})

// ─── Sign search ──────────────────────────────────────────────────────────────
describe('Sign search', () => {
  async function openSignLibrary(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /signs/i }))
    // Library tab is active by default
  }

  it('shows search input in sign library panel', async () => {
    const { user } = setup()
    await openSignLibrary(user)
    expect(screen.getByRole('textbox', { name: /search signs/i })).toBeInTheDocument()
  })

  it('searching by label filters signs', async () => {
    const { user } = setup()
    await openSignLibrary(user)
    const input = screen.getByRole('textbox', { name: /search signs/i })
    await user.type(input, 'stop')
    // STOP sign should appear in results
    expect(screen.getByText('STOP')).toBeInTheDocument()
    // Category headers should be gone (browse mode hidden)
    expect(screen.queryByText('Sign Category')).not.toBeInTheDocument()
  })

  it('searching by MUTCD code finds the correct sign', async () => {
    const { user } = setup()
    await openSignLibrary(user)
    await user.type(screen.getByRole('textbox', { name: /search signs/i }), 'R1-1')
    expect(screen.getByText('STOP')).toBeInTheDocument()
  })

  it('normalized MUTCD search (no hyphens) still matches', async () => {
    const { user } = setup()
    await openSignLibrary(user)
    await user.type(screen.getByRole('textbox', { name: /search signs/i }), 'R11')
    expect(screen.getByText('STOP')).toBeInTheDocument()
  })

  it('shows "No signs found" for a query with no matches', async () => {
    const { user } = setup()
    await openSignLibrary(user)
    await user.type(screen.getByRole('textbox', { name: /search signs/i }), 'xyznotasign999')
    expect(screen.getByText(/no signs found/i)).toBeInTheDocument()
  })

  it('clearing search restores the category browse UI', async () => {
    const { user } = setup()
    await openSignLibrary(user)
    const input = screen.getByRole('textbox', { name: /search signs/i })
    await user.type(input, 'stop')
    await user.clear(input)
    expect(screen.getByText('Sign Category')).toBeInTheDocument()
  })
})

// ─── Sign Editor ───────────────────────────────────────────────────────────────
describe('Sign Editor', () => {
  async function openEditor(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /signs/i }))
    await user.click(screen.getByRole('button', { name: /editor/i }))
  }

  // The text input in SignEditorPanel is the only one with placeholder "SIGN TEXT"
  function getEditorTextInput() {
    return screen.getByPlaceholderText('SIGN TEXT')
  }

  it('switching to the Editor tab shows shape picker and text input', async () => {
    const { user } = setup()
    await openEditor(user)
    expect(screen.getByRole('button', { name: /diamond/i })).toBeInTheDocument()
    expect(getEditorTextInput()).toBeInTheDocument()
  })

  it('clicking canvas without clicking Place places the editor sign (not library sign)', async () => {
    const { user } = setup()
    // Arm the sign tool via keyboard, place a STOP (library default) to establish baseline
    await user.click(screen.getByRole('button', { name: /signs/i }))
    fireEvent.keyDown(window, { key: 'S' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    expect(screen.getAllByTestId('legend-item-label').some(l => l.textContent === 'STOP')).toBe(true)

    // Switch to editor, change text — sign tool stays active via live-sync
    await openEditor(user)
    const textInput = getEditorTextInput()
    await user.clear(textInput)
    await user.type(textInput, 'ONE WAY')
    // Click canvas WITHOUT clicking Place — editor's sign should be placed
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))

    const labels = screen.getAllByTestId('legend-item-label').map(l => l.textContent)
    expect(labels).toContain('ONE WAY')
  })

  it('changing shape in editor updates the placed sign — legend SVG uses circle element', async () => {
    const { user } = setup()
    // Arm sign tool first
    fireEvent.keyDown(window, { key: 'S' })
    await openEditor(user)
    // Select circle shape — editor label stays "CUSTOM"
    await user.click(screen.getByRole('button', { name: /circle/i }))
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    // Label is present
    const labels = screen.getAllByTestId('legend-item-label').map(l => l.textContent)
    expect(labels).toContain('CUSTOM')
    // Legend SVG must contain a <circle> element (SignIconSvg renders one for circle shape)
    const legendBox = screen.getByTestId('legend-box')
    expect(legendBox.querySelector('circle')).toBeInTheDocument()
  })

  it('Place button activates sign tool so next canvas click places the editor sign', async () => {
    const { user } = setup()
    await openEditor(user)
    const textInput = getEditorTextInput()
    await user.clear(textInput)
    await user.type(textInput, 'DETOUR')
    await user.click(screen.getByRole('button', { name: /✓ place/i }))
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    const labels = screen.getAllByTestId('legend-item-label').map(l => l.textContent)
    expect(labels).toContain('DETOUR')
  })

  it('Save button adds the sign to the custom signs section in Library', async () => {
    const { user } = setup()
    await openEditor(user)
    const textInput = getEditorTextInput()
    await user.clear(textInput)
    await user.type(textInput, 'MY SIGN')
    await user.click(screen.getByRole('button', { name: /\+ save/i }))
    // Switch back to Library tab — the saved sign should appear under My Custom Signs
    await user.click(screen.getByRole('button', { name: /library/i }))
    expect(screen.getByText('MY SIGN')).toBeInTheDocument()
  })
})

// ─── New Beta Tools — Lane Mask, Crosswalk, Turn Lane, Shoulders ───────────────
describe('New Beta Tools — Lane Mask, Crosswalk, Turn Lane, Shoulders', () => {

  /** Helper: mock getPointerPosition to return start pos on first call, end pos on subsequent calls */
  function mockDragPositions() {
    let calls = 0
    vi.spyOn(stageStub, 'getPointerPosition').mockImplementation(() =>
      calls++ === 0 ? { x: 0, y: 0 } : { x: 100, y: 100 }
    )
  }

  // ── Lane Mask ────────────────────────────────────────────────────────────────

  it('pressing M activates the lane mask tool', () => {
    setup()
    fireEvent.keyDown(window, { key: 'M' })
    expect(screen.getByTestId('object-count').closest('div')?.textContent).toContain('Tool: LANE_MASK')
  })

  it('lane mask tool: mouseDown + mouseUp (drag) places a lane_mask object (count 0 → 1)', () => {
    mockDragPositions()
    setup()
    fireEvent.keyDown(window, { key: 'M' })
    const canvas = screen.getByTestId('konva-stage')
    fireEvent.mouseDown(canvas)
    fireEvent.mouseUp(canvas)
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
  })

  it('lane mask: undo after placing removes it (count back to 0)', async () => {
    mockDragPositions()
    const { user } = setup()
    fireEvent.keyDown(window, { key: 'M' })
    const canvas = screen.getByTestId('konva-stage')
    fireEvent.mouseDown(canvas)
    fireEvent.mouseUp(canvas)
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
    await user.click(screen.getByTestId('undo-button'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('0 objects')
  })

  it('lane mask: manifest shows "Lane Masks" count of 1 after placing one', async () => {
    mockDragPositions()
    const { user } = setup()
    fireEvent.keyDown(window, { key: 'M' })
    const canvas = screen.getByTestId('konva-stage')
    fireEvent.mouseDown(canvas)
    fireEvent.mouseUp(canvas)
    await user.click(screen.getByTestId('tab-manifest'))
    const panel = screen.getByTestId('manifest-panel')
    expect(within(panel).getByText('Lane Masks')).toBeInTheDocument()
    const row = within(panel).getByText('Lane Masks').closest('div') as HTMLElement
    expect(within(row).getByTestId('manifest-count')).toHaveTextContent('1')
  })

  it('lane mask: properties panel shows lane width range input when selected', () => {
    mockDragPositions()
    setup()
    fireEvent.keyDown(window, { key: 'M' })
    const canvas = screen.getByTestId('konva-stage')
    fireEvent.mouseDown(canvas)
    fireEvent.mouseUp(canvas)
    const panel = screen.getByTestId('right-panel')
    // The Lane Mask properties section includes a lane width range slider
    const laneWidthLabel = within(panel).getByText(/lane width/i)
    expect(laneWidthLabel).toBeInTheDocument()
    const rangeInput = laneWidthLabel.closest('label')?.querySelector('input[type="range"]')
    expect(rangeInput).toBeInTheDocument()
  })

  // ── Crosswalk ────────────────────────────────────────────────────────────────

  it('pressing C activates the crosswalk tool', () => {
    setup()
    fireEvent.keyDown(window, { key: 'C' })
    expect(screen.getByTestId('object-count').closest('div')?.textContent).toContain('Tool: CROSSWALK')
  })

  it('crosswalk tool: mouseDown + mouseUp (drag) places a crosswalk (count 0 → 1)', () => {
    mockDragPositions()
    setup()
    fireEvent.keyDown(window, { key: 'C' })
    const canvas = screen.getByTestId('konva-stage')
    fireEvent.mouseDown(canvas)
    fireEvent.mouseUp(canvas)
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
  })

  it('crosswalk: undo after placing removes it (count back to 0)', async () => {
    mockDragPositions()
    const { user } = setup()
    fireEvent.keyDown(window, { key: 'C' })
    const canvas = screen.getByTestId('konva-stage')
    fireEvent.mouseDown(canvas)
    fireEvent.mouseUp(canvas)
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
    await user.click(screen.getByTestId('undo-button'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('0 objects')
  })

  it('crosswalk: manifest shows "Crosswalks" count of 1 after placing one', async () => {
    mockDragPositions()
    const { user } = setup()
    fireEvent.keyDown(window, { key: 'C' })
    const canvas = screen.getByTestId('konva-stage')
    fireEvent.mouseDown(canvas)
    fireEvent.mouseUp(canvas)
    await user.click(screen.getByTestId('tab-manifest'))
    const panel = screen.getByTestId('manifest-panel')
    expect(within(panel).getByText('Crosswalks')).toBeInTheDocument()
    const row = within(panel).getByText('Crosswalks').closest('div') as HTMLElement
    expect(within(row).getByTestId('manifest-count')).toHaveTextContent('1')
  })

  // ── Turn Lane ────────────────────────────────────────────────────────────────

  it('pressing L activates the turn lane tool', () => {
    setup()
    fireEvent.keyDown(window, { key: 'L' })
    expect(screen.getByTestId('object-count').closest('div')?.textContent).toContain('Tool: TURN_LANE')
  })

  it('turn lane tool: mouseDown (click-to-place) places a turn_lane (count 0 → 1)', () => {
    setup()
    fireEvent.keyDown(window, { key: 'L' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
  })

  it('turn lane: undo after placing removes it (count back to 0)', async () => {
    const { user } = setup()
    fireEvent.keyDown(window, { key: 'L' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('1 objects')
    await user.click(screen.getByTestId('undo-button'))
    expect(screen.getByTestId('object-count')).toHaveTextContent('0 objects')
  })

  it('turn lane: manifest shows "Turn Lanes" count of 1 after placing one', async () => {
    const { user } = setup()
    fireEvent.keyDown(window, { key: 'L' })
    fireEvent.mouseDown(screen.getByTestId('konva-stage'))
    await user.click(screen.getByTestId('tab-manifest'))
    const panel = screen.getByTestId('manifest-panel')
    expect(within(panel).getByText('Turn Lanes')).toBeInTheDocument()
    const row = within(panel).getByText('Turn Lanes').closest('div') as HTMLElement
    expect(within(row).getByTestId('manifest-count')).toHaveTextContent('1')
  })

  // ── Road Shoulders (issue #18) ────────────────────────────────────────────────

  it('road shoulders: placing a straight road then selecting it shows Shoulder & Sidewalk section', () => {
    // Return different positions so the distance check (>5px) passes
    let calls = 0
    vi.spyOn(stageStub, 'getPointerPosition').mockImplementation(() =>
      calls++ === 0 ? { x: 0, y: 0 } : { x: 100, y: 100 }
    )
    setup()
    fireEvent.keyDown(window, { key: 'R' })
    const canvas = screen.getByTestId('konva-stage')
    fireEvent.mouseDown(canvas)
    fireEvent.mouseUp(canvas)
    // Road is auto-selected after placement
    const panel = screen.getByTestId('right-panel')
    expect(within(panel).getByText(/shoulder & sidewalk/i)).toBeInTheDocument()
  })

  it('road shoulders: shoulder width slider is present in properties when a road is selected', () => {
    let calls = 0
    vi.spyOn(stageStub, 'getPointerPosition').mockImplementation(() =>
      calls++ === 0 ? { x: 0, y: 0 } : { x: 100, y: 100 }
    )
    setup()
    fireEvent.keyDown(window, { key: 'R' })
    const canvas = screen.getByTestId('konva-stage')
    fireEvent.mouseDown(canvas)
    fireEvent.mouseUp(canvas)
    const panel = screen.getByTestId('right-panel')
    // The shoulder width range input should be present
    const shoulderLabel = within(panel).getByText(/shoulder width/i)
    expect(shoulderLabel).toBeInTheDocument()
    const rangeInput = shoulderLabel.closest('label')?.querySelector('input[type="range"]')
    expect(rangeInput).toBeInTheDocument()
  })
})

// ─── Help Modal ───────────────────────────────────────────────────────────────
describe('Help Modal', () => {
  it('clicking the ? Help button opens the help modal', async () => {
    const { user } = setup()
    expect(screen.queryByTestId('help-modal')).not.toBeInTheDocument()
    await user.click(screen.getByTestId('help-button'))
    expect(screen.getByTestId('help-modal')).toBeInTheDocument()
  })

  it('pressing ? toggles the help modal open', () => {
    setup()
    expect(screen.queryByTestId('help-modal')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: '?' })
    expect(screen.getByTestId('help-modal')).toBeInTheDocument()
  })

  it('pressing ? again closes the help modal', () => {
    setup()
    fireEvent.keyDown(window, { key: '?' })
    expect(screen.getByTestId('help-modal')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: '?' })
    expect(screen.queryByTestId('help-modal')).not.toBeInTheDocument()
  })

  it('clicking the backdrop closes the help modal', async () => {
    const { user } = setup()
    await user.click(screen.getByTestId('help-button'))
    expect(screen.getByTestId('help-modal')).toBeInTheDocument()
    await user.click(screen.getByTestId('help-modal'))
    expect(screen.queryByTestId('help-modal')).not.toBeInTheDocument()
  })

  it('clicking the close button dismisses the help modal', async () => {
    const { user } = setup()
    await user.click(screen.getByTestId('help-button'))
    expect(screen.getByTestId('help-modal')).toBeInTheDocument()
    await user.click(screen.getByTestId('help-modal-close'))
    expect(screen.queryByTestId('help-modal')).not.toBeInTheDocument()
  })

  it('help modal shows keyboard shortcuts section', async () => {
    const { user } = setup()
    await user.click(screen.getByTestId('help-button'))
    const modal = screen.getByTestId('help-modal')
    expect(within(modal).getAllByText(/keyboard shortcuts/i).length).toBeGreaterThan(0)
  })

  it('help modal shows tool guide section', async () => {
    const { user } = setup()
    await user.click(screen.getByTestId('help-button'))
    const modal = screen.getByTestId('help-modal')
    expect(within(modal).getAllByText(/tool guide/i).length).toBeGreaterThan(0)
  })

  it('help modal lists all tools', async () => {
    const { user } = setup()
    await user.click(screen.getByTestId('help-button'))
    const modal = screen.getByTestId('help-modal')
    expect(within(modal).getByText('Road')).toBeInTheDocument()
    expect(within(modal).getByText('Taper')).toBeInTheDocument()
    expect(within(modal).getByText('Lane Mask')).toBeInTheDocument()
    expect(within(modal).getByText('Crosswalk')).toBeInTheDocument()
    expect(within(modal).getByText('Turn Lane')).toBeInTheDocument()
  })
})
