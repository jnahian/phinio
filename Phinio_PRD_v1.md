# PHINIO — Product Requirements Document

**Personal Finance Management App**
Version 2.1 | April 2026 | Status: Active Development

---

## 1. Product Overview

|                      |                                                                                   |
| -------------------- | --------------------------------------------------------------------------------- |
| **App Name**         | Phinio                                                                            |
| **Platform**         | Mobile-first Progressive Web App (optimized for mobile browsers, native app feel) |
| **Target Users**     | General public — anyone wanting to track investments and manage EMI payments      |
| **Currency Support** | BDT (৳) and USD ($) — user selects preferred currency at signup                   |

Phinio is a mobile-first personal finance PWA that helps users track their investment portfolio (lump-sum, DPS schemes, and flexible savings pots) and manage EMI payments for bank loans and credit cards — unified in one private dashboard. The app provides a clear picture of net worth, investment returns, and upcoming payment obligations.

---

## 2. Technology Stack

| Layer              | Technology                                             | Version / Notes                                                     |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------------------------- |
| Frontend Framework | **TanStack Start**                                     | React 19, Vite 8, SSR, file-based routing                           |
| Server/API         | **TanStack Start Server Functions** (`createServerFn`) | Dynamic import pattern — Prisma never leaks into the client bundle  |
| Data Fetching      | **TanStack Query**                                     | Caching, mutations, optimistic updates                              |
| Routing            | **TanStack Router** + `@tanstack/router-plugin`        | Code-generated route tree (`src/routeTree.gen.ts`)                  |
| ORM                | **Prisma 7** with `@prisma/adapter-pg`                 | Custom output to `src/generated/prisma/`; not `@prisma/client`      |
| Database           | **PostgreSQL** via Neon                                | Pooled (`DATABASE_URL`) + direct (`DIRECT_URL`) connection strings  |
| Authentication     | **Better Auth 1.5**                                    | Email/password, email verification, password reset, cookie session  |
| Email              | **Resend**                                             | Branded HTML templates for verification and password reset          |
| Styling            | **Tailwind CSS v4** via `@tailwindcss/vite`            | All tokens in `src/styles.css` under `@theme`; no config file       |
| Design System      | **Material Design 3 / Digital Private Bank**           | Nocturnal palette, dark-only, Manrope numerics, Inter body          |
| Charts             | **Recharts**                                           | Lazy-loaded; allocation donut + EMI principal/interest donut        |
| Validation         | **Zod**                                                | All forms and server function inputs                                |
| Icons              | **lucide-react**                                       |                                                                     |
| Toasts             | **Sonner**                                             |                                                                     |
| PWA                | **vite-plugin-pwa** + Workbox                          | Auto-update, precached assets, runtime caching, iOS safe-area aware |
| Web Push           | **web-push** + VAPID                                   | Push reminders for upcoming / overdue EMI + DPS payments            |
| Deployment         | **Vercel** (Nitro preset)                              | Build-time prerender for public pages; Analytics + Speed Insights   |

---

## 3. User Authentication (Better Auth)

### 3.1 Signup

- Fields: Full Name, Email, Password, Preferred Currency (BDT / USD)
- Better Auth email/password registration
- **Email verification required** — Better Auth sends a branded HTML verification email via Resend on signup. Login is blocked until the user clicks the link. `sendOnSignIn: true` re-sends the link if the user attempts login before verifying. Links expire after 1 hour.
- A `Profile` row is created immediately via a Better Auth `user.create` hook, but the user cannot authenticate until verified.
- Redirects to `/check-email` after signup, then auto-signs in and redirects to `/app` once the link is clicked.

### 3.2 Login

- Fields: Email, Password
- Session managed by Better Auth (httpOnly cookie, via `tanstackStartCookies()` plugin)
- Redirects to `/app` on success

### 3.3 Forgot Password

- User enters email address
- Better Auth sends a branded HTML password reset email via Resend
- User clicks link, sets new password, redirects to login

### 3.4 Session Management

- Protected routes use TanStack Start `beforeLoad` guards (session checked via `getSessionFn`)
- Session context is available to all `/app/*` routes via `RouteContext`
- Logout clears session and redirects to `/login`
- `BETTER_AUTH_URL` must match the running origin — dev `:3000`, preview `:4173`

---

## 4. Database Schema (Prisma)

### 4.1 Prisma Schema

