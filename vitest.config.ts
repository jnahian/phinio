import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const alias = {
  '#': resolve(__dirname, 'src'),
  '@': resolve(__dirname, 'src'),
}

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        extends: true,
        resolve: { alias },
        test: {
          name: 'unit',
          include: ['tests/lib/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        resolve: { alias },
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          pool: 'forks',
          poolOptions: { forks: { singleFork: true } },
          fileParallelism: false,
          globalSetup: ['./tests/integration/helpers/globalSetup.ts'],
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
})
