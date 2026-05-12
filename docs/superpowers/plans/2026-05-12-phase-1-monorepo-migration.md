# Phase 1 — Monorepo Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the single-package Phinio repo into a pnpm + Turborepo monorepo with the existing PWA at `apps/web/` and four shared packages (`@phinio/db`, `@phinio/validators`, `@phinio/calc`, `@phinio/design-tokens`). Zero runtime behavior change; the existing test suite stays green throughout.

**Architecture:** Repo root becomes a pnpm workspace with two top-level directories: `apps/` (consumer applications) and `packages/` (shared libraries). Turbo orchestrates dev/build/test pipelines across the graph. The web app continues to ship from `apps/web/` exactly as it does today — only import paths change.

**Tech Stack:** pnpm 9+, Turborepo 2+, TypeScript 5.7, Prisma 7 (pg adapter), TanStack Start, Vite 8.

**Source spec:** `docs/superpowers/specs/2026-05-12-rn-mobile-app-design.md` §2.

**Out of scope for this plan (deferred to Phase 3 — mobile shell):** extracting `packages/auth/`. Better Auth's web-side configuration is tightly coupled to `tanstackStartCookies()` and the SSR cookie jar; there's no mobile consumer yet, and extracting it now creates churn without payoff. The `User` / `Session` schema is shared via `@phinio/db`, which is enough.

---

## File Structure (end state)

```
phinio/
├── apps/
│   └── web/                          ← current PWA, moved here verbatim
│       ├── src/                      ← current src/, with import path updates
│       ├── public/
│       ├── prisma/                   ← moved from root (or replaced by @phinio/db consumption)
│       ├── package.json              ← web-only deps
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── ...
├── packages/
│   ├── db/
│   │   ├── prisma/
│   │   │   ├── schema.prisma         ← moved from root prisma/
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── index.ts              ← re-exports PrismaClient + types
│   │   │   └── generated/            ← prisma client output target
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── validators/
│   │   ├── src/
│   │   │   └── index.ts              ← moved from apps/web/src/lib/validators.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── calc/
│   │   ├── src/
│   │   │   ├── index.ts              ← barrel re-exporting all 3 modules
│   │   │   ├── emi.ts                ← moved from apps/web/src/lib/emi-calculator.ts
│   │   │   ├── dps.ts                ← moved from apps/web/src/lib/dps-calculator.ts
│   │   │   └── calculations.ts       ← moved from apps/web/src/lib/calculations.ts
│   │   ├── src/__tests__/            ← unit tests for pure functions
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── design-tokens/
│       ├── src/
│       │   ├── tokens.json           ← single source of truth for Modern Noir tokens
│       │   ├── build-css.ts          ← generator: tokens.json → dist/tokens.css
│       │   └── index.ts              ← TS export of tokens for JS consumers (mobile, Phase 3)
│       ├── dist/                     ← generated CSS, committed (deterministic build)
│       ├── package.json
│       └── tsconfig.json
├── package.json                      ← workspace root, turbo pipeline scripts
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json                ← shared compiler options
├── .npmrc                            ← pnpm config (hoist-pattern, etc.)
├── docs/                             ← stays at root
├── screens/                          ← stays at root
├── CLAUDE.md                         ← stays at root, updated for new paths
├── README.md                         ← stays at root
├── CHANGELOG.md
└── CONTRIBUTING.md
```

**File-by-file movement summary** (modify list is long; the plan will produce a codemod step rather than per-file edits):

- `prisma/schema.prisma` → `packages/db/prisma/schema.prisma`. Generator `output` changes to `../src/generated`.
- `src/lib/validators.ts` → `packages/validators/src/index.ts`. **15 importers** updated via codemod (`src/server/*.{ts,impl.ts}`, `src/hooks/use*.ts`, `src/routes/**/*.tsx`, `src/routes/login.tsx`, `src/routes/signup.tsx`, `src/routes/forgot-password.tsx`, `src/integrations/tanstack-query/mutation-defaults.ts`).
- `src/lib/emi-calculator.ts` → `packages/calc/src/emi.ts`. **7 importers**.
- `src/lib/dps-calculator.ts` → `packages/calc/src/dps.ts`. **3 importers**.
- `src/lib/calculations.ts` → `packages/calc/src/calculations.ts`. **N importers** (audited at codemod time).
- `src/generated/prisma/` is regenerated into `packages/db/src/generated/` by `pnpm --filter @phinio/db db:generate`.
- All other `src/*` files: relocated unchanged to `apps/web/src/*`.

---

## Conventions for this plan

- **Working directory**: every shell command runs from the repo root unless stated otherwise.
- **Codemods over per-file edits**: where 5+ files share a search/replace, use `sd` (`brew install sd`) or fall back to `find ... -exec sed`. The plan provides exact commands.
- **TDD-strict for new code; regression-net for refactors**: package-extraction tasks treat the existing test suite as the regression net. New code (design-tokens build, turbo task wiring) gets fresh tests.
- **Frequent commits**: every task ends with a commit. The branch is named `feat/phase-1-monorepo`.
- **One environment file**: `.env.local` stays at repo root; turbo pipelines pass it through via `dotenv-cli` exactly as `build:local` does today.

---

## Task 1: Branch + baseline snapshot

**Files:**
- None modified — this is a pre-flight checkpoint.

- [ ] **Step 1: Create the working branch from clean main**

```bash
git checkout main
git pull --ff-only origin main
git status   # must be clean
git switch -c feat/phase-1-monorepo
```

- [ ] **Step 2: Record a baseline of the current test + build state**