```prisma
// Better Auth core models
model User {
  id                String    @id
  name              String
  email             String    @unique
  emailVerified     Boolean   @default(false)
  image             String?
  preferredCurrency String    @default("BDT")
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  sessions          Session[]
  accounts          Account[]
  profile           Profile?
  @@map("user")
}

model Session { ... @@map("session") }
model Account { ... @@map("account") }
model Verification { ... @@map("verification") }

// Application models

model Profile {
  id                 String              @id @default(uuid())
  userId             String              @unique
  fullName           String
  preferredCurrency  String              @default("BDT")
  createdAt          DateTime            @default(now())
  investments        Investment[]
  investmentDeposits InvestmentDeposit[]
  emis               Emi[]
  emiPayments        EmiPayment[]
  notifications      Notification[]
  @@map("profiles")
}

// Investment.mode values:
//   lump_sum  — one-time entry (stocks, mutual fund, FD, gold, crypto, other)
//   scheduled — fixed monthly deposit with tenure + interest (DPS)
//   flexible  — variable ad-hoc deposits, no tenure/interest (savings pot)
model Investment {
  id               String              @id @default(uuid())
  profileId        String
  name             String
  type             String              // stock | mutual_fund | fd | gold | crypto | dps | savings | other
  mode             String              @default("lump_sum") // lump_sum | scheduled | flexible

  // lump_sum mode
  investedAmount   Decimal             @db.Decimal(15, 2) @default(0)
  currentValue     Decimal             @db.Decimal(15, 2) @default(0)
  exitValue        Decimal?            @db.Decimal(15, 2)
  dateOfInvestment DateTime?           @db.Date
  completedAt      DateTime?           @db.Date

  // scheduled (DPS) — fixed monthly, pre-generated schedule
  monthlyDeposit   Decimal?            @db.Decimal(15, 2)
  tenureMonths     Int?
  interestRate     Decimal?            @db.Decimal(5, 2)
  interestType     String?             // simple | compound

  // scheduled + flexible shared
  startDate        DateTime?           @db.Date

  status           String              @default("active") // active | completed | matured | closed
  notes            String?
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt
  deposits         InvestmentDeposit[]
  @@index([profileId, status])
  @@index([profileId, mode])
  @@map("investments")
}

// Tracks per-installment data for DPS and ad-hoc deposits for savings.
// investedAmount on Investment is always kept in sync:
//   scheduled/flexible: investedAmount = SUM(paid deposits) — updated server-side on every mutation
//   lump_sum: investedAmount is user-set; deposits relation is unused
model InvestmentDeposit {
  id                String     @id @default(uuid())
  investmentId      String
  profileId         String
  amount            Decimal    @db.Decimal(15, 2)
  dueDate           DateTime?  @db.Date           // scheduled: pre-generated due date
  paidAt            DateTime?                     // when paid / deposited
  accruedValue      Decimal?   @db.Decimal(15, 2) // scheduled: running balance with interest
  installmentNumber Int?                           // scheduled: sequence 1, 2, 3…
  status            String     @default("upcoming") // upcoming | paid
  notes             String?
  createdAt         DateTime   @default(now())
  @@index([investmentId, installmentNumber])
  @@index([profileId, status, dueDate])
  @@map("investment_deposits")
}

model Emi {
  id           String       @id @default(uuid())
  profileId    String
  label        String
  type         String       // bank_loan | credit_card
  principal    Decimal      @db.Decimal(15, 2)
  interestRate Decimal      @db.Decimal(5, 2)
  tenureMonths Int
  emiAmount    Decimal      @db.Decimal(15, 2)
  startDate    DateTime     @db.Date
  status       String       @default("active")
  createdAt    DateTime     @default(now())
  payments     EmiPayment[]
  @@index([profileId, status])
  @@map("emis")
}

model EmiPayment {
  id                 String    @id @default(uuid())
  emiId              String
  profileId          String
  paymentNumber      Int
  dueDate            DateTime  @db.Date
  emiAmount          Decimal   @db.Decimal(15, 2)
  principalComponent Decimal   @db.Decimal(15, 2)
  interestComponent  Decimal   @db.Decimal(15, 2)
  remainingBalance   Decimal   @db.Decimal(15, 2)
  status             String    @default("upcoming") // paid | upcoming
  paidAt             DateTime?
  @@index([emiId, paymentNumber])
  @@index([profileId, status, dueDate])
  @@map("emi_payments")
}

model Notification {
  id        String    @id @default(uuid())
  profileId String
  type      String
  title     String
  body      String
  link      String?
  dedupeKey String
  readAt    DateTime?
  createdAt DateTime  @default(now())
  @@unique([profileId, dedupeKey])
  @@index([profileId, readAt, createdAt])
  @@map("notifications")
}
```

### 4.2 Computed and Synced Fields

| Field                                   | Where             | How                                                                     |
| --------------------------------------- | ----------------- | ----------------------------------------------------------------------- |
| `investedAmount` (lump_sum)             | DB, user-set      | Entered at creation / update                                            |
| `investedAmount` (scheduled / flexible) | DB, server-synced | Updated in every deposit mutation = `SUM(paid deposits)`                |
| `currentValue` (lump_sum)               | DB, user-set      | Entered at creation / update                                            |
| `currentValue` (scheduled)              | DB, server-synced | Set equal to `investedAmount` (total deposited; no gain until maturity) |
| `currentValue` (flexible)               | DB, user-set      | User manually updates to reflect actual account balance incl. interest  |
| Return % (active, lump_sum)             | UI                | `((currentValue − investedAmount) / investedAmount) × 100`              |
| Return % (completed)                    | UI                | `((exitValue − investedAmount) / investedAmount) × 100`                 |
| Return % (flexible)                     | UI                | `((currentValue − investedAmount) / investedAmount) × 100`              |
| Net Worth                               | UI / dashboard    | `Σ active investments currentValue − Σ active EMIs remainingBalance`    |
| DPS maturity value                      | UI                | Last deposit's `accruedValue` (pre-generated at creation)               |

### 4.3 Authorization

Every server function derives `profileId` from the Better Auth session before any database operation. All Prisma queries include `where: { profileId }`. Users can never read or mutate another user's data.

---

## 5. Screen Specifications

### 5.1 Landing Page

**Route:** `/`

Full marketing page targeting new users. Sections:

