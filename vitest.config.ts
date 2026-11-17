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
          // Vitest 4+ spelling of the old forks.singleFork: every file runs
          // in one process, one after another, against the shared test DB.
          maxWorkers: 1,
          isolate: false,
          // Projects with different maxWorkers need their own group; this
          // one runs after the unit tests.
          sequence: { groupOrder: 1 },
          globalSetup: ['./tests/integration/helpers/globalSetup.ts'],
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
})
