import { useEffect, useRef } from 'react'
import { signUp } from 'aws-amplify/auth'
import { Authenticator } from '@aws-amplify/ui-react'
import { AuthHeader } from './AuthHeader'

const authServices = {
  async handleSignUp(input: Parameters<typeof signUp>[0]) {
    const attrs = (input.options?.userAttributes ?? {}) as Record<string, string>
    const name = attrs['name'] ?? ''
    return signUp({
      ...input,
      options: { ...input.options, userAttributes: { ...attrs, name } },
    })
  },
}

const formFields = {
  signUp: {
    name:             { label: 'Full Name', placeholder: 'Enter your full name', isRequired: true, order: 1 },
    email:            { order: 2 },
    password:         { order: 3 },
    confirm_password: { order: 4 },
  },
}

interface SignInModalProps {
  open: boolean
  onClose: () => void
}

export function SignInModal({ open, onClose }: SignInModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // Focus the dialog on open
  useEffect(() => {
    if (open) dialogRef.current?.focus()
  }, [open])

  if (!open) return null

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
        zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Sign in to export your plan as PDF"
        tabIndex={-1}
        style={{ position: 'relative', outline: 'none' }}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Escape') onClose() }}
      >
        <button
          onClick={onClose}
          aria-label="Close sign-in"
          style={{
            position: 'absolute', top: -36, right: 0,
            background: 'none', border: 'none', color: '#94a3b8',
            cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
          }}
        >
          ✕ Close
        </button>
        <p style={{
          textAlign: 'center', fontSize: 12, color: '#94a3b8',
          marginBottom: 12, fontFamily: "'JetBrains Mono', monospace",
        }}>
          Sign in to export your plan as PDF
        </p>
        <Authenticator
          loginMechanisms={['email']}
          components={{ Header: AuthHeader }}
          services={authServices}
          formFields={formFields}
        >
          {() => <></>}
        </Authenticator>
      </div>
    </div>
  )
}
