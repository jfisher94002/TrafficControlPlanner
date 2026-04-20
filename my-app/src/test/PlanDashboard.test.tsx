import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PlanDashboard from '../PlanDashboard'
import * as planStorage from '../planStorage'
import type { CloudPlanMeta } from '../planStorage'

const mockPlan: CloudPlanMeta = {
  path: 'plans/user-1/plan-abc.tcp.json',
  planId: 'plan-abc',
  name: 'plan-abc',
  lastModified: '2026-01-01T00:00:00.000Z',
  size: 512,
}

const CANVAS_SIZE = { w: 800, h: 600 }

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('PlanDashboard', () => {
  it('shows loading state then empty message when no plans exist', async () => {
    vi.spyOn(planStorage, 'listCloudPlans').mockResolvedValue([])
    render(<PlanDashboard userId="user-1" canvasSize={CANVAS_SIZE} onOpen={vi.fn()} onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByTestId('dashboard-empty')).toBeInTheDocument())
  })

  it('renders a plan row after listing returns one plan', async () => {
    vi.spyOn(planStorage, 'listCloudPlans').mockResolvedValue([mockPlan])
    render(<PlanDashboard userId="user-1" canvasSize={CANVAS_SIZE} onOpen={vi.fn()} onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByTestId('dashboard-plan-row')).toBeInTheDocument())
  })

  it('clicking Open calls loadPlanFromCloud and then onOpen with the result', async () => {
    const planData = { id: 'plan-abc', name: 'My Plan', canvasState: { objects: [] } }
    vi.spyOn(planStorage, 'listCloudPlans').mockResolvedValue([mockPlan])
    vi.spyOn(planStorage, 'loadPlanFromCloud').mockResolvedValue(planData)
    const onOpen = vi.fn()
    const user = userEvent.setup()
    render(<PlanDashboard userId="user-1" canvasSize={CANVAS_SIZE} onOpen={onOpen} onClose={vi.fn()} />)
    await waitFor(() => screen.getByTestId('dashboard-open-btn'))
    await user.click(screen.getByTestId('dashboard-open-btn'))
    await waitFor(() => expect(planStorage.loadPlanFromCloud).toHaveBeenCalledWith(mockPlan.path, CANVAS_SIZE))
    expect(onOpen).toHaveBeenCalledWith(planData)
  })

  it('shows error when loadPlanFromCloud fails', async () => {
    vi.spyOn(planStorage, 'listCloudPlans').mockResolvedValue([mockPlan])
    vi.spyOn(planStorage, 'loadPlanFromCloud').mockRejectedValue(new Error('S3 error'))
    const user = userEvent.setup()
    render(<PlanDashboard userId="user-1" canvasSize={CANVAS_SIZE} onOpen={vi.fn()} onClose={vi.fn()} />)
    await waitFor(() => screen.getByTestId('dashboard-open-btn'))
    await user.click(screen.getByTestId('dashboard-open-btn'))
    await waitFor(() =>
      expect(screen.getByTestId('dashboard-error')).toHaveTextContent('S3 error')
    )
  })

  it('clicking Delete calls deletePlanFromCloud and removes the row', async () => {
    vi.spyOn(planStorage, 'listCloudPlans').mockResolvedValue([mockPlan])
    vi.spyOn(planStorage, 'deletePlanFromCloud').mockResolvedValue()
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<PlanDashboard userId="user-1" canvasSize={CANVAS_SIZE} onOpen={vi.fn()} onClose={vi.fn()} />)
    await waitFor(() => screen.getByTestId('dashboard-delete-btn'))
    await user.click(screen.getByTestId('dashboard-delete-btn'))
    await waitFor(() => expect(planStorage.deletePlanFromCloud).toHaveBeenCalledWith(mockPlan.path))
    expect(screen.queryByTestId('dashboard-plan-row')).not.toBeInTheDocument()
  })

  it('does not delete when user cancels the confirm dialog', async () => {
    vi.spyOn(planStorage, 'listCloudPlans').mockResolvedValue([mockPlan])
    const deleteSpy = vi.spyOn(planStorage, 'deletePlanFromCloud').mockResolvedValue()
    vi.spyOn(globalThis, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(<PlanDashboard userId="user-1" canvasSize={CANVAS_SIZE} onOpen={vi.fn()} onClose={vi.fn()} />)
    await waitFor(() => screen.getByTestId('dashboard-delete-btn'))
    await user.click(screen.getByTestId('dashboard-delete-btn'))
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(screen.getByTestId('dashboard-plan-row')).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', async () => {
    vi.spyOn(planStorage, 'listCloudPlans').mockResolvedValue([])
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<PlanDashboard userId="user-1" canvasSize={CANVAS_SIZE} onOpen={vi.fn()} onClose={onClose} />)
    await user.click(screen.getByTestId('dashboard-close'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when clicking outside the modal', async () => {
    vi.spyOn(planStorage, 'listCloudPlans').mockResolvedValue([])
    const onClose = vi.fn()
    render(<PlanDashboard userId="user-1" canvasSize={CANVAS_SIZE} onOpen={vi.fn()} onClose={onClose} />)
    await waitFor(() => screen.getByTestId('plan-dashboard-overlay'))
    fireEvent.click(screen.getByTestId('plan-dashboard-overlay'))
    expect(onClose).toHaveBeenCalled()
  })
})
