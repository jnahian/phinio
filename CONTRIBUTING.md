# Contributing to Phinio

Thanks for your interest in contributing! This document explains how to set up the project, the conventions we follow, and what to expect from the review process.

## Getting set up

See the [Getting Started](README.md#getting-started) section of the README for the full local-development walkthrough (env vars, database, dev server). The short version:

```bash
npm install
cp .env.example .env.local        # then fill in the values
npm run db:migrate
npm run db:generate
npm run dev
```

## Workflow

1. **Open an issue first** for non-trivial work. A short discussion up front saves a lot of churn — especially for changes that touch the schema, the auth flow, or the design system.
2. **Branch from `main`.** Use a descriptive branch name (e.g. `feat/dps-premature-closure`, `fix/emi-rounding`).
3. **Keep changes focused.** One PR, one concern. Refactors, formatting sweeps, and feature work belong in separate PRs.
4. **Run the checks before pushing:**
   ```bash
   npm run check     # prettier --write + eslint --fix
   npm run test      # vitest
   npm run build:local   # full production build with local env
   ```
5. **Open a pull request** against `main` with a clear description: what changed, why, and how to verify.

## Coding conventions

These are enforced by ESLint / Prettier where possible, but a few are conventions you'll want to know up front:

- **Path aliases.** Use `#/...` (preferred) or `@/...` — both resolve to `src/`. Don't mix styles within a file.
- **Prisma client.** Import from `src/generated/prisma/client.js`, never from `@prisma/client`. Run `npm run db:generate` after any `schema.prisma` edit.
- **Authorization is per-query.** Every `createServerFn` that touches user data must derive `profileId` from the Better Auth session and include it in the Prisma `where` clause. There is no route-level authorization — guards are inside the handler.
- **Money is `Decimal(15,2)`.** Pass it through as strings or `Decimal` objects; never coerce to JS `number` for arithmetic.
- **Pre-compute schedules on write.** All `EmiPayment` and `InvestmentDeposit` rows are generated at creation time. Don't compute amortization or DPS accrual at read time.
- **Route tree is generated.** Never edit `src/routeTree.gen.ts` — add files under `src/routes/` and the plugin regenerates it.
- **Dark-only UI.** No theme toggle, no light-mode variants. Tailwind tokens live under `@theme` in `src/styles.css`; there is no `tailwind.config.js`.
- **Design system.** Cross-reference the PRD section, the screen mockup (`screens/<name>/`), and `screens/phinio_modern_noir/DESIGN.md` before touching UI. The "No-Line Rule" — no 1px borders for sectioning — is non-negotiable.
- **Offline-first.** New mutations need `clientMutationId` support, server-side `withIdempotency`, and a `mutationKey` registered for the offline queue. See [`docs/OFFLINE_PLAN.md`](docs/OFFLINE_PLAN.md).

## Commit messages

We use [gitmoji](https://gitmoji.dev/) prefixes followed by a [Conventional Commits](https://www.conventionalcommits.org/) type:

```
🟣 feat: add premature DPS closure flow
🩹 fix: align EMI remainingBalance with stored payment field
📦 chore: move project docs into docs/ folder
✈️ feat: complete offline-first support for all mutations
```

Keep the subject line under ~72 characters. Use the body to explain *why* the change was made when it isn't obvious from the diff.

## Tests

- Unit tests live alongside the code (`*.test.ts`). Run a single file with `npx vitest run path/to/file.test.ts`.
- Business-logic modules in `lib/` should ship with tests. UI components don't need tests by default unless they encode non-trivial behavior.
- Don't mock the database in integration-style tests — use a real test database. Mocked DBs have masked migration breakage in this project before.

## Reporting bugs

Open a GitHub issue with:

- What you did
- What you expected
- What actually happened
- Browser / device / OS, and whether you were online or offline at the time

Stack traces and screenshots help.

## Security

Do **not** open a public issue for security vulnerabilities. Email the maintainer directly. See [SECURITY](#) (TBD) for the disclosure process.

## License

By contributing you agree that your contributions will be licensed under the [MIT License](LICENSE).
