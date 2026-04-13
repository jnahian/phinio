# PHINIO — Product Requirements Document

**Personal Finance Management App**
Version 1.0 | April 2026 | Status: MVP

---

## 1. Product Overview

| | |
|---|---|
| **App Name** | Phinio |
| **Platform** | Mobile-first Progressive Web App (optimized for mobile browsers, native app feel) |
| **Target Users** | General public — anyone wanting to track investments and manage EMI payments |
| **Currency Support** | BDT (৳) and USD ($) — user selects preferred currency at signup |

Phinio is a mobile-first personal finance app that helps users track their investment portfolio and manage EMI (Equated Monthly Installment) payments for bank loans and credit cards in one unified dashboard. The app provides a clear picture of net worth, investment returns, and upcoming payment obligations.

---

## 2. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend Framework | **TanStack Start** | Full-stack React framework with file-based routing, SSR, server functions |
| Server/API | **TanStack Start Server Functions** | Type-safe server-side logic via `createServerFn()` |
| Data Fetching | **TanStack Query** | Client-side caching, mutations, optimistic updates, background refetch |
| ORM | **Prisma** | Type-safe database access, migrations, schema management |
| Database | **PostgreSQL** (via Neon) | Serverless Postgres for structured financial data |
| Authentication | **Better Auth** | Framework-agnostic auth library with email/password, session management |
| Styling | **Tailwind CSS** | Mobile-first utility classes |
| Charts | **Recharts** | Lightweight, React-native charting |
| Date Utilities | **date-fns** | EMI schedule date calculations |
| Validation | **Zod** | Schema validation for forms and server functions |
| Hosting | **Vercel / Netlify** | Edge deployment with SSR support |

---

## 3. User Authentication (Better Auth)

### 3.1 Signup

- Fields: Full Name, Email, Password, Preferred Currency (BDT/USD)
- Better Auth email/password registration
- No email verification required — instant access after signup
- Auto-creates a profile record via Better Auth hooks/callbacks
- Redirects to `/app` (Home dashboard) on success

### 3.2 Login

- Fields: Email, Password
- Session managed by Better Auth (cookie-based, httpOnly)
- Redirects to `/app` on success

### 3.3 Forgot Password

- User enters email address
- Better Auth sends password reset email
- User clicks link, sets new password
- Redirects to login page

### 3.4 Session Management

- Protected routes use TanStack Start `beforeLoad` guards to check session via Better Auth
- Session refresh handled automatically by Better Auth client
- Logout clears session and redirects to `/login`
- Better Auth middleware integrated in TanStack Start's server context

---

## 4. Database Schema (Prisma)

### 4.1 Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Better Auth manages its own tables (user, session, account, verification)
// These are the app-specific models:

model Profile {
  id                String       @id @default(uuid())
  userId            String       @unique // FK to Better Auth user.id
  fullName          String
  preferredCurrency String       @default("BDT") // "BDT" | "USD"
  createdAt         DateTime     @default(now())
  investments       Investment[]
  emis              Emi[]
  emiPayments       EmiPayment[]

  @@map("profiles")
}

model Investment {
  id               String    @id @default(uuid())
  profileId        String
  profile          Profile   @relation(fields: [profileId], references: [id], onDelete: Cascade)
  name             String
  type             String    // "stock" | "mutual_fund" | "fd" | "gold" | "crypto" | "other"
  investedAmount   Decimal   @db.Decimal(15, 2)
  currentValue     Decimal   @db.Decimal(15, 2)
  dateOfInvestment DateTime  @db.Date
  notes            String?
  status           String    @default("active") // "active" | "completed"
  completedAt      DateTime? @db.Date
  exitValue        Decimal?  @db.Decimal(15, 2)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@map("investments")
}

model Emi {
  id           String       @id @default(uuid())
  profileId    String
  profile      Profile      @relation(fields: [profileId], references: [id], onDelete: Cascade)
  label        String
  type         String       // "bank_loan" | "credit_card"
  principal    Decimal      @db.Decimal(15, 2)
  interestRate Decimal      @db.Decimal(5, 2) // Annual interest rate %
  tenureMonths Int
  emiAmount    Decimal      @db.Decimal(15, 2) // Calculated monthly EMI
  startDate    DateTime     @db.Date
  status       String       @default("active") // "active" | "closed"
  createdAt    DateTime     @default(now())
  payments     EmiPayment[]

  @@map("emis")
}

