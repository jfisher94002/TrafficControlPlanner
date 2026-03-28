import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TemplatePicker from '../TemplatePicker'
import { TEMPLATES } from '../templates'

describe('TemplatePicker', () => {
  it('renders all template cards', () => {
    render(<TemplatePicker onApply={vi.fn()} onClose={vi.fn()} />)
    TEMPLATES.forEach(tpl => {
      expect(screen.getByText(tpl.name)).toBeInTheDocument()
    })
  })

  it('closes when overlay is clicked', async () => {
    const onClose = vi.fn()
    render(<TemplatePicker onApply={vi.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('template-picker-overlay'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes on Escape key', async () => {
    const onClose = vi.fn()
    render(<TemplatePicker onApply={vi.fn()} onClose={onClose} />)
    fireEvent.keyDown(screen.getByTestId('template-picker'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onApply with re-stamped object IDs in replace mode', async () => {
    const onApply = vi.fn()
    const user = userEvent.setup()
    render(<TemplatePicker onApply={onApply} onClose={vi.fn()} />)

    // Default mode is replace — click the first template
    await user.click(screen.getByTestId(`template-use-btn-${TEMPLATES[0].id}`))

    expect(onApply).toHaveBeenCalledOnce()
    const [appliedObjects, mode] = onApply.mock.calls[0]
    expect(mode).toBe('replace')
    expect(appliedObjects).toHaveLength(TEMPLATES[0].objects.length)

    // IDs must be re-stamped (different from the static template IDs)
    const templateIds = new Set(TEMPLATES[0].objects.map(o => o.id))
    appliedObjects.forEach((o: { id: string }) => {
      expect(templateIds.has(o.id)).toBe(false)
    })
  })

  it('calls onApply with merge mode when merge is selected', async () => {
    const onApply = vi.fn()
    const user = userEvent.setup()
    render(<TemplatePicker onApply={onApply} onClose={vi.fn()} />)

    await user.click(screen.getByText('Merge'))
    await user.click(screen.getByTestId(`template-use-btn-${TEMPLATES[0].id}`))

    const [, mode] = onApply.mock.calls[0]
    expect(mode).toBe('merge')
  })

  it('deep-clones nested signData so template is not mutated', async () => {
    const onApply = vi.fn()
    const user = userEvent.setup()
    render(<TemplatePicker onApply={onApply} onClose={vi.fn()} />)

    await user.click(screen.getByTestId(`template-use-btn-${TEMPLATES[0].id}`))

    const [appliedObjects] = onApply.mock.calls[0]
    const signObj = appliedObjects.find((o: { type: string }) => o.type === 'sign')
    if (signObj) {
      const originalSign = TEMPLATES[0].objects.find(o => o.type === 'sign') as { signData: object }
      expect(signObj.signData).not.toBe(originalSign.signData)
    }
  })
})