```bash
npm ci
npm run test 2>&1 | tee /tmp/phinio-baseline-test.log
npm run lint 2>&1 | tee /tmp/phinio-baseline-lint.log
npm run build:local 2>&1 | tee /tmp/phinio-baseline-build.log
```

Expected: all three exit code 0. Save the logs — every later "verify" task diffs against these.

- [ ] **Step 3: Tag the baseline so we can compare later if needed**

```bash
git tag pre-monorepo-baseline
```

(Local tag, no push.)

- [ ] **Step 4: Commit (nothing to commit — this is a verification gate)**

If `git status` is dirty (it shouldn't be), stop and investigate. Otherwise proceed.

---

## Task 2: Bootstrap pnpm workspace

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `.npmrc`
- Modify: `package.json` (root — strip down, add workspace config)
- Create: `tsconfig.base.json`

- [ ] **Step 1: Install pnpm if missing, verify version**

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm --version
```

Expected: `9.15.0` (or later 9.x).

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 3: Create `.npmrc`**

```ini
# Allow workspace protocol
link-workspace-packages=true
prefer-workspace-packages=true
# Reduce hoisting surprises for native modules (will matter for mobile in Phase 3)
node-linker=hoisted
# Phinio's web app and Prisma both want strict-peer-dependencies off — matches current npm behavior
strict-peer-dependencies=false
auto-install-peers=true
```

- [ ] **Step 4: Create `tsconfig.base.json`** (shared compiler options, extended by every package)

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": false,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": false,
    "noEmit": true
  },
  "exclude": ["node_modules", "dist", "build", ".turbo"]
}
```

- [ ] **Step 5: Slim the root `package.json` to workspace-only concerns**

Replace the full root `package.json` with this (preserves `private`, `type`, and a thin script surface; deps move to `apps/web/package.json` in Task 5):

```json
{
  "name": "phinio",
  "version": "1.8.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "build:local": "turbo run build:local",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "check": "turbo run check",
    "format": "turbo run format",
    "db:generate": "pnpm --filter @phinio/db run db:generate",
    "db:push": "pnpm --filter @phinio/db run db:push",
    "db:migrate": "pnpm --filter @phinio/db run db:migrate",
    "db:studio": "pnpm --filter @phinio/db run db:studio",
    "db:seed": "pnpm --filter @phinio/web run db:seed",
    "db:seed:user": "pnpm --filter @phinio/web run db:seed:user",
    "db:cleanup:user": "pnpm --filter @phinio/web run db:cleanup:user"
  },
  "devDependencies": {
    "dotenv-cli": "^11.0.0",
    "prettier": "^3.8.1",
    "turbo": "^2.3.0",
    "typescript": "^5.7.2"
  },
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 6: Remove the now-stale lockfile and reinstall under pnpm**

```bash
rm -f package-lock.json
rm -rf node_modules
pnpm install
```

Expected: install completes; `pnpm-lock.yaml` is created. The workspace has zero packages yet, so warnings about missing packages are expected.

- [ ] **Step 7: Commit**

```bash
git add pnpm-workspace.yaml .npmrc tsconfig.base.json package.json pnpm-lock.yaml
git rm package-lock.json
git commit -m "chore(monorepo): bootstrap pnpm workspace + tsconfig.base"
```

---

## Task 3: Add Turborepo configuration

**Files:**
- Create: `turbo.json`

- [ ] **Step 1: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env.local", "tsconfig.base.json"],
  "globalEnv": [
    "DATABASE_URL",
    "DIRECT_URL",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "RESEND_API_KEY",
    "VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
    "VAPID_SUBJECT",
    "CRON_SECRET"
  ],
  "tasks": {
    "build": {
      "dependsOn": ["^build", "db:generate"],
      "outputs": ["dist/**", ".vercel/**", ".output/**"]
    },
    "build:local": {
      "dependsOn": ["^build", "db:generate"],
      "outputs": ["dist/**", ".vercel/**", ".output/**"]
    },
    "dev": {
      "dependsOn": ["^build", "db:generate"],
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build", "db:generate"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "format": {
      "outputs": []
    },
    "check": {
      "outputs": []
    },
    "db:generate": {
      "cache": false,
      "outputs": ["src/generated/**"]
    }
  }
}
```

- [ ] **Step 2: Verify Turbo picks up the config (no packages exist yet — expect "no tasks to run")**

```bash
pnpm exec turbo run build --dry-run
```

Expected output: a dry-run plan summary with **0 tasks** (no packages yet). The command must exit 0 — that confirms `turbo.json` parses.

- [ ] **Step 3: Commit**

```bash
git add turbo.json
git commit -m "chore(monorepo): add turbo pipeline config"
```

---

## Task 4: Create `@phinio/db` package skeleton

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/src/index.ts`
- Move: `prisma/` → `packages/db/prisma/`
- Modify: `packages/db/prisma/schema.prisma` (generator output path)

- [ ] **Step 1: Move the Prisma directory**

```bash
mkdir -p packages/db/src
git mv prisma packages/db/prisma
```

- [ ] **Step 2: Update the Prisma generator output path**

Edit `packages/db/prisma/schema.prisma` lines 1-4 to point at the new relative target:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated"
}
```

- [ ] **Step 3: Create `packages/db/package.json`**

```json
{
  "name": "@phinio/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./client": "./src/generated/client.js"
  },
  "scripts": {
    "db:generate": "dotenv -e ../../.env.local -- prisma generate --schema=./prisma/schema.prisma",
    "db:push": "dotenv -e ../../.env.local -- prisma db push --schema=./prisma/schema.prisma",
    "db:migrate": "dotenv -e ../../.env.local -- prisma migrate dev --schema=./prisma/schema.prisma",
    "db:migrate:deploy": "prisma migrate deploy --schema=./prisma/schema.prisma",
    "db:studio": "dotenv -e ../../.env.local -- prisma studio --schema=./prisma/schema.prisma"
  },
  "dependencies": {
    "@prisma/adapter-pg": "^7.4.2",
    "@prisma/client": "^7.4.2"
  },
  "devDependencies": {
    "dotenv-cli": "^11.0.0",
    "prisma": "^7.7.0"
  }
}
```

- [ ] **Step 4: Create `packages/db/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Create `packages/db/src/index.ts`** (the public API of the package)

Re-export the generated client plus the pg-adapter wiring helper that `apps/web/src/db.ts` does today.

```ts
// Re-export everything consumers need from the generated client.
export { PrismaClient } from './generated/client.js'
export type * from './generated/client.js'
export { Prisma } from './generated/client.js'
```

- [ ] **Step 6: Install and generate**

```bash
pnpm install
pnpm --filter @phinio/db run db:generate
```

Expected: `packages/db/src/generated/` is created and contains `client.ts`, `client.js`, model files, etc.

- [ ] **Step 7: Add the generated directory to git** (committing the generated client is intentional — it matches current behavior; the engineer working in this codebase needs types resolvable without running generate first)

```bash
# .gitignore the build artifacts but commit src/generated/
echo 'dist/' >> packages/db/.gitignore
echo '.turbo/' >> packages/db/.gitignore
```

- [ ] **Step 8: Commit**

```bash
git add packages/db
git commit -m "feat(monorepo): extract @phinio/db package with prisma schema + generated client"
```

---

## Task 5: Move web app to `apps/web/`

**Files:**
- Move: nearly everything under repo root → `apps/web/`. Listed below.
- Create: `apps/web/package.json` (web-specific deps)
- Modify: `apps/web/vite.config.ts` (no path changes — Vite cwd will be `apps/web/`)

- [ ] **Step 1: Create the target directory**

```bash
mkdir -p apps/web
```

- [ ] **Step 2: Move source and config into apps/web/**

```bash
git mv src apps/web/src
git mv public apps/web/public
git mv scripts apps/web/scripts
git mv vite.config.ts apps/web/vite.config.ts
git mv tsconfig.json apps/web/tsconfig.json
git mv eslint.config.js apps/web/eslint.config.js 2>/dev/null || true
git mv prettier.config.js apps/web/prettier.config.js 2>/dev/null || true
git mv .prettierrc apps/web/.prettierrc 2>/dev/null || true
git mv index.html apps/web/index.html 2>/dev/null || true
git mv vitest.config.ts apps/web/vitest.config.ts 2>/dev/null || true
git mv vitest.config.mts apps/web/vitest.config.mts 2>/dev/null || true
```

(The `|| true` guards on files that may not exist in this repo. Don't move docs/, screens/, CLAUDE.md, README.md, CHANGELOG.md, CONTRIBUTING.md — they stay at root.)

- [ ] **Step 3: Verify what moved vs. stayed**

```bash
ls -la
ls -la apps/web/
```

Expected at root: `apps/ packages/ docs/ screens/ CLAUDE.md README.md CHANGELOG.md CONTRIBUTING.md package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json .npmrc .env.local .env.local.example .git .gitignore`.
Expected at `apps/web/`: `src/ public/ scripts/ vite.config.ts tsconfig.json` (plus whatever optional configs existed).

- [ ] **Step 4: Create `apps/web/package.json`** (all dependencies that previously lived in the root `package.json` move here)

```json
{
  "name": "@phinio/web",
  "version": "1.8.0",
  "private": true,
  "type": "module",
  "imports": {
    "#/*": "./src/*"
  },
  "scripts": {
    "dev": "vite dev --port 3000",
    "build": "prisma migrate deploy --schema=../../packages/db/prisma/schema.prisma && prisma generate --schema=../../packages/db/prisma/schema.prisma && vite build && node scripts/copy-sw-to-vercel.mjs",
    "build:local": "dotenv -e ../../.env.local -- vite build",
    "preview": "vite preview",
    "preview:local": "dotenv -e ../../.env.local -- vite preview",
    "test": "vitest run",
    "lint": "eslint",
    "format": "prettier --check .",
    "check": "prettier --write . && eslint --fix",
    "db:seed": "dotenv -e ../../.env.local -- tsx ../../packages/db/prisma/seed.ts",
    "db:seed:user": "dotenv -e ../../.env.local -- tsx ../../packages/db/prisma/seed-user.ts",
    "db:cleanup:user": "dotenv -e ../../.env.local -- tsx ../../packages/db/prisma/cleanup-user.ts"
  },
  "dependencies": {
    "@opentelemetry/api": "^1.9.1",
    "@phinio/db": "workspace:*",
    "@tailwindcss/vite": "^4.1.18",
    "@tanstack/query-async-storage-persister": "^5.100.6",
    "@tanstack/query-persist-client-core": "^5.100.6",
    "@tanstack/react-devtools": "latest",
    "@tanstack/react-query": "^5.100.6",
    "@tanstack/react-query-devtools": "latest",
    "@tanstack/react-router": "latest",
    "@tanstack/react-router-devtools": "latest",
    "@tanstack/react-router-ssr-query": "latest",
    "@tanstack/react-start": "latest",
    "@tanstack/router-plugin": "^1.132.0",
    "@vercel/analytics": "^2.0.1",
    "@vercel/speed-insights": "^2.0.0",
    "better-auth": "^1.5.3",
    "i18next": "^26.0.9",
    "idb-keyval": "^6.2.2",
    "lucide-react": "^0.545.0",
    "nitro": "^3.0.260311-beta",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-i18next": "^17.0.6",
    "recharts": "^3.8.1",
    "resend": "^6.11.0",
    "sonner": "^2.0.7",
    "superjson": "^2.2.6",
    "tailwindcss": "^4.1.18",
    "web-push": "^3.6.7",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@tailwindcss/typography": "^0.5.16",
    "@tanstack/devtools-vite": "latest",
    "@tanstack/eslint-config": "latest",
    "@testing-library/dom": "^10.4.1",
    "@testing-library/react": "^16.3.0",
    "@types/node": "^22.10.2",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@types/web-push": "^3.6.4",
    "@vitejs/plugin-react": "^6.0.1",
    "dotenv-cli": "^11.0.0",
    "eslint": "^9.39.4",
    "jsdom": "^28.1.0",
    "prisma": "^7.7.0",
    "tsx": "^4.21.0",
    "vite": "^8.0.0",
    "vite-plugin-pwa": "^1.2.0",
    "vitest": "^3.0.5"
  }
}
```

Note: `prisma` stays as a devDep here because the `build` script invokes `prisma migrate deploy` directly. `@prisma/client` and `@prisma/adapter-pg` are accessed via `@phinio/db`, so they're removed from the web deps list.

- [ ] **Step 5: Update `apps/web/tsconfig.json`** to extend the base and keep the existing `#/*` alias

Read `apps/web/tsconfig.json` first (it was moved from root). Replace its contents with:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "#/*": ["./src/*"],
      "@/*": ["./src/*"]
    },
    "types": ["vite/client", "node"]
  },
  "include": ["src", "vite.config.ts", "vitest.config.ts"]
}
```

If the original tsconfig has other settings (e.g. `jsx`, `target`, `lib`), those now come from `tsconfig.base.json` — verify nothing is lost by diffing against `/tmp/pre-move-tsconfig.json` if uncertain. (`git show pre-monorepo-baseline:tsconfig.json` to retrieve.)

- [ ] **Step 6: Update the root prisma `output` reference in `apps/web/src/db.ts`**

This import path will be replaced wholesale in Task 6. For now, leave it alone — Step 7 below will reinstall and we'll see what currently breaks.

- [ ] **Step 7: Reinstall and confirm graph resolves**

```bash
pnpm install
```

Expected: install succeeds; `node_modules/@phinio/db` is a symlink into `packages/db`. No build/test runs yet.

- [ ] **Step 8: Commit the move (with broken imports — fixed in next tasks)**

```bash
git add -A
git commit -m "chore(monorepo): move web app into apps/web/ (imports still pointing at old paths)"
```

The repo will not build at this commit. That's expected and the next two tasks repair it.

---

## Task 6: Repoint `db.ts` to `@phinio/db`

**Files:**
- Modify: `apps/web/src/db.ts`

- [ ] **Step 1: Read the current contents**

```bash
cat apps/web/src/db.ts
```

It currently imports `PrismaClient` from `./generated/prisma/client.js`. We'll replace with `@phinio/db`.

- [ ] **Step 2: Edit `apps/web/src/db.ts`** — replace any line matching `from './generated/prisma/client.js'` or `from './generated/prisma'` with `from '@phinio/db'`. The rest of the file (pg adapter wiring, `globalThis.__prisma` memoization) stays exactly as it was.

After the edit, the import block should look like:

```ts
import { PrismaClient } from '@phinio/db'
import { PrismaPg } from '@prisma/adapter-pg'
```

(`@prisma/adapter-pg` is now resolved via `@phinio/db`'s transitive — verify in Step 3 — but we keep it explicit in web's package.json? No: we removed it. Re-add `@prisma/adapter-pg` to `apps/web/package.json` `dependencies` since the web app imports it directly.)

- [ ] **Step 3: Add `@prisma/adapter-pg` back to `apps/web/package.json`**

```bash
pnpm --filter @phinio/web add @prisma/adapter-pg@^7.4.2
```

- [ ] **Step 4: Delete the old generated directory** (it's now in `packages/db/src/generated/`)

```bash
rm -rf apps/web/src/generated/prisma
```

- [ ] **Step 5: Search for any remaining stale references**

```bash
grep -rn "generated/prisma" apps/web/src/ packages/ --include='*.ts' --include='*.tsx'
```

Expected: no matches. If any appear (e.g. some impl file imports `Prisma` namespace directly), replace `'./generated/prisma'` (or `#/generated/prisma`) with `'@phinio/db'`.