- **Nav bar** — logo, "Login" and "Sign Up" links. Glassmorphism effect on scroll.
- **Hero** — animated ambient orbs, floating Phinio logo, headline, sub-headline, CTA buttons ("Get Started" → `/signup`, "Login" → `/login`), "DIGITAL PRIVATE VAULT" badge.
- **Trust bar** — animated counters: portfolio value tracked, payment schedules managed, on-time payments (illustrative).
- **Features** — three-column grid: Investment Portfolio, EMI Manager, Live Dashboard.
- **How it works** — three-step illustrated flow.
- **Testimonials** — user quotes.
- **Final CTA** — "Your vault is waiting." with sign-up button.
- Redirects to `/app` automatically if already logged in.

### 5.2 Login Screen

**Route:** `/login`

- Email input (type=email, autocomplete)
- Password input (show/hide toggle)
- "Login" full-width button
- "Forgot Password?" link → `/forgot-password`
- "Don't have an account? Sign Up" link → `/signup`
- Inline error messages (Zod + Better Auth errors)
- Loading state on button during auth

### 5.3 Signup Screen

**Route:** `/signup`

- Full Name, Email, Password (min 8 chars, show/hide toggle)
- Preferred Currency selector: BDT / USD
- "Create Account" full-width button
- "Already have an account? Login" link
- On submit: creates account → redirects to `/check-email`

### 5.4 Check Email Screen

**Route:** `/check-email`

- Confirms that a verification email was sent
- "Resend email" option
- After clicking the link in the email: auto-signs in → `/app`

### 5.5 Forgot Password Screen

**Route:** `/forgot-password`

- Email input
- "Send Reset Link" button
- Success state: "Check your email" message
- "Back to Login" link
- Better Auth sends branded HTML reset email via Resend

### 5.6 App Shell

**Route prefix:** `/app/*`

All authenticated app screens share:

- **TopBar** — sticky header with user name (truncated) and avatar; **notification bell** (with unread count badge)
- **BottomTabBar** — four tabs: Home (`/app`), Invest (`/app/investments`), EMIs (`/app/emis`), Profile (`/app/profile`). Hidden on sub-screens via `staticData: { hideTabBar: true }`.

### 5.7 Home / Dashboard Screen

**Route:** `/app`

- **Net Worth Hero Card** — gradient background; value = `Σ active currentValue − Σ active EMI remainingBalance`
- **Quick Stats Row** (2 columns):
  - Total invested, current value, % gain/loss (green/red)
  - Monthly EMI outflow total
- **Upcoming Payments** — next 5 EMI payments due within 30 days. Each card: EMI label, amount, relative due date, overdue badge if past due. Tapping → EMI detail.
- **Investment Allocation Donut** — lazy-loaded Recharts pie; groups active investments by type. Legend shows top 5 types with color and %. Tapping a legend row highlights that slice on the donut and visually dims the others; dimmed rows remain clickable so users can switch focus directly. Tap the selected row again to clear.
- **Empty state** (fresh account) — CTA cards linking to add first investment or EMI.

### 5.8 Investments List Screen

**Route:** `/app/investments`

- **Summary Card** — Total Invested | Current Value | Return %. Includes all three investment modes.
- **Status tabs** — Active / Completed toggle
- **Type filter pills** (horizontal scroll) — All | Stocks | Mutual Fund | FD | Gold | Crypto | DPS | Savings | Other
- **Investment cards** rendered by mode:
  - **Lump-sum card** — name, type badge (color-coded), invested amount, current/exit value, return %, date
  - **DPS card** — name, "DPS" badge (green), `paidCount/tenureMonths` months, total deposited → maturity value, progress bar, monthly/rate/next due footer
  - **Savings card** — name, "Savings" badge (blue), deposit count, current balance, return % (if any), total deposited footer
- **FABMenu** (bottom-right) — expands to three options: Investment, DPS Scheme, Savings Pot
- **Empty state** when no items match current filters

### 5.9 Add Investment Screen (Lump-sum)

**Route:** `/app/investments/new`

- Fields: Name, Type (Stock / Mutual Fund / FD / Gold / Crypto / Other), Date of Investment, Invested Amount, Current Value, Notes (optional)
- "Create Investment" full-width button at bottom
- Zod validation, inline field errors

### 5.10 Edit Investment Screen (Lump-sum)

**Route:** `/app/investments/$id/edit`

- All fields from Add form, pre-filled
- **Status toggle** — Active / Completed. When set to Completed: Exit Value and Completed Date fields appear (both required)
- **Delete** with confirmation dialog
- "Save" button

### 5.11 Add DPS Screen

**Route:** `/app/investments/dps/new`

- Fields: Scheme name, Monthly deposit (`prefix={symbol}`), Tenure (months), Start date
- **Interest section**: Annual interest rate, Interest type selector (Simple / Compound — 2-column button grid)
- **Live maturity preview** — calculated client-side as user types; shows projected maturity value and total deposited
- Notes (optional)
- "Create DPS scheme" button

### 5.12 DPS Detail Screen

**Route:** `/app/investments/dps/$id`

- **Header** — back arrow, scheme name, "DPS · [Simple/Compound] interest · X% p.a.", edit (pencil) button
- **Hero card** — dark green gradient; total deposited, `paidCount/tenureMonths` months, progress bar
- **Stats row** (3 tiles) — Monthly deposit | Maturity value (secondary) | Interest earned (secondary)
- **Deposit schedule** — scrollable list; each row: installment #, due date, monthly amount, accrued balance-after, paid checkbox. Overdue rows highlighted. Clicking checkbox marks paid/unpaid → server syncs `investedAmount` + `currentValue`.
- **Auto-maturation** — when all installments paid, DPS status set to `matured` automatically
- **Edit name** inline card (appears when pencil tapped)
- **Delete** with confirmation

