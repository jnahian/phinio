# Schemas

Reference for Phinio's data model. Authoritative source: `prisma/schema.prisma`. This doc explains the **shape** and **invariants** that aren't obvious from the schema alone.

For business behavior see `docs/Phinio_PRD_v1.md` §4. For Zod input validators see `src/lib/validators.ts`.

---

## Conventions

- **IDs:** every domain row is `String @id @default(uuid())`. Clients can mint UUIDs and send them — no temp-ID reconciliation needed (see `OFFLINE_PLAN.md`).
- **Money:** all monetary fields are `Decimal @db.Decimal(15, 2)`. Treat as strings or `Prisma.Decimal`; never JS `Number` for arithmetic.
- **Dates:** business dates (`dueDate`, `startDate`, `dateOfInvestment`) are `@db.Date` (no time). Audit timestamps (`createdAt`, `updatedAt`, `paidAt`) are full `DateTime`.
- **Authorization scope:** every domain row carries `profileId` and a relation to `Profile`. Server functions **must** scope every query/mutation by the session's `profileId`. There is no role/permission layer — owning the profile is the only check.
- **Soft delete:** none. Deletes cascade via `onDelete: Cascade` from `Profile` → owned rows, and from `User` → `Profile`.

---

## Auth core (managed by Better Auth CLI)

| Model          | Maps to        | Notes                                                             |
| -------------- | -------------- | ----------------------------------------------------------------- |
| `User`         | `user`         | `email` unique, `emailVerified` gates login. Owns one `Profile?`. |
| `Session`      | `session`      | Cookie-bearing session, indexed by `userId`.                      |
| `Account`      | `account`      | Better Auth credentials (password hash) and OAuth tokens.         |
| `Verification` | `verification` | Email verification + password reset tokens.                       |

These are regenerated in place via `npx @better-auth/cli@latest generate` if `additionalFields` or plugins change. **Don't hand-edit them** beyond `additionalFields` like `preferredCurrency`.

---

## Domain core

### `Profile` → `profiles`

One per `User` (`userId @unique`). Carries `fullName`, `preferredCurrency` (BDT | USD), and is the **authorization root** — every other domain row joins back through `profileId`.

### `Investment` → `investments`

Tracks one investment instrument. The `mode` field discriminates three sub-shapes:

| `mode`      | Meaning                            | Invariant                                                                                                                                                                                                                              |
| ----------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lump_sum`  | One-time entry (stocks, FD, gold…) | `investedAmount` and `currentValue` are user-set. `dateOfInvestment` required.                                                                                                                                                         |
| `scheduled` | DPS — fixed monthly + tenure       | `monthlyDeposit`, `tenureMonths`, `interestRate`, `interestType` required. Schedule pre-generated as `InvestmentDeposit` rows. `investedAmount` = SUM(paid deposits). `currentValue` = `investedAmount` (no gain/loss until maturity). |
| `flexible`  | Ad-hoc savings pot                 | No tenure or interest. `investedAmount` = SUM(paid deposits). `currentValue` is user-set.                                                                                                                                              |

`type` is a free-form string but bounded by enum: `stock | mutual_fund | fd | gold | crypto | sanchayapatra | real_estate | agro_farm | business | dps | savings | other`. Keep `AllocationDonut` and legend in sync when adding values.

`status`: `active | completed | matured | closed`. `exitValue` + `completedAt` set when status leaves `active`.

Indexes: `(profileId, status)`, `(profileId, mode)`.

### `InvestmentDeposit` → `investment_deposits`

For `scheduled` and `flexible` investments only. `lump_sum` has no deposits.

- **Scheduled:** rows are pre-generated at investment creation, one per month. `dueDate`, `installmentNumber`, `accruedValue` (running balance with interest after this deposit) are populated. `status` flips `upcoming → paid` when user marks paid.
- **Flexible:** rows created ad-hoc by the user. `dueDate` / `installmentNumber` / `accruedValue` are null.

Indexes: `(investmentId, installmentNumber)` for schedule order, `(profileId, status, dueDate)` for "upcoming reminders" queries.

### `InvestmentWithdrawal` → `investment_withdrawals`

Withdrawals from any investment mode. Reduces effective `currentValue` for reporting (computed at read time, not stored).

### `Emi` → `emis`

A loan or credit-card amortization. `principal`, `interestRate`, `tenureMonths`, `emiAmount` (computed via PRD §9.2), `startDate`, `status` (`active | completed | closed`).

Schedule lives in `EmiPayment` and is **fully generated at create time** — never compute on read.

### `EmiPayment` → `emi_payments`

One row per scheduled installment. `paymentNumber`, `dueDate`, `emiAmount`, `principalComponent`, `interestComponent`, `remainingBalance` — all populated up-front. `status` (`upcoming | paid | overdue`) and `paidAt` mutate over the EMI's life.

Special row: when an EMI has fees (e.g. credit card processing), one synthetic row uses `paymentNumber = FEE_PAYMENT_NUMBER` (constant in `src/lib/emi-calculator.ts`). Use `isFeePayment` / `isRegularPayment` helpers — never compare the magic number directly.

Indexes: `(emiId, paymentNumber)`, `(profileId, status, dueDate)`.

---

## Cross-cutting tables

### `Notification` → `notifications`

App-level toasts and the bell-icon feed. `dedupeKey` + `@@unique([profileId, dedupeKey])` prevents duplicate reminders for the same payment / event. `readAt` null = unread.

### `ActivityLog` → `activity_log`

User-facing audit feed. **One row per user-initiated mutation**, written from inside the server-fn impl after the primary write succeeds.

- `entityId` is a **dangling reference** — the entity may be deleted later.
- `entityLabel` denormalizes the entity's name **at write time** so the feed reads correctly after deletion.
- `changes` is a JSON array of `{ field, from, to }` for `update` actions.
- Index `(profileId, createdAt)` for paginated feed reads.

### `PushSubscription` → `push_subscriptions`

Web Push endpoints. `endpoint` is globally unique; `p256dh` + `auth` are the VAPID keys. Cron job in `src/routes/api/cron/` reads these and dispatches reminders.

### `ProcessedMutation` → `processed_mutations`

Idempotency log for offline replay. Every mutating server-fn accepts an optional `clientMutationId`; on duplicate `(profileId, clientMutationId)`, the original `resultJson` is replayed instead of re-executing.

- Unique on `(profileId, clientMutationId)`.
- `resultJson` is the cached server response — must survive Prisma's JSON serializer.
- Index `(createdAt)` for the daily TTL cleanup (>30 days).

See `WORKFLOWS.md` → "Mutation lifecycle" for how this wraps every mutation.

---

## Adding a new model

1. Edit `prisma/schema.prisma`. Include `profileId` + relation to `Profile` if user-owned.
2. Add `createdAt @default(now())` and `updatedAt @updatedAt`.
3. Add `@@map("snake_case_table")`.
4. Indexes: at minimum `(profileId, ...)` for list queries; add status/date indexes for filtered reads.
5. Run `npm run db:generate` so types resolve, then `npm run db:migrate` (dev) or `db:push` (rapid iteration).
6. Add Zod validator in `src/lib/validators.ts`.
7. Add `*.ts` wrapper + `*.impl.ts` impl in `src/server/`.
8. Wire into `src/lib/offline-cache.ts` if it should persist offline.
