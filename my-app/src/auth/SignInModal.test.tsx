import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

const { mockSignUp, mockAuthenticatorRender } = vi.hoisted(() => ({
  mockSignUp: vi.fn().mockResolvedValue({ isSignUpComplete: true, userId: 'u-1', nextStep: { signUpStep: 'DONE' } }),
  mockAuthenticatorRender: vi.fn(),
}))

vi.mock('aws-amplify/auth', () => ({
  signUp: mockSignUp,
}))

vi.mock('./AuthHeader', () => ({
  AuthHeader: () => <div data-testid="auth-header" />,
}))

vi.mock('@aws-amplify/ui-react', () => ({
  Authenticator: (props: {
    children: () => React.ReactNode
    loginMechanisms?: string[]
    services?: { handleSignUp?: (input: Record<string, unknown>) => Promise<unknown> }
    formFields?: Record<string, unknown>
  }) => {
    mockAuthenticatorRender(props)
    return <div data-testid="authenticator">{props.children?.()}</div>
  },
}))

import { SignInModal } from './SignInModal'

describe('SignInModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not render when open is false', () => {
    render(<SignInModal open={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders dialog and focuses it when opened', async () => {
    render(<SignInModal open={true} onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog', { name: /sign in to export your plan as pdf/i })
    await waitFor(() => expect(document.activeElement).toBe(dialog))
  })

  it('closes when clicking backdrop or pressing Escape', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<SignInModal open={true} onClose={onClose} />)

    await user.click(screen.getByRole('presentation'))
    expect(onClose).toHaveBeenCalledTimes(1)

    const dialog = screen.getByRole('dialog')
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(dialog).toBeInTheDocument()
  })

  it('does not close when clicking inside dialog content', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<SignInModal open={true} onClose={onClose} />)

    await user.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('passes email login and sign-up service that injects name', async () => {
    render(<SignInModal open={true} onClose={vi.fn()} />)
    const authProps = mockAuthenticatorRender.mock.calls[0][0] as {
      loginMechanisms?: string[]
      services?: { handleSignUp?: (input: { options?: { userAttributes?: Record<string, string> } }) => Promise<unknown> }
      formFields?: { signUp?: { name?: { isRequired?: boolean } } }
    }

    expect(authProps.loginMechanisms).toEqual(['email'])
    expect(authProps.formFields?.signUp?.name?.isRequired).toBe(true)

    await authProps.services?.handleSignUp?.({
      options: { userAttributes: { email: 'user@example.com' } },
    })
    expect(mockSignUp).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({
        userAttributes: expect.objectContaining({
          email: 'user@example.com',
          name: '',
        }),
      }),
    }))
  })
})