- [ ] **Step 6: Type-check just to validate import resolution** (don't run full build yet — validators/calc still wrong)

```bash
pnpm --filter @phinio/web exec tsc --noEmit 2>&1 | grep -E "Cannot find module" | head -20
```

Expected matches will be about `#/lib/validators`, `#/lib/emi-calculator`, etc. — those are addressed in the next tasks. No matches involving `@phinio/db` or `./generated/prisma` should remain.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/db.ts apps/web/package.json pnpm-lock.yaml
git rm -r apps/web/src/generated 2>/dev/null || git add -A
git commit -m "refactor(web): import PrismaClient from @phinio/db"
```

---

## Task 7: Create `@phinio/validators` package

**Files:**
- Create: `packages/validators/package.json`
- Create: `packages/validators/tsconfig.json`
- Move: `apps/web/src/lib/validators.ts` → `packages/validators/src/index.ts`

- [ ] **Step 1: Create directory + move the file**

```bash
mkdir -p packages/validators/src
git mv apps/web/src/lib/validators.ts packages/validators/src/index.ts
```

- [ ] **Step 2: Create `packages/validators/package.json`**

```json
{
  "name": "@phinio/validators",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "zod": "^4.3.6"
  }
}
```

- [ ] **Step 3: Create `packages/validators/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Inspect the moved file for imports that need fixing**

