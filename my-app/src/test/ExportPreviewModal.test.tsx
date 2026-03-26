import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExportPreviewModal from '../ExportPreviewModal'
import type { QCIssue } from '../qcRules'

const defaultProps = {
  canvasDataUrl: 'data:image/png;base64,abc123',
  planTitle: 'Test Plan',
  planMeta: { projectNumber: 'P-001', client: 'ACME', location: 'Main St', notes: '' },
  planCreatedAt: '2026-03-01T00:00:00.000Z',
  qcIssues: [] as QCIssue[],
  onConfirm: vi.fn(),
  onClose: vi.fn(),
}

describe('ExportPreviewModal', () => {
  it('renders the plan title in the title block', () => {
    render(<ExportPreviewModal {...defaultProps} />)
    expect(screen.getByText('Test Plan')).toBeInTheDocument()
  })

  it('renders plan metadata in the title block', () => {
    render(<ExportPreviewModal {...defaultProps} />)
    expect(screen.getByText('ACME')).toBeInTheDocument()
    expect(screen.getByText('Main St')).toBeInTheDocument()
    expect(screen.getByText('P-001')).toBeInTheDocument()
  })

  it('shows canvas image preview', () => {
    render(<ExportPreviewModal {...defaultProps} />)
    const img = screen.getByTestId('export-preview-image') as HTMLImageElement
    expect(img.src).toContain('data:image/png;base64,abc123')
  })

  it('shows QC pass message when no issues', () => {
    render(<ExportPreviewModal {...defaultProps} qcIssues={[]} />)
    expect(screen.getByText(/No issues/)).toBeInTheDocument()
  })

  it('shows QC errors and warnings', () => {
    const issues: QCIssue[] = [
      { id: 'e1', severity: 'error', message: 'Taper too short' },
      { id: 'w1', severity: 'warning', message: 'No advance warning signs' },
    ]
    render(<ExportPreviewModal {...defaultProps} qcIssues={issues} />)
    expect(screen.getByText('Taper too short')).toBeInTheDocument()
    expect(screen.getByText('No advance warning signs')).toBeInTheDocument()
    expect(screen.getByText(/1 error/)).toBeInTheDocument()
    expect(screen.getByText(/1 warning/)).toBeInTheDocument()
  })

  it('closes when overlay is clicked', () => {
    const onClose = vi.fn()
    render(<ExportPreviewModal {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('export-preview-overlay'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes on Escape key', () => {
    const onClose = vi.fn()
    render(<ExportPreviewModal {...defaultProps} onClose={onClose} />)
    fireEvent.keyDown(screen.getByTestId('export-preview-modal'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onConfirm and onClose when Export PDF is clicked', async () => {
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<ExportPreviewModal {...defaultProps} onConfirm={onConfirm} onClose={onClose} />)
    await user.click(screen.getByTestId('export-preview-confirm'))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows error warning message when errors are present', () => {
    const issues: QCIssue[] = [{ id: 'e1', severity: 'error', message: 'Taper too short' }]
    render(<ExportPreviewModal {...defaultProps} qcIssues={issues} />)
    expect(screen.getByText(/Plan has errors/)).toBeInTheDocument()
  })
})
