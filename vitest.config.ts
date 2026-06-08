import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  root: '.',
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
