# Phinio iOS — Design Brief

Screen inventory and per-screen component structure for the native SwiftUI (Liquid Glass) app.
Derived from `docs/Phinio_PRD_v1.md` §5–6, `docs/design.md`, and the existing web components.

---

## 1. Product

Phinio is a personal-finance app for **investment portfolio tracking** and **EMI (loan / credit-card) amortization management**. Two domains, one dashboard. Single-user, private, offline-capable.

Three investment modes, each with its own card + detail screen:

- **Lump-sum** — one-time investment (stocks, mutual fund, FD, gold, crypto, other)
- **DPS** — deposit pension scheme; fixed monthly deposit over a tenure, with interest, auto-matures
- **Savings pot** — free-form balance with ad-hoc deposits

**EMIs** — bank loan or credit card, with a full amortization schedule generated up front.

Currency is per-user: **BDT (৳)** or **USD ($)**.

---

## 2. Design language — "Modern Noir"

North star: **"The Digital Private Bank."** Editorial, nocturnal, data-first. Atmospheric depth over structural rigidity. Floating, overlapping elements — no boxed grids.

**Dark only.** There is no light mode and no theme toggle.

### Color tokens

| Role | Token | Hex |
| --- | --- | --- |
| Page base | `surface` | `#0b1326` |
| Recessed (inputs, detail rows) | `surface-container-lowest` | `#060e20` |
| Section / card group | `surface-container-low` | `#131b2e` |
| Card body | `surface-container-high` | `#222a3d` |
| Interactive card / variant | `surface-container-highest` | `#2d3449` |
| Primary text | `on-surface` | `#dae2fd` |
| Secondary text | `on-surface-variant` | `#c3c6d7` |
| Outline (subtle) | `outline-variant` | `#434655` |
| Accent (text/tint) | `primary` | `#b4c5ff` |
| Accent fill | `primary-container` | `#2563eb` |
| **Gain / positive** | `secondary` | `#4edea3` |
| Gain fill | `secondary-container` | `#00a572` |
| **Loss / destructive** | `tertiary-container` | `#cf2c30` |
| Soft warning | `tertiary-fixed-dim` | `#ffb3ad` |
| Error text | `error` | `#ffb4ab` |

### Rules

- **No 1px dividers.** Section with background tonal shifts and whitespace, never `border: 1px solid`.
- **No pure black or white.** Always use `surface` / `on-surface` tokens.
- **Tonal layering** for depth: `lowest` → `low` → `high` → `highest`.
- **Soft corners** — 16pt on interactive cards.
- **Money is a pill, not a block.** Gains in `secondary`, losses in `tertiary-container`, as small tinted pills.
- **Shadows are soft and tinted** — ~40pt blur, ~6% opacity, tinted from `surface-container-lowest`. Never pure black, never heavy.
- **Glass** on top bars, tab bar, and FABs — semi-transparent `surface` + 16pt blur. On iOS 26 use `.glassEffect()` / native Liquid Glass materials rather than hand-rolled blur.

### Typography

- **Manrope** — all numerics ≥ 24pt, totals, headlines, section titles. Geometric, financial-grade.
- **Inter** — body copy, labels, list rows, metadata.
- Never mix: no Manrope in body copy, no Inter in large numerics.
- Hierarchy: emphasize the **what** (the number) at headline size; de-emphasize the **how** (the category) at label size in `on-surface-variant`.

---

## 3. Shared components

Build these once; every screen composes them.

