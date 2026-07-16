import { PrismaClient } from './generated/prisma/client.js'

import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
})

declare global {
  var __prisma: PrismaClient | undefined
}

// Under Vitest each test file gets an isolated module registry; reusing a
// client instance across registries leaves Prisma 7 model delegates partially
// broken (e.g. `.create` undefined on one model). Fresh instance per registry
// there; HMR memoization everywhere else.
export const prisma =
  (!process.env.VITEST && globalThis.__prisma) || new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production' && !process.env.VITEST) {
  globalThis.__prisma = prisma
}
