import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify('test'),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: { provider: 'v8', reporter: ['text', 'lcov'] },
    env: { VITE_S3_BUCKET: 'test-bucket', VITE_COGNITO_IDENTITY_POOL_ID: 'us-west-1:00000000-0000-0000-0000-000000000000' },
  },
})