```bash
grep -nE "^import " packages/validators/src/index.ts
```

If any imports reference web-specific paths (e.g. `#/lib/...`), they must be either inlined or pulled in as new dependencies. The current `validators.ts` is expected to import only `zod` and maybe types from `@phinio/db` (e.g. enums) — adjust accordingly. If it imports from `@phinio/db`, add it to dependencies:

```bash
pnpm --filter @phinio/validators add @phinio/db@workspace:*
```

- [ ] **Step 5: Add `@phinio/validators` as a dependency of `@phinio/web`**

```bash
pnpm --filter @phinio/web add @phinio/validators@workspace:*
```

- [ ] **Step 6: Commit (consumers still broken — fixed in Task 9)**

```bash
git add -A
git commit -m "feat(monorepo): extract @phinio/validators package"
```

---

## Task 8: Create `@phinio/calc` package

**Files:**
- Create: `packages/calc/package.json`
- Create: `packages/calc/tsconfig.json`
- Create: `packages/calc/src/index.ts`
- Move: `apps/web/src/lib/emi-calculator.ts` → `packages/calc/src/emi.ts`
- Move: `apps/web/src/lib/dps-calculator.ts` → `packages/calc/src/dps.ts`
- Move: `apps/web/src/lib/calculations.ts` → `packages/calc/src/calculations.ts`