| Component | Role | SwiftUI approach |
| --- | --- | --- |
| **TopBar** | Sticky header — user name (truncated) + avatar, notification bell with unread-count badge | Toolbar with glass background |
| **BottomTabBar** | 4 tabs: Home, Invest, EMIs, Profile. Hidden on all sub-screens | `TabView` — Liquid Glass tab bar is native |
| **NotificationBell** | Badge + opens Notification Center | Toolbar item → sheet |
| **Card** | Base surface — `surface-container-high`, 16pt corners, no dividers | Glass/material card |
| **StatTile** | Small label + large numeric, used in 2- and 3-up rows | — |
| **MoneyPill** | Gain/loss percentage in a tinted pill | — |
| **TypeBadge** | Color-coded investment/EMI type chip | — |
| **FilterPills** | Horizontally scrolling filter chips | ScrollView + chips |
| **ProgressBar** | 4pt thin; track `surface-variant`, indicator `secondary` (positive) or `primary-container` (neutral) | `ProgressView` restyled |
| **TextField** | "Carved" input — `surface-container-lowest` fill, focus transitions border to full `primary`, inline error below | — |
| **FAB** | Floating "+" button, bottom-trailing, glass | — |
| **FABMenu** | FAB that expands to 3 labeled options | Menu / custom expand |
| **EmptyState** | Icon + headline + body + CTA | `ContentUnavailableView` |
| **Skeleton** | Loading shimmer for cards and rows | `.redacted(reason: .placeholder)` |
| **ConfirmModal** | Destructive confirmation | `confirmationDialog` |
| **ActionMenu** | Contextual actions (edit / delete) | `Menu` |
| **OfflineBanner** | Connectivity indicator | Inline banner below TopBar |
| **PullToRefresh** | — | `.refreshable` |
| **AllocationDonut** | Portfolio pie by investment type, interactive legend | Swift Charts `SectorMark` |
| **PrincipalInterestDonut** | Loan lifetime principal-vs-interest split | Swift Charts `SectorMark` |

---

## 4. Navigation

**Tabs** (persistent, hidden on sub-screens):

| Tab | Icon | Label | Root |
| --- | --- | --- | --- |
| 1 | `house` | Home | Dashboard |
| 2 | `chart.line.uptrend.xyaxis` | Invest | Investments list |
| 3 | `creditcard` | EMIs | EMIs list |
| 4 | `person` | Profile | Profile / settings |

**Push stacks:**

- Invest → Add Investment · Edit Investment · Add DPS · DPS Detail · Add Savings Pot · Savings Pot Detail
- EMIs → Add EMI · EMI Detail
- Profile → Activity History

**Sheets / modals:** Notification Center, Change Password, Withdraw, Seed Test Data, all confirm dialogs.

**Pre-auth (no tab bar):** Get Started → Login / Signup → Check Email · Forgot Password.

---

## 5. Screens

### 5.1 Get Started — intro

**When:** app root, first launch (`hasOnboarded == false`). No tab bar, full-bleed.

Reference mockup: `screens/splash_screen/code.html`.

**Structure (top → bottom)**

- **Background** — dark splash gradient; one large blurred ambient orb (`primary-container` at ~5% opacity, ~120pt blur, centered, non-interactive). Optional grain overlay at 20% opacity.
- **Logo lockup** (centered, vertical stack, 12pt gap)
  - Glow layer — `primary-container` at 20%, heavy blur, scaled 1.25× behind the tile
  - Logo tile — 128–160pt rounded rect, ~32pt corner radius, glass material, hairline white border at ~5%, large soft shadow, Phinio glyph centered
  - Accent dot — small `secondary` circle badged at the tile's top-trailing corner
- **Wordmark block**
  - "Phinio" — Manrope extrabold, tight tracking, ~48pt, `on-surface`
  - Tagline — uppercase, 0.2em letter-spacing, ~14pt, `on-surface-variant` ("Digital private vault")
- **Actions** (bottom, max width ~320pt)
  - "Get Started" — full-width primary button → Signup
  - "I already have an account" — text button → Login
- **Footer** — small muted version line

**Animation (~1.4s entry, then settle)**

| Time | Element | Motion |
| --- | --- | --- |
| 0.0s | Orb | Fade in, then slow continuous scale-breathe (6s loop, autoreverse) |
| 0.1s | Logo tile | Scale 0.8 → 1.0 + fade, spring |
| 0.4s | Accent dot | Pop-in, spring with overshoot |
| 0.5s | Wordmark | Fade + 12pt slide-up |
| 0.7s | Tagline | Fade, staggered after wordmark |
| 0.9s | Buttons | Fade + slide-up, `.blurReplace` transition |
| loop | Glow | Opacity pulse 0.6 ↔ 1.0 |

Implementation: `PhaseAnimator` for the entry chain; `.spring(duration: 0.5, bounce: 0.3)`; ambient orb as a `Circle().blur(radius: 120)` with `.repeatForever(autoreverses: true)`. The logo tile is `.regularMaterial` so the orb reads through it.

> This replaces the web marketing landing page. The trust bar, features grid, how-it-works, testimonials, and final CTA are deliberately dropped — the App Store listing does that job.

---

### 5.2 Login

- Email field (email keyboard, autofill)
- Password field with show/hide toggle
- "Login" — full-width primary button, loading state during auth
- "Forgot Password?" link → Forgot Password
- "Don't have an account? Sign Up" link → Signup
- Inline field errors + a form-level error slot for auth failures