### 5.13 Add Savings Pot Screen

**Route:** `/app/investments/savings/new`

- Fields: Name, Start date, Current balance (optional, default 0), Notes (optional)
- Helper text: "Set to your current account balance if tracking an existing pot. Update anytime."
- "Create savings pot" button
- On success: navigates to savings detail screen

### 5.14 Savings Pot Detail Screen

**Route:** `/app/investments/savings/$id`

- **Header** — back arrow, pot name, "Savings pot" subtitle, "Edit" button
- **Hero card** — blue gradient; current balance, return % (if deposits exist)
- **Stats row** (2 tiles) — Total deposited | Deposit count
- **Add deposit** — dashed-border button opens inline form: Amount, Date, Notes (optional). On submit: creates `InvestmentDeposit` row, syncs `investedAmount`
- **Deposit history** — chronological list (newest first); each row: date, notes, amount (+formatted). Remove button (X) with inline confirm/cancel
- **Edit form** — update name and current balance
- **Delete** with confirmation

### 5.15 EMIs List Screen

**Route:** `/app/emis`

- **Summary Card** — Active EMIs count | Monthly outflow | Total remaining balance
- **Type filter pills** — All | Bank Loan | Credit Card
- **EMI cards** — type icon + label, EMI amount/month, remaining balance, progress bar (paid/total months), next due date
- Tapping → EMI Detail
- **FAB "+"** → Add EMI form
- **Empty state** when no EMIs

### 5.16 Add EMI Screen

**Route:** `/app/emis/new`

- Fields: Label, Type (Bank Loan / Credit Card toggle), Principal, Annual Interest Rate (%), Tenure (months), Start date
- **Live EMI Preview** — auto-calculates as user types: Monthly EMI | Total Payment | Total Interest
- "Create EMI" button
- On submit: creates EMI row + generates all `EmiPayment` rows upfront

### 5.17 EMI Detail Screen

**Route:** `/app/emis/$emiId`

- **Header** — back arrow, label, type badge
- **Remaining balance** hero card
- **Key stats** (3 tiles) — Paid months | Remaining months | Total interest paid
- **Principal vs Interest donut chart** — lazy-loaded Recharts pie showing loan lifetime split
- **Amortization schedule** — scrollable table; columns: #, Due Date, EMI, Principal, Interest, Balance. Paid rows muted + strikethrough. Overdue rows highlighted. Checkbox per row for mark paid (optimistic update with rollback on error).
- **Delete** with confirmation (cascade deletes all payment rows)

### 5.18 Profile / Settings Screen

**Route:** `/app/profile`

Organized into themed sections (Header → Preferences → Account → Developer tools).

**Header**

- **Avatar** — Gravatar (SHA-256 hash of email) or user-uploaded image. Tap to open camera/gallery picker. Uploading sets `user.image` via Better Auth `updateUser`.
- **Name** — Editable inline (Pencil icon). Saves to both `Profile.fullName` and `User.name`.
- **Email** — Read-only.

**Preferences**

- **Currency** — BDT / USD selector (two tonal tiles). Saved to `Profile.preferredCurrency` + `User.preferredCurrency`. Triggers router invalidation so all formatted amounts re-render in the new currency.
- **Payment reminders** — Push notification toggle. Requests `Notification` permission and subscribes to `PushManager` using `VITE_VAPID_PUBLIC_KEY`. Handles the three permission states (granted / denied / unsupported) with distinct helper copy. Subscription endpoint is persisted server-side so the cron worker can push to it.

**Account**

- **Activity history** — Link to `/app/activity` (full audit log of create/update/delete actions across investments, deposits, withdrawals, EMIs, payments, profile changes).
- **Change password** — Opens a portal-based modal (not inline) with Current / New / Confirm fields and Escape-to-close. Uses Better Auth `changePassword` endpoint; matches the style of `ConfirmModal`.
- **Sign out** — Icon and label render in the error color so the destructive action reads at a glance. Opens a confirm modal before signing out.

**Developer tools**

- **Load test data** — Opens a modal to pick which category fixtures to seed (investments, EMIs, notifications, etc.) with an option to wipe existing app data first.
- **Clear all my data** — Confirm modal, then deletes all investments, deposits, withdrawals, EMIs, payments, and notifications for the current profile. Account and profile row are preserved so sign-in still works.

### 5.19 Activity History Screen

**Route:** `/app/activity`

Full audit trail of mutations performed by the user, rendered as an infinite-scroll list.

- **Entity types tracked:** investment, investment deposit, investment withdrawal, EMI, EMI payment, profile.
- **Actions tracked:** `create`, `update`, `delete` — each rendered with a distinct icon + badge color.
- **Row content:** entity label, action verb, relative time, and a diff of changed fields (old → new) for `update` actions.
- **Pagination:** cursor-based via `useInfiniteQuery`; 15 rows per page, "Load more" button triggers `fetchNextPage`.
- **Back navigation:** `staticData.backTo = '/app/profile'` — tapping the back arrow returns to Profile where this screen was launched from.

### 5.20 Notification Center

**Trigger:** Notification bell in TopBar (shows unread count badge)

- **List** — All notifications sorted by unread first, then newest. Each: title, body, relative time, read/unread indicator. Tapping a notification with a link navigates to the linked screen and marks it read.
- **Mark all read** button.
- Notifications are synced lazily when the bell endpoint is hit — idempotent via `dedupeKey`.