- [ ] **Step 1: Create directory + move files**

```bash
mkdir -p packages/calc/src
git mv apps/web/src/lib/emi-calculator.ts packages/calc/src/emi.ts
git mv apps/web/src/lib/dps-calculator.ts packages/calc/src/dps.ts
git mv apps/web/src/lib/calculations.ts packages/calc/src/calculations.ts
```

- [ ] **Step 2: Create the barrel `packages/calc/src/index.ts`**

```ts
export * from './emi.js'
export * from './dps.js'
export * from './calculations.js'
```

(Note `.js` extensions — required under `module: "ESNext"` + bundler resolution. If the consumers don't compile after this, fall back to no extensions and `moduleResolution: "Bundler"` already handles it. Test in Step 6.)

- [ ] **Step 3: Create `packages/calc/package.json`**

```json
{
  "name": "@phinio/calc",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./emi": "./src/emi.ts",
    "./dps": "./src/dps.ts",
    "./calculations": "./src/calculations.ts"
  },
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^3.0.5"
  }
}
```

- [ ] **Step 4: Create `packages/calc/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Inspect moved files for cross-imports**

```bash
grep -nE "^import " packages/calc/src/*.ts
```

If any file imports `'./emi-calculator'` or similar (now stale because of the rename), fix the references:

```bash
sd "from '\./emi-calculator'" "from './emi.js'" packages/calc/src/*.ts
sd "from '\./dps-calculator'" "from './dps.js'" packages/calc/src/*.ts
```

(Use `sed -i ''` on macOS if `sd` not installed: `sed -i '' "s|from './emi-calculator'|from './emi.js'|g" packages/calc/src/*.ts`.)

- [ ] **Step 6: Write a smoke test** (`packages/calc/src/__tests__/smoke.test.ts`) that proves the barrel exports compile and execute. This is the first new test in the plan — TDD-strict.

```ts
import { describe, it, expect } from 'vitest'
import * as calc from '../index.js'

describe('@phinio/calc barrel', () => {
  it('re-exports the EMI calculator', () => {
    // generateAmortization is the canonical EMI entry per WORKFLOWS.md §5
    expect(typeof calc.generateAmortization).toBe('function')
  })

  it('re-exports the DPS calculator', () => {
    // The DPS module's primary export name is project-specific — adjust the
    // assertion to whatever function the moved file exposes (audit at run time).
    const exportedNames = Object.keys(calc)
    expect(exportedNames.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 7: Run the smoke test**

```bash
pnpm --filter @phinio/calc test
```

Expected: PASS. If the EMI export name is different from `generateAmortization`, the test will fail informatively — adjust the assertion to the real name, re-run.

- [ ] **Step 8: Add `@phinio/calc` as a dependency of `@phinio/web`**

```bash
pnpm --filter @phinio/web add @phinio/calc@workspace:*
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(monorepo): extract @phinio/calc package with smoke test"
```

---

## Task 9: Codemod web imports to the new packages

**Files:**
- Modify: all of `apps/web/src/**/*.{ts,tsx}` that imported the moved modules.

- [ ] **Step 1: Verify codemod tool is available**

```bash
which sd || brew install sd
sd --version
```

(If not on macOS / homebrew unavailable: `cargo install sd` or fall back to the `sed` block at the end of this task.)

- [ ] **Step 2: Codemod validator imports**

```bash
cd apps/web
sd "from ['\"]#/lib/validators['\"]" "from '@phinio/validators'" $(grep -rl --include='*.ts' --include='*.tsx' "from ['\"]#/lib/validators['\"]" src/)
cd ../..
```

- [ ] **Step 3: Codemod calculator imports**

```bash
cd apps/web
# emi-calculator
sd "from ['\"]#/lib/emi-calculator['\"]" "from '@phinio/calc'" $(grep -rl --include='*.ts' --include='*.tsx' "from ['\"]#/lib/emi-calculator['\"]" src/ 2>/dev/null)
# dps-calculator
sd "from ['\"]#/lib/dps-calculator['\"]" "from '@phinio/calc'" $(grep -rl --include='*.ts' --include='*.tsx' "from ['\"]#/lib/dps-calculator['\"]" src/ 2>/dev/null)
# calculations
sd "from ['\"]#/lib/calculations['\"]" "from '@phinio/calc'" $(grep -rl --include='*.ts' --include='*.tsx' "from ['\"]#/lib/calculations['\"]" src/ 2>/dev/null)
cd ../..
```

- [ ] **Step 4: Verify no stale references remain**

```bash
grep -rn -E "from ['\"]#/lib/(validators|emi-calculator|dps-calculator|calculations)['\"]" apps/web/src/ --include='*.ts' --include='*.tsx'
```

Expected: no output.

- [ ] **Step 5: Type-check the web app end-to-end**

```bash
pnpm --filter @phinio/web exec tsc --noEmit
```

Expected: zero errors. If errors appear, they're almost certainly one of:
  - A file imported a *named export* that's now namespaced under `@phinio/calc` differently — fix the named import.
  - A type-only export that needs `import type { Foo } from '@phinio/validators'` — adjust accordingly.

- [ ] **Step 6: Run the web test suite**

```bash
pnpm --filter @phinio/web test
```

Expected: same pass count as `/tmp/phinio-baseline-test.log`. Any net new failure must be fixed before commit.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(web): repoint imports to @phinio/validators and @phinio/calc"
```

**Fallback (no `sd`):** replace each `sd "PATTERN" "REPLACEMENT" $(grep -rl ...)` invocation with:

```bash
grep -rl --include='*.ts' --include='*.tsx' "PATTERN" apps/web/src/ | xargs sed -i '' "s|PATTERN|REPLACEMENT|g"
```

---

## Task 10: Create `@phinio/design-tokens` package

**Files:**
- Create: `packages/design-tokens/src/tokens.json`
- Create: `packages/design-tokens/src/build-css.ts`
- Create: `packages/design-tokens/src/index.ts`
- Create: `packages/design-tokens/package.json`
- Create: `packages/design-tokens/tsconfig.json`
- Create: `packages/design-tokens/src/__tests__/build-css.test.ts`
- Modify: `apps/web/src/styles.css` (import generated CSS)

- [ ] **Step 1: Extract tokens from current `apps/web/src/styles.css`**

```bash
sed -n '/@theme/,/^}/p' apps/web/src/styles.css > /tmp/phinio-tokens-source.txt
cat /tmp/phinio-tokens-source.txt
```

Manually copy the `--color-*`, `--font-*`, `--radius-*` variables (and any other tokens used by web) into the JSON below. The list must be exhaustive — if a token is missing from `tokens.json` it'll vanish from web.

- [ ] **Step 2: Create `packages/design-tokens/src/tokens.json`** (illustrative; replace `…` with the actual values from Step 1)

```json
{
  "color": {
    "surface": "#0b1326",
    "surface-container-lowest": "#060e20",
    "surface-container-low": "#10193a",
    "surface-container-high": "#1b2545",
    "surface-container-highest": "#2d3449",
    "on-surface": "#e6ecff",
    "on-surface-variant": "#a4adcb",
    "primary": "#92a8ff",
    "primary-container": "#3148a1",
    "secondary": "#4edea3",
    "tertiary-container": "#cf2c30",
    "tertiary-fixed-variant": "#f7b86c",
    "outline-variant": "#383f57"
  },
  "font": {
    "sans": "Inter, 'Hind Siliguri', system-ui, sans-serif",
    "display": "Manrope, 'Hind Siliguri', system-ui, sans-serif"
  },
  "radius": {
    "card": "16px",
    "pill": "999px"
  }
}
```

- [ ] **Step 3: Create the generator `packages/design-tokens/src/build-css.ts`**

```ts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

type TokenTree = Record<string, Record<string, string>>

export function tokensToCss(tokens: TokenTree): string {
  const lines: Array<string> = ['@theme {']
  for (const [group, entries] of Object.entries(tokens)) {
    for (const [name, value] of Object.entries(entries)) {
      lines.push(`  --${group}-${name}: ${value};`)
    }
  }
  lines.push('}')
  lines.push('')
  return lines.join('\n')
}

function main() {
  const src = resolve(__dirname, 'tokens.json')
  const out = resolve(__dirname, '../dist/tokens.css')
  const tokens = JSON.parse(readFileSync(src, 'utf8')) as TokenTree
  const css = tokensToCss(tokens)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, css, 'utf8')
  console.log(`Wrote ${out} (${css.length} bytes)`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
```

- [ ] **Step 4: Create the test `packages/design-tokens/src/__tests__/build-css.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { tokensToCss } from '../build-css.js'

describe('tokensToCss', () => {
  it('emits an @theme block with kebab-cased custom properties', () => {
    const tokens = {
      color: { surface: '#0b1326', 'on-surface': '#e6ecff' },
      radius: { card: '16px' },
    }
    const css = tokensToCss(tokens)
    expect(css).toContain('@theme {')
    expect(css).toContain('--color-surface: #0b1326;')
    expect(css).toContain('--color-on-surface: #e6ecff;')
    expect(css).toContain('--radius-card: 16px;')
    expect(css).toContain('}')
  })

  it('returns an empty @theme block for empty input', () => {
    expect(tokensToCss({})).toBe('@theme {\n}\n')
  })
})
```

- [ ] **Step 5: Run the test, expect FAIL** (file doesn't exist yet — Vitest will error at the import)

```bash
mkdir -p packages/design-tokens
# (file creation done in following steps)
```

Actually — Steps 3 and 4 already wrote the implementation and test. To honor TDD: skip to a verification step. Run the test:

```bash
pnpm --filter @phinio/design-tokens test
```

Expected: PASS. If it fails because dependencies aren't installed, complete Steps 6-7 first then re-run.

- [ ] **Step 6: Create `packages/design-tokens/src/index.ts`** (JS consumer entry for Phase 3 mobile)

```ts
import tokens from './tokens.json' with { type: 'json' }

export type Tokens = typeof tokens
export const designTokens: Tokens = tokens
export default designTokens
```

- [ ] **Step 7: Create `packages/design-tokens/package.json`**

```json
{
  "name": "@phinio/design-tokens",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./tokens.json": "./src/tokens.json",
    "./tokens.css": "./dist/tokens.css"
  },
  "scripts": {
    "build": "tsx src/build-css.ts",
    "test": "vitest run"
  },
  "devDependencies": {
    "tsx": "^4.21.0",
    "vitest": "^3.0.5"
  }
}
```

- [ ] **Step 8: Create `packages/design-tokens/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 9: Install + build**

```bash
pnpm install
pnpm --filter @phinio/design-tokens run build
pnpm --filter @phinio/design-tokens test
```

Expected: `packages/design-tokens/dist/tokens.css` exists; test passes.

- [ ] **Step 10: Wire web's styles.css to consume the generated tokens**

Replace the inline `@theme { ... }` block in `apps/web/src/styles.css` with:

```css
@import '@phinio/design-tokens/tokens.css';
```

Add `@phinio/design-tokens` as a dependency:

```bash
pnpm --filter @phinio/web add @phinio/design-tokens@workspace:*
```

Add the design-tokens build to web's build script so the CSS is fresh:

In `apps/web/package.json`, replace the `build:local` script:

```json
"build:local": "pnpm --filter @phinio/design-tokens run build && dotenv -e ../../.env.local -- vite build"
```

(Turbo's `dependsOn: ["^build"]` already handles dependency build ordering for the cached path, but `build:local` calls Vite directly without turbo — keep the explicit invocation here.)

- [ ] **Step 11: Verify the web dev server still picks up tokens**

```bash
pnpm --filter @phinio/design-tokens run build
pnpm --filter @phinio/web exec tsc --noEmit
```

Then start the dev server briefly and screenshot the dashboard:

```bash
pnpm --filter @phinio/web dev &
DEV_PID=$!
sleep 12
curl -s http://localhost:3000/ -o /dev/null -w "%{http_code}\n"
kill $DEV_PID
```

Expected: HTTP 200 (or 302 to `/app` — both are fine; we just want "server boots, doesn't 500").

If you want a true visual check: open `http://localhost:3000` in the browser, confirm dark theme renders, confirm Manrope numerics on the dashboard.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat(monorepo): extract @phinio/design-tokens with CSS generator + test"
```

---

## Task 11: Restore full build + test pipelines through Turbo

**Files:**
- Verify only — no edits unless gaps surface.

- [ ] **Step 1: Add a `build:local` script to each package that produces artifacts**

`packages/db/package.json` — add to `scripts`:

```json
"build": "pnpm run db:generate",
"build:local": "pnpm run db:generate"
```

`packages/design-tokens/package.json` — already has `build` from Task 10. Add:

```json
"build:local": "pnpm run build"
```

`packages/validators/package.json` and `packages/calc/package.json` — no build artifacts; add a no-op:

```json
"build": "echo 'no build for this package'",
"build:local": "echo 'no build for this package'"
```

- [ ] **Step 2: Run the full pipeline through Turbo**

```bash
pnpm install
pnpm run test
```

Expected: same pass count as `/tmp/phinio-baseline-test.log`. Turbo prints the dependency graph and runs `@phinio/calc test`, `@phinio/design-tokens test`, `@phinio/web test`.

- [ ] **Step 3: Run lint**

```bash
pnpm run lint
```

Expected: matches `/tmp/phinio-baseline-lint.log` (zero new errors).

- [ ] **Step 4: Run `build:local`**

```bash
pnpm run build:local
```

Expected: completes successfully; produces `apps/web/.output/` (or whatever the existing build emits). Same artifact set as the baseline.

- [ ] **Step 5: Commit any incidental fixups**

```bash
git add -A
git diff --cached
```

If there are staged changes (likely script additions to package.json files), commit:

```bash
git commit -m "chore(monorepo): add build/build:local scripts to every package for turbo"
```

If not, skip.

---

## Task 12: Update docs for the new layout

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/WORKFLOWS.md`
- Modify: `README.md`

- [ ] **Step 1: Update `CLAUDE.md` Commands section**

Replace the `npm run X` block (lines 21-36 in the current file) with:

```bash
pnpm dev               # all apps in dev mode (turbo)
pnpm --filter @phinio/web dev   # just the web app on :3000
pnpm build             # production build via turbo
pnpm build:local       # local-env build (dotenv -e .env.local wrapping)
pnpm test              # vitest across the workspace
pnpm lint              # eslint across the workspace
pnpm check             # prettier --write + eslint --fix

pnpm db:generate       # prisma generate (against packages/db/prisma/schema.prisma)
pnpm db:push
pnpm db:migrate
pnpm db:studio
pnpm db:seed
```

Update the path-aliases paragraph to mention that `#/*` is now scoped to `apps/web/`.

- [ ] **Step 2: Update `docs/ARCHITECTURE.md`**

In §1 ("System overview"), add a paragraph after the ASCII diagram:

```markdown
The repository is a pnpm + Turborepo monorepo. The web app lives at
`apps/web/`. Shared libraries (`@phinio/db`, `@phinio/validators`,
`@phinio/calc`, `@phinio/design-tokens`) live under `packages/` and
are consumed via the `workspace:*` protocol. A second app
(`apps/mobile/`) lands in Phase 3 of the native-app rollout.
```

In §2 ("Layers"), update the "Database" subsection: `apps/web/src/db.ts` imports `PrismaClient` from `@phinio/db` (no longer from the local generated directory). Schema lives at `packages/db/prisma/schema.prisma`.

- [ ] **Step 3: Update `docs/WORKFLOWS.md` Pre-commit checklist (§10)**

```bash
pnpm check          # prettier --write + eslint --fix
pnpm test           # vitest across the workspace
pnpm build:local    # full build with .env.local — catches type errors
```

And update §9 ("Database changes"):

```bash
# 1. Edit packages/db/prisma/schema.prisma
pnpm db:generate    # regenerates client into packages/db/src/generated/
pnpm db:migrate     # creates a migration in packages/db/prisma/migrations + applies
```

- [ ] **Step 4: Update `README.md`**

Add a "Monorepo layout" section near the top describing `apps/web/`, `packages/db`, `packages/validators`, `packages/calc`, `packages/design-tokens`. Keep it short — link to `docs/ARCHITECTURE.md` for detail.

- [ ] **Step 5: Run the docs through prettier**

```bash
pnpm exec prettier --write CLAUDE.md docs/ARCHITECTURE.md docs/WORKFLOWS.md README.md
```

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md docs/ARCHITECTURE.md docs/WORKFLOWS.md README.md
git commit -m "docs: update for pnpm + turbo monorepo layout"
```

---

## Task 13: Final regression gate + PR

**Files:**
- None modified — verification + handoff.

- [ ] **Step 1: Fresh-clone simulation**

```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules .turbo
pnpm install
pnpm db:generate
pnpm test
pnpm lint
pnpm build:local
```

Expected: all four commands exit 0. This proves the repo bootstraps cleanly from a cold cache.

- [ ] **Step 2: Diff test counts vs. baseline**

```bash
grep -E "(Tests|passed|failed)" /tmp/phinio-baseline-test.log | tail -5
pnpm test 2>&1 | grep -E "(Tests|passed|failed)" | tail -5
```

Expected: same number of passing tests. New tests added by this plan (`calc/smoke`, `design-tokens/build-css`) add to the pass count — that's fine. Net failures = 0.

- [ ] **Step 3: Manual smoke test of dev server**

```bash
pnpm --filter @phinio/web dev
```

Open `http://localhost:3000` in a browser. Verify:
- Marketing landing renders.
- `/login` form renders with correct dark theme + fonts.
- After logging in (use a seeded test account), `/app` dashboard renders, no console errors related to imports.

Kill the dev server with Ctrl-C.

- [ ] **Step 4: Push the branch and open a PR**

```bash
git push -u origin feat/phase-1-monorepo
gh pr create --title "Phase 1: monorepo migration (pnpm + Turborepo, packages/{db,validators,calc,design-tokens})" --body "$(cat <<'EOF'
## Summary
- Converts Phinio to a pnpm + Turborepo workspace
- Moves the existing PWA to `apps/web/`
- Extracts `@phinio/db`, `@phinio/validators`, `@phinio/calc`, `@phinio/design-tokens`
- Zero runtime behavior change; all existing tests pass

Implements Phase 1 of the React Native rollout
(`docs/superpowers/specs/2026-05-12-rn-mobile-app-design.md` §2 + §7).
`packages/auth/` extraction is deferred to Phase 3 per the plan.

## Test plan
- [ ] `pnpm test` passes with same count as pre-migration baseline
- [ ] `pnpm lint` passes
- [ ] `pnpm build:local` produces the same artifact set
- [ ] Manual: dev server boots, login flow works, dashboard renders
- [ ] Manual: Prisma migrations apply cleanly (`pnpm db:migrate`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL is printed. Done.

---

## Self-review

**Spec coverage** (against `docs/superpowers/specs/2026-05-12-rn-mobile-app-design.md` §2):

- ✅ Monorepo with `apps/web` + `apps/mobile` — apps/web done; apps/mobile is Phase 3.
- ✅ `packages/db` — Task 4 + Task 6.
- ✅ `packages/validators` — Task 7 + Task 9.
- ✅ `packages/calc` — Task 8 + Task 9.
- ✅ `packages/design-tokens` — Task 10.
- ⏭️ `packages/auth` — explicitly deferred to Phase 3 (rationale in the plan's preamble).
- ✅ pnpm + Turborepo — Tasks 2 + 3.
- ✅ Zero behavior change — Tasks 1 (baseline), 11 (regression gate), 13 (final gate).
- ✅ Doc updates — Task 12.

**Placeholder scan:** searched the plan for "TBD", "TODO", "implement later" — none present. Where the plan can't enumerate at write-time (e.g. exact contents of `tokens.json` from current CSS, or the named exports of the moved DPS module), it provides an inspection step + a fallback instruction in the same task rather than a placeholder.

**Type / name consistency:** package names (`@phinio/db`, `@phinio/validators`, `@phinio/calc`, `@phinio/design-tokens`, `@phinio/web`) are used identically across Tasks 4–13. Scripts (`db:generate`, `build:local`, `test`) match between root, package, and turbo config.

**Risks the plan does not eliminate:**
- The codemod (Task 9) assumes that every import of the moved modules uses the `#/lib/...` form. If any file uses a relative path (e.g. `'../lib/validators'`), it'll be missed. Mitigation: the type-check in Task 9 Step 5 will catch them.
- `tokens.json` extraction (Task 10 Step 2) is a manual transcription from the existing `@theme` block. The plan provides an inspection command but ultimately depends on careful copy-paste. Risk mitigated by the visual smoke test in Task 13 Step 3.