### 5.3 Signup

- Full Name, Email, Password (min 8 chars, show/hide toggle)
- Preferred currency selector — BDT / USD, two tonal tiles
- "Create Account" — full-width primary button
- "Already have an account? Login" link
- On success → Check Email

### 5.4 Check Email

- Confirmation copy: a verification email was sent
- "Resend email" button
- Passive state — after the user taps the emailed link, the app signs in and lands on the dashboard

### 5.5 Forgot Password

- Email field
- "Send Reset Link" button
- Success state replaces the form with a "Check your email" message
- "Back to Login" link

---

### 5.6 Home / Dashboard

Tab 1.

- **Net Worth hero card** — gradient background, large Manrope numeric. Value = Σ active investment current values − Σ active EMI remaining balances.
- **Quick stats row** (2 columns)
  - Total invested, current value, gain/loss % (green/red pill)
  - Monthly EMI outflow total
- **Upcoming Payments** — next 5 EMI payments due within 30 days. Each row: EMI label, amount, relative due date ("in 3 days"), overdue badge if past due. Tap → EMI Detail.
- **Investment Allocation donut** — active investments grouped by type. Legend lists top 5 types with color swatch and %. Tapping a legend row highlights that slice and dims the others; dimmed rows stay tappable so focus can switch directly; tapping the selected row again clears.
- **Empty state** (fresh account) — CTA cards: "Add your first investment" / "Add your first EMI".

### 5.7 Investments List

Tab 2.

- **Summary card** — Total Invested | Current Value | Return %. Covers all three modes.
- **Status tabs** — Active / Completed.
- **Type filter pills** (horizontal scroll) — All · Stocks · Mutual Fund · FD · Gold · Crypto · DPS · Savings · Other.
- **Cards — three variants:**
  - *Lump-sum* — name, color-coded type badge, invested amount, current or exit value, return % pill, date
  - *DPS* — name, green "DPS" badge, `paidCount / tenureMonths` months, total deposited → maturity value, progress bar, footer with monthly amount / rate / next due
  - *Savings* — name, blue "Savings" badge, deposit count, current balance, return % if any, footer with total deposited
- **FABMenu** (bottom-trailing) — expands to: Investment · DPS Scheme · Savings Pot
- **Empty state** when no items match the active filters

### 5.8 EMIs List

Tab 3.

- **Summary card** — Active EMIs count | Monthly outflow | Total remaining balance
- **Type filter pills** — All · Bank Loan · Credit Card
- **EMI cards** — type icon + label, EMI amount per month, remaining balance, progress bar (paid / total months), next due date. Tap → EMI Detail.
- **FAB "+"** → Add EMI
- **Empty state** when no EMIs

### 5.9 Profile / Settings

Tab 4. Sections: Header → Preferences → Account → Developer tools.

**Header**

- Avatar — Gravatar or uploaded image; tap opens camera/photo picker
- Name — inline editable (pencil affordance)
- Email — read-only

**Preferences**

- Currency — BDT / USD, two tonal tiles. Changing it re-renders every formatted amount app-wide.
- Payment reminders — push notification toggle. Handle three permission states (granted / denied / unsupported) with distinct helper copy under the toggle.

**Account**

- Activity history → push to Activity History
- Change password → modal with Current / New / Confirm fields
- Sign out — icon and label in the error color so the destructive action reads at a glance; opens a confirm dialog

**Developer tools**

- Load test data — modal to pick which category fixtures to seed, with a "wipe existing data first" option
- Clear all my data — confirm dialog, then deletes all investments, deposits, withdrawals, EMIs, payments, and notifications. Account and profile survive so sign-in still works.

---

### 5.10 Add Investment (lump-sum)

Sub-screen, tab bar hidden.

- Fields: Name · Type (Stock / Mutual Fund / FD / Gold / Crypto / Other) · Date of Investment · Invested Amount · Current Value · Notes (optional)
- "Create Investment" — full-width button pinned at the bottom
- Inline field-level validation errors

### 5.11 Edit Investment (lump-sum)

- All Add fields, pre-filled
- **Status toggle** — Active / Completed. Setting Completed reveals Exit Value and Completed Date, both required.
- **Delete** with confirmation
- "Save" button

### 5.12 Add DPS