**Notification types generated:**

| Type                      | Trigger                           |
| ------------------------- | --------------------------------- |
| `investment.created`      | Lump-sum investment added         |
| `dps.created`             | DPS scheme created                |
| `emi.payment.due`         | EMI payment due within 3 days     |
| `emi.payment.overdue`     | EMI payment past due date         |
| `dps.installment.due`     | DPS installment due within 3 days |
| `dps.installment.overdue` | DPS installment past due date     |

---

## 6. Navigation Structure

### 6.1 Bottom Tab Bar

Persistent bottom navigation visible on all main `/app/*` routes. Hidden on sub-screens.

| Tab | Icon       | Label   | Route              | Active Condition   |
| --- | ---------- | ------- | ------------------ | ------------------ |
| 1   | Home       | Home    | `/app`             | Exact match `/app` |
| 2   | TrendingUp | Invest  | `/app/investments` | Starts with path   |
| 3   | Receipt    | EMIs    | `/app/emis`        | Starts with path   |
| 4   | User       | Profile | `/app/profile`     | Starts with path   |

### 6.2 Route Map

| Route                          | Screen                   | Tab Bar | Auth     |
| ------------------------------ | ------------------------ | ------- | -------- |
| `/`                            | Landing page             | No      | Redirect |
| `/login`                       | Login                    | No      | Redirect |
| `/signup`                      | Signup                   | No      | Redirect |
| `/check-email`                 | Email verification wait  | No      | No       |
| `/forgot-password`             | Forgot password          | No      | No       |
| `/app`                         | Home / Dashboard         | Yes     | Required |
| `/app/investments`             | Investments list         | Yes     | Required |
| `/app/investments/new`         | Add lump-sum investment  | Hidden  | Required |
| `/app/investments/$id/edit`    | Edit lump-sum investment | Hidden  | Required |
| `/app/investments/dps/new`     | Add DPS scheme           | Hidden  | Required |
| `/app/investments/dps/$id`     | DPS detail               | Hidden  | Required |
| `/app/investments/savings/new` | Add savings pot          | Hidden  | Required |
| `/app/investments/savings/$id` | Savings pot detail       | Hidden  | Required |
| `/app/emis`                    | EMIs list                | Yes     | Required |
| `/app/emis/new`                | Add EMI                  | Hidden  | Required |
| `/app/emis/$emiId`             | EMI detail               | Hidden  | Required |
| `/app/profile`                 | Profile / settings       | Yes     | Required |

---

## 7. Data Flow Architecture

### 7.1 Pattern

```
Client Component
  → TanStack Query (useQuery / useMutation)
    → createServerFn() handler
      → dynamic import('./investments.impl')   ← keeps Prisma out of client bundle
        → Better Auth session check (requireProfileId)
          → Prisma query scoped by profileId
            → PostgreSQL (Neon)
```

### 7.2 Server Files Convention

- `src/server/*.ts` — thin wrappers: `createServerFn` + `inputValidator` only. No Prisma imports.
- `src/server/*.impl.ts` — all business logic, Prisma calls, notifications. Dynamically imported inside handler bodies.

### 7.3 Query Key Structure

| Feature                   | Query Key                                   | Invalidated By                   |
| ------------------------- | ------------------------------------------- | -------------------------------- |
| Investments list          | `['investments', 'list', { status, type }]` | Any investment mutation          |
| Investment detail         | `['investments', 'detail', id]`             | Update, mark deposit paid/unpaid |
| EMIs list                 | `['emis', 'list', { type }]`                | Create / delete EMI              |
| EMI detail + payments     | `['emis', 'detail', emiId]`                 | Mark payment paid/unpaid         |
| Dashboard stats           | `['dashboard-stats']`                       | Any investment or EMI mutation   |
| Notifications list        | `['notifications']`                         | Mark read, mark all read         |
| Notification unread count | `['notifications', 'unread-count']`         | Mark read, mark all read         |
| Profile                   | `['profile']`                               | Name / currency update           |

### 7.4 Optimistic Updates

- **Mark EMI payment paid/unpaid** — flips `status` in cached detail immediately; rolls back on error.
- **Mark DPS deposit paid/unpaid** — flips `status` in cached detail immediately; rolls back on error.

---

## 8. Business Logic

### 8.1 Investment Modes

#### Lump-sum (`mode = 'lump_sum'`)

- `type` ∈ `stock | mutual_fund | fd | gold | crypto | other`
- `investedAmount` and `currentValue` are user-entered and stored directly.
- Can be marked Completed: requires `exitValue` and `completedAt`.
- Return % active: `((currentValue − investedAmount) / investedAmount) × 100`
- Return % completed: `((exitValue − investedAmount) / investedAmount) × 100`

#### Scheduled / DPS (`mode = 'scheduled'`, `type = 'dps'`)

- Fixed `monthlyDeposit`, `tenureMonths`, `interestRate`, `interestType` set at creation.
- Full `InvestmentDeposit` schedule generated upfront by `generateDpsSchedule()`.
- `investedAmount` and `currentValue` are automatically synced to `SUM(paid deposits)` on every mark-paid mutation.
- Auto-maturation: when all deposits are marked paid, `status` is set to `matured`.

**DPS Schedule Formulas** (`src/lib/dps-calculator.ts`)

Let D = monthly deposit, r = annualRate / 1200 (monthly rate), n = installment number.