model EmiPayment {
  id                 String    @id @default(uuid())
  emiId              String
  emi                Emi       @relation(fields: [emiId], references: [id], onDelete: Cascade)
  profileId          String
  profile            Profile   @relation(fields: [profileId], references: [id], onDelete: Cascade)
  paymentNumber      Int
  dueDate            DateTime  @db.Date
  emiAmount          Decimal   @db.Decimal(15, 2)
  principalComponent Decimal   @db.Decimal(15, 2)
  interestComponent  Decimal   @db.Decimal(15, 2)
  remainingBalance   Decimal   @db.Decimal(15, 2)
  status             String    @default("upcoming") // "paid" | "upcoming" | "overdue"
  paidAt             DateTime?

  @@map("emi_payments")
}
```

### 4.2 Computed Fields (UI-side, not stored)

| Field | Formula |
|---|---|
| Investment Return % (active) | `((currentValue - investedAmount) / investedAmount) × 100` |
| Investment Return % (completed) | `((exitValue - investedAmount) / investedAmount) × 100` |
| Profit/Loss (completed) | `exitValue - investedAmount` |
| Net Worth | `Σ active investments currentValue - Σ active EMIs remainingBalance` |

### 4.3 Authorization

All server functions validate the authenticated user's profile ID before any database operation. Users can only access their own data. Every Prisma query includes a `where: { profileId }` filter derived from the Better Auth session.

---

## 5. Screen Specifications

### 5.1 Splash / Welcome Screen

**Route:** `/`

- App logo and name "Phinio" centered
- Tagline: "Your finances, simplified."
- Two full-width buttons: "Login" and "Sign Up"
- If session exists, auto-redirect to `/app`

### 5.2 Login Screen

**Route:** `/login`

- Email input (type=email, autocomplete)
- Password input (show/hide toggle)
- "Login" full-width button
- "Forgot Password?" link → `/forgot-password`
- "Don't have an account? Sign Up" link → `/signup`
- Validation: required fields, email format, inline error messages (Zod)
- Loading state on button during auth request

### 5.3 Signup Screen

**Route:** `/signup`

- Full Name input
- Email input
- Password input (min 8 chars, show/hide toggle)
- Preferred Currency toggle: BDT / USD
- "Create Account" full-width button
- "Already have an account? Login" link → `/login`
- On success: auto-login and redirect to `/app`

### 5.4 Forgot Password Screen

**Route:** `/forgot-password`

- Email input
- "Send Reset Link" button
- Success message: "Check your email for a reset link"
- "Back to Login" link

### 5.5 Home / Overview Screen (Tab 1)

**Route:** `/app`

- Greeting: "Hi, {name}" with wave emoji
- **Net Worth Hero Card** (gradient background): `net_worth = total_current_investment_value - total_remaining_emi_balance`
- **Quick Stats Row** (2 cards): Total Investment Value with gain/loss % | Monthly EMI Outflow total
- **Upcoming Payments Section**: list of next 5 EMI payments due within 30 days, each showing: EMI label, amount, due date, days until due. Tapping navigates to EMI detail
- **Investment Summary Mini-Chart**: donut chart of investment allocation by type

### 5.6 Investments List Screen (Tab 2)

**Route:** `/app/investments`

- **Summary Card** at top: Total Invested | Current Value | Total Returns (amount + %)
- **Filter Pills** (horizontal scroll): All | Stocks | Mutual Fund | FD | Gold | Crypto | Other
- **Active/Completed toggle** tabs to switch between active and completed (sold) investments
- **Investment Cards** list, each showing: name, type badge (color-coded), invested amount, current value (or exit value if completed), return % (green positive / red negative), date
- **Empty state**: illustration + "Add your first investment" message
- **FAB "+"** button (bottom-right) → opens Add Investment form

### 5.7 Add/Edit Investment Screen

**Route:** `/app/investments/new` and `/app/investments/$id/edit`

- Full-page form with back arrow at top
- **Fields**: Name (text), Type (dropdown: Stock, Mutual Fund, FD, Gold, Crypto, Other), Date of Investment (date picker), Invested Amount (number), Current Value (number), Notes (optional textarea)
- For editing completed investments, additional fields: Status toggle (Active/Completed), Exit Value (number, shown when completed), Completed Date (date picker, shown when completed)
- "Save" full-width button at bottom
- Validation: all required fields, amounts must be > 0 (Zod schema)
- Delete option with confirmation dialog

### 5.8 EMIs List Screen (Tab 3)

**Route:** `/app/emis`

- **Summary Card** at top: Active EMIs Count | Monthly Outflow Total | Total Remaining Balance
- **Filter Pills**: All | Bank Loan | Credit Card
- **EMI Cards** list, each showing: label, type badge (Bank Loan = blue, Credit Card = purple), EMI amount/month, progress bar (paid months / total months), next due date, remaining balance
- Tapping a card → navigates to EMI Detail screen
- **Empty state**: illustration + "Add your first EMI" message
- **FAB "+"** button → opens Add EMI form

### 5.9 Add EMI Screen

**Route:** `/app/emis/new`

- Full-page form with back arrow
- **Fields**: Label (text), Type (Bank Loan / Credit Card toggle), Principal Amount (number), Annual Interest Rate (% number), Tenure in Months (number), Start Date (date picker)
- **Live EMI Preview Card**: as user fills in principal, rate, and tenure, auto-calculates and displays: Monthly EMI amount, Total Payment (EMI × tenure), Total Interest (total payment - principal)
- "Create EMI" full-width button
- On submit: creates EMI record + auto-generates all `emi_payments` rows with amortization breakdown

### 5.10 EMI Detail Screen

**Route:** `/app/emis/$emiId`

- Back arrow + EMI label as page title + type badge
- **Key Stats Row** (3 cards): Monthly EMI Amount | Remaining Months | Total Interest Paid so far
- **Principal vs Interest Donut Chart**: visual split of total principal vs total interest over loan lifetime
- **Amortization Schedule Table** (scrollable): columns — #, Due Date, EMI, Principal, Interest, Balance. Each row has a checkbox to mark as Paid. Paid rows are visually muted/greyed. Overdue rows (past due date + unpaid) highlighted red
- **Summary Footer**: Total Paid | Total Remaining | Completion %
- Delete EMI option with confirmation (cascade deletes all payment rows)

### 5.11 Profile / Settings Screen (Tab 4)

**Route:** `/app/profile`

- User avatar (initials-based, generated from name)
- Display: Full Name, Email
- Currency Preference: BDT / USD toggle (updates profile)
- Theme Toggle: Light / Dark mode
- "Logout" button with confirmation
- App version display at bottom

---

## 6. Navigation Structure

### 6.1 Bottom Tab Bar

Persistent bottom navigation bar visible on all `/app/*` main routes. Four tabs:

| Tab | Icon | Label | Route |
|---|---|---|---|
| 1 | Home/Dashboard | Home | `/app` |
| 2 | Trending-up | Investments | `/app/investments` |
| 3 | Calendar/Receipt | EMIs | `/app/emis` |
| 4 | User/Settings | Profile | `/app/profile` |

- Active tab: filled icon + accent color + label visible
- Inactive tabs: outline icon + muted color
- Tab bar height: 60–64px with safe area padding for notched devices
- Tab bar hidden on sub-screens (add/edit forms, EMI detail)

### 6.2 Route Map

| Route | Screen | Layout | Auth |
|---|---|---|---|
| `/` | Splash/Welcome | Public (no tab bar) | Redirect if logged in |
| `/login` | Login | Public | Redirect if logged in |
| `/signup` | Signup | Public | Redirect if logged in |
| `/forgot-password` | Forgot Password | Public | No |
| `/app` | Home Overview | App (tab bar) | Required |
| `/app/investments` | Investments List | App (tab bar) | Required |
| `/app/investments/new` | Add Investment | Sub-screen (back arrow) | Required |
| `/app/investments/$id/edit` | Edit Investment | Sub-screen (back arrow) | Required |
| `/app/emis` | EMIs List | App (tab bar) | Required |
| `/app/emis/new` | Add EMI | Sub-screen (back arrow) | Required |
| `/app/emis/$emiId` | EMI Detail | Sub-screen (back arrow) | Required |
| `/app/profile` | Profile/Settings | App (tab bar) | Required |

---

## 7. Data Flow Architecture

### 7.1 TanStack Start Server Functions

All data operations use `createServerFn()` for type-safe, server-side Prisma calls:

```
Client Component
  → TanStack Query (useQuery / useMutation)
    → Server Function (createServerFn)
      → Better Auth session check
        → Prisma query (with profileId filter)
          → PostgreSQL
```

### 7.2 Query Key Structure

| Feature | Query Key | Invalidation Trigger |
|---|---|---|
| Investments list | `["investments", { status, type }]` | After add/edit/delete investment |
| Single investment | `["investments", id]` | After edit |
| EMIs list | `["emis", { type }]` | After add/delete EMI |
| Single EMI + payments | `["emis", emiId]` | After mark paid/unpaid |
| Dashboard stats | `["dashboard-stats"]` | After any investment or EMI mutation |
| Profile | `["profile"]` | After profile update |
| Upcoming payments | `["upcoming-payments"]` | After mark paid/unpaid |

### 7.3 Mutation Pattern

```
useMutation({
  mutationFn: serverFunction,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: [...] })
    // toast notification
    // navigate if needed
  }
})
```

Optimistic updates for mark-paid/unpaid toggle on EMI payments for instant UI feedback.

---

## 8. UI/UX Design Guidelines

### 8.1 Mobile-First Principles

- All designs target 375px width (iPhone SE/standard) as base
- Touch targets: minimum 44px height for all tappable elements
- Side padding: 16px consistent on all screens
- No sidebar navigation — everything stacks vertically
- Bottom sheet / slide-up panels for secondary actions

### 8.2 Visual Design

- Card-based layout: rounded corners (12–16px), subtle shadows
- Gradient hero cards for summary stats at top of pages
- Color-coded badges: investment types, EMI types
- Green (#22C55E) for positive returns/gains, Red (#EF4444) for negative/losses
- Progress bars for EMI completion tracking
- FAB (Floating Action Button) on list screens for "Add" action
- Dark/Light theme support via CSS variables

### 8.3 Interaction Patterns

- Page transitions: slide-in from right for detail/sub-screens
- Back arrow top-left on all sub-screens
- Confirmation dialogs for destructive actions (delete)
- Loading skeletons while data fetches
- Toast notifications for success/error feedback
- Empty states with illustrations and CTA on all list screens

---

## 9. Business Logic

### 9.1 Investment Management

- Single entry for one-time investments (FD, gold purchase)
- Multiple entries allowed for recurring investments (SIP in mutual funds, regular stock purchases) — each entry is a separate row with its own date and amount
- Marking as "Completed": user sets status to completed, enters exit_value and completed_at date
- **Profit/Loss** (on completion): `exit_value - invested_amount`
- **Return %** (active): `((currentValue - investedAmount) / investedAmount) × 100`
- **Return %** (completed): `((exitValue - investedAmount) / investedAmount) × 100`
- Portfolio totals only include "active" investments unless user toggles to view completed

### 9.2 EMI Calculation & Amortization

When an EMI is created, the system auto-generates all monthly payment rows:

- **Monthly rate**: `r = annual_interest_rate / 12 / 100`
- **EMI formula**: `EMI = P × r × (1+r)^n / ((1+r)^n - 1)`
- **For each month** (1 to n): `interest_component = remaining_balance × r`, `principal_component = EMI - interest_component`, `new_remaining = remaining_balance - principal_component`
- **Due dates**: `start_date + (payment_number - 1) months`
- **Payment status logic**: "paid" (user marked), "overdue" (due_date < today AND not paid), "upcoming" (default)
- Overdue detection runs on page load (client-side check)

### 9.3 Dashboard Calculations

- **Net Worth** = Σ active investments `currentValue` − Σ active EMIs `remainingBalance` (from last unpaid payment row)
- **Monthly EMI Outflow** = Σ `emiAmount` for all active EMIs
- **Upcoming Payments** = Next 5 `emiPayments` where status ≠ "paid" AND `dueDate` within 30 days, ordered by `dueDate` ASC
- **Investment Allocation** = Group active investments by type, sum `currentValue` per type for donut chart

---

## 10. Implementation Phases

### Phase 1: Foundation

- TanStack Start project scaffolding with Tailwind CSS
- PostgreSQL database setup (Neon)
- Prisma schema, initial migration
- Better Auth configuration (email/password, session)
- Auth screens: Login, Signup, Forgot Password
- Session-based route protection via `beforeLoad`

### Phase 2: App Shell

- App layout with bottom tab bar navigation
- Home screen shell with greeting
- Profile screen with logout and currency preference
- Theme toggle (dark/light) with CSS variables
- Empty states for all list screens

### Phase 3: Investments

- Server functions for investment CRUD (Prisma)
- TanStack Query hooks for investments
- Investments list page with summary card and filter pills
- Add Investment form with Zod validation
- Edit Investment with status change (active → completed)
- Delete with confirmation

### Phase 4: EMI Manager

- Server functions for EMI CRUD + amortization generation
- TanStack Query hooks for EMIs and payments
- EMIs list page with summary card and filter pills
- Add EMI form with live EMI preview calculation
- Auto-generate amortization schedule on EMI creation
- EMI Detail page with payment schedule table
- Mark payments as paid/unpaid (optimistic updates)
- Principal vs Interest donut chart

### Phase 5: Dashboard & Polish

- Dashboard server function aggregating investments + EMIs
- Net worth calculation and hero card
- Upcoming payments section on home screen
- Investment allocation donut chart
- Loading skeletons and error handling
- Page transition animations
- Final responsive testing and bug fixes

---

## 11. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Performance | First Contentful Paint < 1.5s on 4G mobile |
| Responsiveness | Optimized for 320px–428px viewport, functional up to 768px |
| Accessibility | WCAG 2.1 AA — proper labels, contrast ratios, keyboard nav |
| Security | Server-side auth checks on all data operations, HTTPS only |
| Browser Support | Chrome, Safari, Firefox (latest 2 versions) on iOS and Android |
| PWA | Add to Home Screen support, app-like full-screen mode (future) |
| Data Privacy | All queries scoped to authenticated user's profileId |

---

## 12. Future Enhancements (Post-MVP)

- Push notifications / email reminders for upcoming EMI payments
- Multi-currency portfolio with live exchange rates
- CSV/Excel export of investment portfolio and EMI schedules
- Recurring investment auto-tracker (SIP reminders)
- Budget tracking and expense categories
- Goal-based savings tracker
- PWA offline support with local caching
- Social login (Google, GitHub) via Better Auth providers

---

## 13. File Structure (Reference)

```
phinio/
├── app/
│   ├── routes/
│   │   ├── __root.tsx              # Root layout, Better Auth provider
│   │   ├── index.tsx               # Splash / Welcome
│   │   ├── login.tsx               # Login
│   │   ├── signup.tsx              # Signup
│   │   ├── forgot-password.tsx     # Forgot Password
│   │   └── app/
│   │       ├── route.tsx           # App layout (tab bar + auth guard)
│   │       ├── index.tsx           # Home / Overview
│   │       ├── investments/
│   │       │   ├── index.tsx       # Investments List
│   │       │   ├── new.tsx         # Add Investment
│   │       │   └── $id.edit.tsx    # Edit Investment
│   │       ├── emis/
│   │       │   ├── index.tsx       # EMIs List
│   │       │   ├── new.tsx         # Add EMI
│   │       │   └── $emiId.tsx      # EMI Detail
│   │       └── profile.tsx         # Profile / Settings
│   ├── components/
│   │   ├── ui/                     # Reusable UI primitives
│   │   ├── BottomTabBar.tsx
│   │   ├── SummaryHeroCard.tsx
│   │   ├── FAB.tsx
│   │   ├── ItemCard.tsx
│   │   ├── FilterPills.tsx
│   │   ├── ProgressBar.tsx
│   │   └── EmptyState.tsx
│   ├── server/
│   │   ├── auth.ts                 # Better Auth server config
│   │   ├── db.ts                   # Prisma client singleton
│   │   ├── investments.ts          # Investment server functions
│   │   ├── emis.ts                 # EMI server functions
│   │   └── dashboard.ts            # Dashboard aggregation functions
│   ├── hooks/
│   │   ├── useInvestments.ts       # TanStack Query hooks
│   │   ├── useEmis.ts
│   │   └── useDashboard.ts
│   ├── lib/
│   │   ├── emi-calculator.ts       # EMI formula + amortization generator
│   │   ├── currency.ts             # Currency formatting (BDT/USD)
│   │   └── validators.ts           # Zod schemas
│   └── styles/
│       └── globals.css             # Tailwind + CSS variables
├── prisma/
│   └── schema.prisma
├── .env
├── tailwind.config.ts
└── package.json
```