- Fields: Scheme name · Monthly deposit (currency-symbol prefix) · Tenure in months · Start date
- **Interest section** — Annual interest rate; interest type selector (Simple / Compound) as a 2-column button grid
- **Live maturity preview** — recalculates as the user types; shows projected maturity value and total deposited
- Notes (optional)
- "Create DPS scheme" button

### 5.13 DPS Detail

- **Header** — back arrow, scheme name, subtitle "DPS · Simple/Compound interest · X% p.a.", pencil (edit) button
- **Hero card** — dark green gradient; total deposited, `paidCount / tenureMonths` months, progress bar
- **Stats row** (3 tiles) — Monthly deposit | Maturity value | Interest earned
- **Deposit schedule** — scrollable list. Each row: installment #, due date, monthly amount, accrued balance-after, paid checkbox. Overdue rows highlighted. Toggling the checkbox marks paid/unpaid and syncs invested amount + current value.
- **Auto-maturation** — when every installment is paid, the scheme flips to `matured` on its own
- **Inline edit-name card** — appears when the pencil is tapped
- **Delete** with confirmation

### 5.14 Add Savings Pot

- Fields: Name · Start date · Current balance (optional, defaults to 0) · Notes (optional)
- Helper text under balance: "Set to your current account balance if tracking an existing pot. Update anytime."
- "Create savings pot" button → Savings Pot Detail

### 5.15 Savings Pot Detail

- **Header** — back arrow, pot name, "Savings pot" subtitle, Edit button
- **Hero card** — blue gradient; current balance, return % if deposits exist
- **Stats row** (2 tiles) — Total deposited | Deposit count
- **Add deposit** — dashed-border button that opens an inline form: Amount, Date, Notes (optional)
- **Deposit history** — chronological, newest first. Each row: date, notes, amount (+ formatted). Remove button with inline confirm/cancel.
- **Edit form** — update name and current balance
- **Delete** with confirmation

### 5.16 Add EMI

- Fields: Label · Type (Bank Loan / Credit Card toggle) · Principal · Annual interest rate % · Tenure in months · Start date
- **Live EMI preview** — recalculates as the user types: Monthly EMI | Total Payment | Total Interest
- "Create EMI" button — generates the full payment schedule up front

### 5.17 EMI Detail

- **Header** — back arrow, label, type badge
- **Remaining balance** hero card
- **Key stats** (3 tiles) — Paid months | Remaining months | Total interest paid
- **Principal vs Interest donut** — loan-lifetime split
- **Amortization schedule** — scrollable table. Columns: # · Due Date · EMI · Principal · Interest · Balance. Paid rows muted with strikethrough; overdue rows highlighted; a checkbox per row marks it paid (optimistic, rolls back on error).
- **Delete** with confirmation — cascades to every payment row

### 5.18 Activity History

Reached from Profile; back arrow returns to Profile.

- Full audit trail of every mutation, as an infinite-scroll list
- **Entities tracked:** investment · investment deposit · investment withdrawal · EMI · EMI payment · profile
- **Actions:** create / update / delete — each with a distinct icon and badge color
- **Row content:** entity label, action verb, relative time, and for updates a diff of changed fields (old → new)
- **Pagination:** 15 rows per page, "Load more" at the bottom

### 5.19 Notification Center

Sheet, opened from the bell in the TopBar.

- **List** — sorted unread-first, then newest. Each row: title, body, relative time, unread indicator.
- Tapping a notification with a link navigates to the linked screen and marks it read
- **Mark all read** button
- Notification types: investment created · DPS created · EMI payment due (within 3 days) · EMI payment overdue · DPS installment due · DPS installment overdue

---

## 6. Cross-cutting behaviors

- **Currency formatting** — every amount uses the profile's preferred symbol (৳ or $). Changing currency in Settings re-renders all of them.
- **Money precision** — amounts are fixed-precision decimals, never floating-point. Format for display; never round for arithmetic.
- **Offline-first** — every screen renders from local state and syncs in the background. Mutations are optimistic and roll back on failure. The OfflineBanner appears below the TopBar when disconnected.
- **Overdue emphasis** — overdue payments and installments use `tertiary-fixed-dim`, not full error red. Reserve `tertiary-container` for actual losses and destructive actions.
- **Empty states everywhere** — every list (dashboard, investments, EMIs, activity, notifications) needs a designed empty state, not a blank screen.
- **Loading** — skeleton shimmer on first load; never a bare spinner on a full screen.