- **Compound interest:**
  - If r > 0: `accruedValue(n) = D × (1 + r) × [(1 + r)^n − 1] / r`
  - If r = 0: `accruedValue(n) = D × n`
- **Simple interest:**
  - `accruedValue(n) = D × n + D × r × n × (n + 1) / 2`

Each row's `dueDate` = `startDate + (n − 1) months`.

#### Flexible / Savings (`mode = 'flexible'`, `type = 'savings'`)

- No tenure, interest rate, or pre-generated schedule.
- Deposits are added ad-hoc via the detail screen (amount + date + optional notes).
- `investedAmount` is synced = `SUM(all deposits)` on every add/remove mutation.
- `currentValue` is user-set (reflects actual bank balance, including any interest earned).
- Deposits can be individually removed; each removal re-syncs `investedAmount`.

### 8.2 EMI Amortization

When an EMI is created, all `EmiPayment` rows are generated upfront (`src/lib/emi-calculator.ts`).

- **Monthly rate:** `r = annualInterestRate / 12 / 100`
- **EMI formula:** `EMI = P × r × (1 + r)^n / ((1 + r)^n − 1)`. If `r = 0`: `EMI = P / n`.
- **Each month (1 to n):** `interest = remainingBalance × r`, `principal = EMI − interest`, `newBalance = remainingBalance − principal`
- **Final payment** absorbs floating-point residuals so `remainingBalance` lands at exactly `0.00`.
- **Due dates:** `startDate + (paymentNumber − 1) months`
- **Overdue detection:** client-side on load (`dueDate < today && status ≠ 'paid'`)

### 8.3 Dashboard Calculations

