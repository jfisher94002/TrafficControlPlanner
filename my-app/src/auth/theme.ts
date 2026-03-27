import { createTheme } from '@aws-amplify/ui-react'

export const authTheme = createTheme({
  name: 'tcp-dark',
  tokens: {
    colors: {
      background: {
        primary:   { value: '#0f1117' },
        secondary: { value: '#1a1d27' },
      },
      font: {
        primary:    { value: '#e2e8f0' },
        secondary:  { value: '#94a3b8' },
        interactive:{ value: '#f59e0b' },
        error:      { value: '#fca5a5' },  // red-300 — readable on dark background
      },
      border: {
        primary:   { value: '#2a2d3a' },
        secondary: { value: '#2a2d3a' },
        focus:     { value: '#f59e0b' },
        error:     { value: '#f87171' },  // red-400 — visible but not harsh on dark bg
      },
      brand: {
        primary: {
          '10':  { value: 'rgba(245,158,11,0.10)' },
          '20':  { value: 'rgba(245,158,11,0.20)' },
          '40':  { value: 'rgba(245,158,11,0.40)' },
          '60':  { value: '#d97706' },
          '80':  { value: '#f59e0b' },
          '90':  { value: '#fbbf24' },
          '100': { value: '#fde68a' },
        },
      },
    },
    components: {
      authenticator: {
        router: {
          borderWidth:     { value: '1px' },
          borderStyle:     { value: 'solid' },
          borderColor:     { value: '#2a2d3a' },
          backgroundColor: { value: '#1a1d27' },
          boxShadow:       { value: '0 8px 40px rgba(0,0,0,0.6)' },
        },
      },
    },
  },
})