- **Net Worth** = `Σ active investments currentValue` − `Σ active EMIs remainingBalance` (from each EMI's first unpaid payment row)
- **Monthly EMI Outflow** = `Σ emiAmount` for all active EMIs
- **Upcoming Payments** = next 5 `EmiPayment` rows where `status ≠ 'paid'` and `dueDate ≤ today + 30 days`, ordered by `dueDate ASC`
- **Investment Allocation** = group active investments by `type`, sum `currentValue` per type

### 8.4 Notification Sync

`syncDerivedNotifications(profileId)` runs lazily whenever the notification bell endpoint is hit. It scans:

- EMI payments with `status ≠ 'paid'` and `dueDate` within the next 3 days → `emi.payment.due`
- EMI payments with `status ≠ 'paid'` and `dueDate < now` → `emi.payment.overdue`
- DPS deposits (`mode = 'scheduled'`) with `status ≠ 'paid'` and `dueDate` within 3 days → `dps.installment.due`
- DPS deposits with `status ≠ 'paid'` and `dueDate < now` → `dps.installment.overdue`

Each notification is created via an idempotent upsert keyed on `(profileId, dedupeKey)`. Existing notifications (including read state) are never overwritten.

### 8.5 Money Handling

- All money fields are `Decimal(15, 2)` in Prisma — stored in PostgreSQL as exact decimals.
- Money values are serialized to `String` when crossing the server/client boundary (`String(prismaDecimal)`).
- Never coerce to JS `number` for arithmetic; accumulate as `Number(stringValue)` only for summation, then `toFixed(2)` back to string before storing.

---

## 9. Progressive Web App

- **Manifest** (`public/site.webmanifest`) — `display: standalone`, `orientation: portrait`, `theme_color: #0b1326`. Icons at 16, 32, 180, 192 (maskable), 512 (maskable) px.
- **Service worker** — owned at `src/sw.ts` (Workbox `injectManifest` strategy) so the app can add push + `notificationclick` handlers alongside precache. Registered manually in `__root.tsx` — no injected tag, avoiding SSR hydration conflicts. `navigateFallback: null` (all routes must hit the server for SSR). A `scripts/copy-sw-to-vercel.mjs` post-build step copies the compiled SW into Vercel's static output.
- **Precache** — hashed JS, CSS, fonts, images. Runtime caching: JS/CSS (CacheFirst 30d), images (CacheFirst 7d), Google Fonts (CacheFirst 365d).
- **Auto-update** — `registerType: 'autoUpdate'`; new SW takes over on next page load.
- **Dev** — service worker disabled in development (`devOptions.enabled: false`).
- **Safe-area handling** — installed PWAs reserve `env(safe-area-inset-top)` under the iOS Dynamic Island / notch and `env(safe-area-inset-bottom)` above the home indicator. Page padding and the bottom tab bar both respect these insets.

### 9.1 Web Push Notifications

- **VAPID keypair** — generated once via `npx web-push generate-vapid-keys`. Private key lives server-side (`VAPID_PRIVATE_KEY`); public key is duplicated to the client as `VITE_VAPID_PUBLIC_KEY` for `PushManager.subscribe()`.
- **Subscribe flow** — user toggles "Payment reminders" in Profile → Preferences. `usePushSubscription` hook orchestrates `Notification.requestPermission()` → `sw.pushManager.subscribe()` → persists the `PushSubscription` to the server.
- **Deliver flow** — a Vercel cron endpoint (`/api/cron/send-reminders`, guarded by `CRON_SECRET`) runs on a schedule, calls `syncDerivedNotifications()`, and fans out to each active subscription via `web-push`. The service worker's `push` handler renders the notification; `notificationclick` routes to the linked screen.
- **Permission states** — granted, denied, `default`, and unsupported are all handled distinctly in the Profile UI. Denied users see a helper line explaining they must re-enable in browser settings.

---

## 10. Performance & Deployment Optimizations

### 10.1 Intent-preload with cache-aware loaders

- Router is configured with `defaultPreload: 'intent'` + `defaultPreloadStaleTime: 30s`, so hover / touch-start on a tab warms data before the click lands.
- The four primary tabs (`/app`, `/app/investments`, `/app/emis`, `/app/activity`) each expose a `loader` that calls `queryClient.ensureQueryData()` (or `ensureInfiniteQueryData()` for activity) against the default view — hover → prefetch → mount-with-data, no skeleton flash.
- Shared `queryOptions` factories live in the hook files so the loader and `useQuery` call use identical keys and fetchers.

### 10.2 Client-side query cache defaults

- `QueryClient` is configured with `defaultOptions.queries.staleTime: 60s` and `gcTime: 5m`, so back-navigation between screens hits the cache instead of triggering a fresh RPC. Mutation `onSuccess` callbacks still call `invalidateQueries` to bust the cache when data actually changes.

### 10.3 Build-time prerendering

- Nitro is configured with `prerender.routes: ['/', '/login', '/signup', '/check-email', '/forgot-password']` and `crawlLinks: false`. These public pages are generated as static HTML at build time and served from Vercel's CDN — near-zero TTFB, no serverless cold starts.
- Authenticated `/app/*` routes remain server-rendered per request since they need the session cookie.

### 10.4 Global tap feedback

- A single zero-specificity `:where(…):active` rule in `src/styles.css` applies a 120ms `transform: scale(0.97)` across every interactive element (`button`, `a`, `[role="button"]`, form inputs, etc.). Component-level `active:scale-*` overrides and `.btn-primary:active` still win because `:where()` contributes no specificity. `prefers-reduced-motion: reduce` disables the scale.

---

## 11. Implementation Status

### ✅ Phase 1 — Foundation

- TanStack Start project, Tailwind CSS v4, Vite 8
- Neon PostgreSQL, Prisma 7 with pg adapter
- Better Auth: email/password, email verification, password reset
- Branded HTML emails (Resend)
- Auth screens: Login, Signup, Check Email, Forgot Password
- Route protection via `beforeLoad` session guards

### ✅ Phase 2 — App Shell

- Bottom tab bar navigation (Home, Invest, EMIs, Profile)
- TopBar with notification bell
- Dark-only "Digital Private Bank" design system
- Profile screen: avatar, name, currency, password, logout
- Landing page with full marketing sections

### ✅ Phase 3 — Investments

- **Lump-sum**: CRUD, status toggle (active → completed), exit value, return %
- **DPS (scheduled)**: create with tenure + interest, auto-generated schedule, mark-paid per installment, auto-maturation, notifications
- **Savings (flexible)**: create pot, add/remove ad-hoc deposits, manual balance update
- Unified `Investment` + `InvestmentDeposit` schema (single model for all three modes)
- Unified investments list: type filter pills (All/Stocks/MF/FD/Gold/Crypto/DPS/Savings/Other), status tabs, summary card
- Mode-specific cards (lump-sum card, DPS card, savings card)
- FABMenu with three creation options

### ✅ Phase 4 — EMI Manager

- Create EMI with live amortization preview
- Auto-generate all payment rows on creation
- EMI list with type filter, summary stats
- EMI detail: full amortization schedule, mark paid (optimistic), principal/interest donut chart
- Delete with confirmation

### ✅ Phase 5 — Dashboard & Polish

- Net worth calculation + hero card
- Portfolio allocation donut chart (lazy-loaded)
- Upcoming payments list (30-day window)
- Notification system (bell, unread count, lazy sync, idempotent)
- Loading skeletons on all list views
- Empty states with CTAs on all list screens
- PWA (installable, precached, auto-update)
- Vercel Analytics + Speed Insights

### ✅ Phase 6 — Engagement & Performance

- Web push notifications for upcoming / overdue EMI and DPS installments (VAPID + Vercel cron worker)
- Activity history screen with infinite-scroll cursor pagination
- Investment withdrawals (partial + close) and DPS premature closure
- Profile dev tools: seed fixtures, full-profile data wipe
- Route loaders + tuned query / preload stale-times for instant tab switches
- Build-time prerendering of public marketing / auth pages via Nitro
- Global tap / press animation on all interactive elements
- PWA safe-area insets (Dynamic Island + home indicator)

---

## 12. File Structure

```
phinio/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── public/
│   ├── site.webmanifest
│   └── icons/
├── src/
│   ├── generated/prisma/          # Prisma client output (never edit)
│   ├── routes/
│   │   ├── __root.tsx             # HTML shell, theme, SW registration
│   │   ├── index.tsx              # Landing page (/)
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   ├── check-email.tsx
│   │   ├── forgot-password.tsx
│   │   ├── api/auth/$.ts          # Better Auth catch-all handler
│   │   └── app/
│   │       ├── route.tsx          # App layout (TopBar + BottomTabBar + auth guard)
│   │       ├── index.tsx          # Home / Dashboard
│   │       ├── profile.tsx
│   │       └── investments/
│   │           ├── index.tsx      # Unified investments list
│   │           ├── new.tsx        # Add lump-sum
│   │           ├── $id.edit.tsx   # Edit lump-sum
│   │           ├── dps/
│   │           │   ├── new.tsx
│   │           │   └── $id.tsx
│   │           └── savings/
│   │               ├── new.tsx
│   │               └── $id.tsx
│   │       └── emis/
│   │           ├── index.tsx
│   │           ├── new.tsx
│   │           └── $emiId.tsx
│   ├── components/
│   │   ├── BottomTabBar.tsx
│   │   ├── TopBar.tsx
│   │   ├── NotificationBell.tsx
│   │   ├── Logo.tsx
│   │   ├── AllocationDonut.tsx    # Lazy-loaded
│   │   ├── PrincipalInterestDonut.tsx # Lazy-loaded
│   │   └── ui/
│   │       ├── Card.tsx
│   │       ├── EmptyState.tsx
│   │       ├── FAB.tsx
│   │       ├── FABMenu.tsx
│   │       ├── FilterPills.tsx
│   │       ├── ProgressBar.tsx
│   │       ├── Skeleton.tsx
│   │       └── TextField.tsx      # + TextArea
│   ├── server/
│   │   ├── investments.ts         # Server function wrappers (no Prisma imports)
│   │   ├── investments.impl.ts    # All investment business logic
│   │   ├── emis.ts
│   │   ├── emis.impl.ts
│   │   ├── dashboard.ts
│   │   ├── dashboard.impl.ts
│   │   ├── notifications.ts
│   │   ├── notifications.impl.ts
│   │   ├── profile.ts
│   │   ├── profile.impl.ts
│   │   └── auth.ts
│   ├── hooks/
│   │   ├── useInvestments.ts      # All investment modes + deposits
│   │   ├── useEmis.ts
│   │   ├── useDashboard.ts
│   │   └── useNotifications.ts
│   ├── lib/
│   │   ├── auth.ts                # Better Auth server config
│   │   ├── auth-client.ts         # Better Auth client config
│   │   ├── calculations.ts        # Return %, format helpers
│   │   ├── cn.ts                  # Tailwind class merge
│   │   ├── currency.ts            # formatCurrency, getCurrencySymbol
│   │   ├── dps-calculator.ts      # DPS schedule generator (simple + compound)
│   │   ├── emi-calculator.ts      # EMI formula + amortization generator
│   │   └── validators.ts          # All Zod schemas
│   ├── db.ts                      # Prisma singleton (globalThis.__prisma)
│   ├── router.tsx                 # Router construction + QueryClient
│   └── styles.css                 # Tailwind v4 + all design tokens
├── .env.local                     # Not committed
├── .env.example
├── vite.config.ts
├── eslint.config.js
├── prettier.config.js
├── tsconfig.json
└── package.json
```

---

## 13. Environment Variables

| Variable                | Description                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | Pooled Neon connection string (used at runtime via PgBouncer)                                   |
| `DIRECT_URL`            | Direct Neon connection string (used by `prisma migrate deploy`)                                 |
| `BETTER_AUTH_SECRET`    | Random secret — generate with `npx -y @better-auth/cli secret`                                  |
| `BETTER_AUTH_URL`       | Full app URL (e.g. `http://localhost:3000` in dev, Vercel URL in prod)                          |
| `RESEND_API_KEY`        | API key from Resend dashboard                                                                   |
| `RESEND_FROM`           | Verified sender address, e.g. `Phinio <noreply@yourdomain.com>`                                 |
| `VAPID_PUBLIC_KEY`      | Web-push VAPID public key — generate with `npx web-push generate-vapid-keys`                    |
| `VAPID_PRIVATE_KEY`     | Web-push VAPID private key (server-only, never exposed to client)                               |
| `VAPID_SUBJECT`         | `mailto:` or `https:` URI the browser can reach for subscription administration                 |
| `VITE_VAPID_PUBLIC_KEY` | Client-exposed copy of `VAPID_PUBLIC_KEY` (must be identical) — used by `PushManager.subscribe` |
| `CRON_SECRET`           | Guards `/api/cron/send-reminders`; generate with `openssl rand -hex 32`                         |

> **`BETTER_AUTH_URL` gotcha:** Better Auth embeds this URL verbatim into every email link. In dev it must be `http://localhost:3000`; in `npm run preview:local` (port 4173) set it to `http://localhost:4173` or links will 404.

---

## 14. Commands

```bash
npm run dev             # Vite dev server on :3000
npm run build           # Production build (Vercel-env-only: prisma migrate deploy + generate + vite build + sw copy)
npm run build:local     # Same chain wrapped in dotenv -e .env.local so it runs against local env
npm run preview         # Preview a prod build (expects host-provided env)
npm run preview:local   # dotenv-wrapped preview for local testing
npm run test            # Vitest (run once)
npm run lint            # ESLint
npm run check           # prettier --write + eslint --fix (run before committing)

npm run db:generate     # prisma generate (after schema changes)
npm run db:push         # push schema to DB without migration (dev)
npm run db:migrate      # prisma migrate dev
npm run db:studio       # Prisma Studio
npm run db:seed         # Seed test data
```

All `db:*` scripts are wrapped in `dotenv -e .env.local` — always use them, not raw `npx prisma`, or `DATABASE_URL` won't resolve. The same rule is why `build:local` / `preview:local` exist: the bare `build` / `preview` expect Vercel-provided env and will fail locally with `PrismaConfigEnvError` otherwise.

---

## 15. Future Enhancements (Post-MVP)

- Email reminders (complement to push) for upcoming payments
- Multi-currency portfolio with live exchange rates
- CSV / Excel export of investment portfolio and EMI schedules
- Goal-based savings targets on savings pots
- Budget tracking and expense categories
- Social login (Google) via Better Auth OAuth providers
- PWA offline data access (background sync)
- Bulk import from bank statements
