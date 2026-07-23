# iOS Screens Implementation Plan (Plan 3 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the debug shell with the full native UI — onboarding, 4-tab app (Dashboard, Investments, EMIs, Activity), notifications, settings — plus APNs registration and deep links, per `docs/superpowers/specs/2026-07-17-ios-app-design.md` §3–§5.

**Architecture:** Views read SwiftData directly via `@Query` (reads never fail). Every write goes through `Store`, which mirrors the server's business rules locally and appends one `PendingMutation` outbox row whose JSON body matches the server validator exactly; views fire `sync.syncNow()` after each write. Dashboard stats are computed locally (a Swift port of `src/server/dashboard.impl.ts` formulas). Activity is the one online-only screen (`GET /api/v1/activity`, not in the snapshot).

**Tech Stack:** Swift 6, SwiftUI, SwiftData, Swift Charts (first-party), UserNotifications, Swift Testing. Zero third-party dependencies.

## Global Constraints

- iPhone-only, iOS 26.0 deployment target, Xcode 26 SDK (stock chrome gets Liquid Glass automatically; `.glassEffect()` only for custom chrome: dashboard stat cards, EMI schedule preview).
- Money is `Decimal` in Swift, 2-dp strings on the wire (`Money.string`/`Money.decimal`). Never `Double` for money except inside `EmiCalculator` (which deliberately mirrors TS float math).
- Day-only dates on the wire are `YYYY-MM-DD` via `WireDate.dayString`/`WireDate.day`; timestamps ISO 8601 via `WireDate.iso`/`WireDate.timestamp`.
- All entity IDs are client-minted lowercase UUID strings (`UUID().uuidString.lowercased()`).
- Every outbox body must satisfy the zod schemas in `src/lib/validators.ts` (money as strings, `tenureMonths`/`paid`/`closeInvestment` are the only number/bool fields). `Idempotency-Key` header carries the mutation UUID — never put `clientMutationId` in the body.
- Enum string values (verbatim): Investment.type `stock|mutual_fund|fd|gold|crypto|sanchayapatra|real_estate|agro_farm|business|other` (+ server-set `dps`, `savings`); mode `lump_sum|scheduled|flexible`; Investment.status `active|completed|matured|closed`; deposit/payment status `upcoming|paid`; Emi.type `bank_loan|credit_card`; Emi.status `active|completed`; currency `BDT|USD`; language `en|bn`. EMI processing-fee sentinel row is `paymentNumber == 0`.
- System light+dark, SF Symbols, stock controls. No custom colors beyond semantic ones (`.red` for destructive/overdue, `.green` for gains).
- Existing helpers to reuse (do not re-implement): `Money`, `WireDate`, `Keychain`, `APIClient`, `APIError`, `EmiCalculator.amortization(principal:annualRate:tenureMonths:startDate:type:)` (`EmiMethod` enum `.bankLoan`/`.creditCard`, `AmortizationRow` has `paymentNumber, dueDate: Date, emiAmount/principalComponent/interestComponent/remainingBalance: String`), `Store`, `SyncEngine`, `AuthManager`, `makeModelContainer`.
- All Swift source lives in `apps/ios/Phinio/Phinio/`, tests in `apps/ios/Phinio/PhinioTests/`. Xcode uses synchronized folder groups — new files are picked up automatically, no pbxproj edits.
- Build/test commands (resolve the UDID once — it differs per machine):
  ```bash
  UDID=$(xcrun simctl list devices available | grep -m1 "iPhone 17 Pro (" | grep -oE '[0-9A-F-]{36}')
  # type-check only (fast):
  xcodebuild build -project apps/ios/Phinio/Phinio.xcodeproj -scheme Phinio -destination "id=$UDID" | tail -3
  # tests:
  xcodebuild test -project apps/ios/Phinio/Phinio.xcodeproj -scheme Phinio -destination "id=$UDID" -only-testing:PhinioTests 2>&1 | grep -E "Test case|TEST "
  ```
- Test-suite gotchas learned in Plan 2: keep the `ModelContainer` alive as a local for the whole test (`ModelContext` does not retain it — dropping it SIGTRAPs); suites touching process-global state get `@Suite(.serialized)`.
- Manual verification runs against `npm run dev` on :3000 (simulator hits `http://localhost:3000`; physical device sets scheme env `PHINIO_BASE_URL=http://<mac-lan-ip>:3000` with `npm run dev -- --host`).

**Deliberate scope notes (spec-consistent):**
- DPS installment schedules are server-generated (`generateDpsSchedule` is NOT ported). Offline DPS creation inserts the Investment row only; the detail screen shows "Schedule appears after first sync" until then.
- Activity tab requires connectivity (activity log is not in the snapshot); it shows an offline message when unreachable.
- No XCUITest; UI verification is manual per spec §6.

---

### Task 1: Input validation + display formatting helpers

**Files:**
- Create: `apps/ios/Phinio/Phinio/Support/Validators.swift`
- Create: `apps/ios/Phinio/Phinio/Support/Formatting.swift`
- Test: `apps/ios/Phinio/PhinioTests/ValidatorsTests.swift`

**Interfaces:**
- Consumes: `Money.decimal(String) -> Decimal?`.
- Produces: `Validate.money/positiveMoney/nonNegativeMoney/rate(_ s: String) -> Decimal?`, `Validate.name(_ s: String, max: Int = 120) -> String?`, `Validate.notes(_ s: String, max: Int = 1000) -> String??` (nil = invalid, `.some(nil)` = empty→omit); `Decimal.currency(_ code: String) -> String`; `investmentTypeLabel(_ raw: String) -> String`; `dueLabel(daysUntil: Int) -> String`; `utcDaysUntil(_ target: Date, from now: Date) -> Int`. Every form task and the dashboard rely on these exact names.

- [x] **Step 1: Write the failing tests**

```swift
// apps/ios/Phinio/PhinioTests/ValidatorsTests.swift
import Foundation
import Testing
@testable import Phinio

struct ValidatorsTests {
  @Test func moneyRulesMirrorTheZodSchemas() {
    #expect(Validate.money("100.50") == Money.decimal("100.50"))
    #expect(Validate.money("0") == 0)
    #expect(Validate.money("1.234") == nil)      // >2 dp
    #expect(Validate.money("-5") == nil)          // sign not in regex
    #expect(Validate.money("1,000") == nil)
    #expect(Validate.money(" 100 ") == Money.decimal("100")) // trimmed first
    #expect(Validate.positiveMoney("0") == nil)
    #expect(Validate.positiveMoney("0.01") == Money.decimal("0.01"))
    #expect(Validate.nonNegativeMoney("0") == 0)
    #expect(Validate.rate("99.99") == Money.decimal("99.99"))
    #expect(Validate.rate("100") == nil)          // < 100
    #expect(Validate.rate("0") == 0)
  }

  @Test func nameAndNotesTrimAndBound() {
    #expect(Validate.name("  Car loan  ") == "Car loan")
    #expect(Validate.name("   ") == nil)
    #expect(Validate.name(String(repeating: "x", count: 121)) == nil)
    #expect(Validate.notes("") == .some(nil))     // empty → omit from body
    #expect(Validate.notes("hi") == "hi")
    #expect(Validate.notes(String(repeating: "x", count: 1001)) == nil)
  }

  @Test func utcDayMathMatchesTheServer() {
    let now = WireDate.timestamp("2026-07-17T22:30:00.000Z")!
    #expect(utcDaysUntil(WireDate.day("2026-07-17")!, from: now) == 0)
    #expect(utcDaysUntil(WireDate.day("2026-07-20")!, from: now) == 3)
    #expect(utcDaysUntil(WireDate.day("2026-07-16")!, from: now) == -1)
  }
}
```

- [x] **Step 2: Run to verify failure** (unresolved `Validate`). Command from Global Constraints with `-only-testing:PhinioTests/ValidatorsTests`. Expected: BUILD FAILED, "cannot find 'Validate' in scope".

- [x] **Step 3: Implement**

```swift
// apps/ios/Phinio/Phinio/Support/Validators.swift
import Foundation

/// Client-side mirror of src/lib/validators.ts primitives. The server
/// re-validates everything; these exist so forms reject bad input before it
/// reaches the outbox (a 4xx there lands in the sync-issues list instead).
enum Validate {
  /// zod money regex: ^\d+(\.\d{1,2})?$ on the trimmed string.
  static func money(_ s: String) -> Decimal? {
    let t = s.trimmingCharacters(in: .whitespaces)
    guard t.wholeMatch(of: /\d+(\.\d{1,2})?/) != nil else { return nil }
    return Money.decimal(t)
  }

  static func positiveMoney(_ s: String) -> Decimal? {
    guard let d = money(s), d > 0 else { return nil }
    return d
  }

  static func nonNegativeMoney(_ s: String) -> Decimal? {
    guard let d = money(s), d >= 0 else { return nil }
    return d
  }

  /// Rate: money regex, 0 <= r < 100.
  static func rate(_ s: String) -> Decimal? {
    guard let d = money(s), d >= 0, d < 100 else { return nil }
    return d
  }

  static func name(_ s: String, max: Int = 120) -> String? {
    let t = s.trimmingCharacters(in: .whitespaces)
    guard !t.isEmpty, t.count <= max else { return nil }
    return t
  }

  /// nil = invalid (too long); .some(nil) = empty (omit from wire body).
  static func notes(_ s: String, max: Int = 1000) -> String?? {
    let t = s.trimmingCharacters(in: .whitespaces)
    if t.isEmpty { return .some(nil) }
    guard t.count <= max else { return nil }
    return t
  }
}
```

```swift
// apps/ios/Phinio/Phinio/Support/Formatting.swift
import Foundation

extension Decimal {
  /// Profile-currency display, always 2 fraction digits (BDT defaults to 2).
  func currency(_ code: String) -> String {
    formatted(.currency(code: code).precision(.fractionLength(2)))
  }
}

/// Display names for Investment.type raw values.
func investmentTypeLabel(_ raw: String) -> String {
  switch raw {
  case "stock": "Stocks"
  case "mutual_fund": "Mutual funds"
  case "fd": "Fixed deposit"
  case "gold": "Gold"
  case "crypto": "Crypto"
  case "sanchayapatra": "Sanchayapatra"
  case "real_estate": "Real estate"
  case "agro_farm": "Agro farm"
  case "business": "Business"
  case "dps": "DPS"
  case "savings": "Savings"
  default: "Other"
  }
}

/// UTC-day difference, mirroring dashboard.impl.ts (dueDate is @db.Date —
/// UTC midnight — so compare day-to-day, not wall-clock).
func utcDaysUntil(_ target: Date, from now: Date) -> Int {
  var cal = Calendar(identifier: .gregorian)
  cal.timeZone = TimeZone(identifier: "UTC")!
  let a = cal.startOfDay(for: now)
  let b = cal.startOfDay(for: target)
  return cal.dateComponents([.day], from: a, to: b).day ?? 0
}

func dueLabel(daysUntil d: Int) -> String {
  switch d {
  case ..<0: "Overdue"
  case 0: "Due today"
  case 1: "Due tomorrow"
  default: "In \(d) days"
  }
}
```

- [x] **Step 4: Run tests — expect PASS.**

- [x] **Step 5: Commit**

```bash
git add apps/ios/Phinio/Phinio/Support/Validators.swift apps/ios/Phinio/Phinio/Support/Formatting.swift apps/ios/Phinio/PhinioTests/ValidatorsTests.swift
git commit -m "✨ feat(ios): form validators + display formatting helpers"
```

---

### Task 2: Store — investment write operations

**Files:**
- Modify: `apps/ios/Phinio/Phinio/Sync/Store.swift` (append; existing `enqueue`/`newId`/`createEmi`/`markPaymentPaid` stay)
- Test: `apps/ios/Phinio/PhinioTests/StoreInvestmentTests.swift`

**Interfaces:**
- Consumes: `Store.enqueue(method:path:body:)`, `Store.newId()`, `Money.string`, `WireDate.dayString`, models from `DomainModels.swift`.
- Produces (exact signatures the form tasks call — all `throws`, all on `Store`):
  - `StoreError.validation(String)` (new top-level enum, `LocalizedError`)
  - `@discardableResult createLumpSumInvestment(name:String, type:String, investedAmount:Decimal, currentValue:Decimal, dateOfInvestment:Date, estimatedClosureDate:Date?, notes:String?) -> Investment`
  - `updateLumpSumInvestment(_ inv:Investment, name:String, type:String, investedAmount:Decimal, currentValue:Decimal, dateOfInvestment:Date, estimatedClosureDate:Date?, notes:String?, completed:Bool, exitValue:Decimal?, completedAt:Date?)`
  - `deleteInvestment(_ inv:Investment)`
  - `@discardableResult createSavings(name:String, startDate:Date, currentValue:Decimal, notes:String?) -> Investment`
  - `updateSavings(_ inv:Investment, name:String, currentValue:Decimal, notes:String?)`
  - `addDeposit(to inv:Investment, amount:Decimal, depositDate:Date, notes:String?)`
  - `removeDeposit(_ dep:InvestmentDeposit, from inv:Investment)`
  - `withdraw(from inv:Investment, amount:Decimal, withdrawalDate:Date, notes:String?, closeInvestment:Bool)`
  - `@discardableResult createDps(name:String, monthlyDeposit:Decimal, tenureMonths:Int, interestRate:Decimal, interestType:String, startDate:Date, notes:String?) -> Investment`
  - `updateDps(_ inv:Investment, name:String, notes:String?)`
  - `markDepositPaid(_ dep:InvestmentDeposit, investment inv:Investment, paid:Bool)`
  - `closeDps(_ inv:Investment, receivedAmount:Decimal, closureDate:Date, notes:String?)`

Every op mutates SwiftData first (mirroring `src/server/investments.impl.ts` rules exactly), then enqueues one outbox row, then `context.save()`.

- [x] **Step 1: Write the failing tests**

```swift
// apps/ios/Phinio/PhinioTests/StoreInvestmentTests.swift
import Foundation
import SwiftData
import Testing
@testable import Phinio

@MainActor
struct StoreInvestmentTests {
  // Container must outlive the test — ModelContext does not retain it.
  private func makeStore() throws -> (Store, ModelContainer) {
    let container = try makeModelContainer(inMemory: true)
    return (Store(context: container.mainContext), container)
  }

  private func outbox(_ ctx: ModelContext) throws -> [PendingMutation] {
    try ctx.fetch(FetchDescriptor<PendingMutation>(
      sortBy: [SortDescriptor(\.createdAt, order: .forward)]))
  }

  private func body(_ m: PendingMutation) throws -> [String: Any] {
    try JSONSerialization.jsonObject(with: m.body!) as! [String: Any]
  }

  @Test func savingsCreateSeedsInitialDeposit() throws {
    let (store, container) = try makeStore()
    let ctx = container.mainContext
    let inv = try store.createSavings(
      name: "Rainy day", startDate: WireDate.day("2026-01-01")!,
      currentValue: Money.decimal("500")!, notes: nil)
    #expect(inv.type == "savings" && inv.mode == "flexible")
    #expect(inv.investedAmount == Money.decimal("500"))
    let deps = try ctx.fetch(FetchDescriptor<InvestmentDeposit>())
    #expect(deps.count == 1 && deps[0].status == "paid")
    let b = try body(try outbox(ctx)[0])
    #expect(b["currentValue"] as? String == "500.00")
    #expect(b["startDate"] as? String == "2026-01-01")
  }

  @Test func depositAndRemovalKeepTotalsSynced() throws {
    let (store, container) = try makeStore()
    let ctx = container.mainContext
    let inv = try store.createSavings(
      name: "S", startDate: Date(), currentValue: 0, notes: nil)
    try store.addDeposit(to: inv, amount: Money.decimal("100")!,
                         depositDate: Date(), notes: nil)
    #expect(inv.investedAmount == 100 && inv.currentValue == 100)
    let dep = try ctx.fetch(FetchDescriptor<InvestmentDeposit>()).first!
    try store.removeDeposit(dep, from: inv)
    #expect(inv.investedAmount == 0 && inv.currentValue == 0)
    let last = try outbox(ctx).last!
    #expect(last.method == "DELETE")
    #expect(last.path == "/api/v1/deposits/\(dep.id)")
  }

  @Test func withdrawGuardsAndCloses() throws {
    let (store, container) = try makeStore()
    let inv = try store.createSavings(
      name: "S", startDate: Date(), currentValue: Money.decimal("100")!, notes: nil)
    #expect(throws: StoreError.self) {
      try store.withdraw(from: inv, amount: Money.decimal("150")!,
                         withdrawalDate: Date(), notes: nil, closeInvestment: false)
    }
    #expect(throws: StoreError.self) { // partial cannot close
      try store.withdraw(from: inv, amount: Money.decimal("40")!,
                         withdrawalDate: Date(), notes: nil, closeInvestment: true)
    }
    try store.withdraw(from: inv, amount: Money.decimal("100")!,
                       withdrawalDate: WireDate.day("2026-03-01")!,
                       notes: nil, closeInvestment: true)
    #expect(inv.status == "completed")
    #expect(inv.currentValue == 0)
    #expect(inv.exitValue == 100)
    let wds = try container.mainContext.fetch(FetchDescriptor<InvestmentWithdrawal>())
    #expect(wds.count == 1)
  }

  @Test func dpsMarkPaidResyncsAndMatures() throws {
    let (store, container) = try makeStore()
    let ctx = container.mainContext
    let inv = try store.createDps(
      name: "DPS", monthlyDeposit: Money.decimal("1000")!, tenureMonths: 2,
      interestRate: Money.decimal("8")!, interestType: "compound",
      startDate: WireDate.day("2026-01-01")!, notes: nil)
    // Simulate server-generated installments arriving via snapshot:
    let d1 = InvestmentDeposit(id: "d1", investmentId: inv.id,
      amount: Money.decimal("1000")!, dueDate: WireDate.day("2026-01-01"),
      depositDate: nil, installmentNumber: 1, status: "upcoming",
      notes: nil, updatedAt: Date())
    let d2 = InvestmentDeposit(id: "d2", investmentId: inv.id,
      amount: Money.decimal("1000")!, dueDate: WireDate.day("2026-02-01"),
      depositDate: nil, installmentNumber: 2, status: "upcoming",
      notes: nil, updatedAt: Date())
    ctx.insert(d1); ctx.insert(d2); try ctx.save()

    try store.markDepositPaid(d1, investment: inv, paid: true)
    #expect(inv.currentValue == 1000 && inv.investedAmount == 1000)
    #expect(inv.status == "active")
    try store.markDepositPaid(d2, investment: inv, paid: true)
    #expect(inv.status == "matured")
    try store.markDepositPaid(d2, investment: inv, paid: false)
    #expect(inv.status == "active" && inv.currentValue == 1000)
    let last = try outbox(ctx).last!
    #expect(last.path == "/api/v1/deposits/d2/mark-paid")
    #expect(try (body(last)["paid"] as? Bool) == false)
  }

  @Test func dpsCloseDropsUpcomingAndRecordsExit() throws {
    let (store, container) = try makeStore()
    let ctx = container.mainContext
    let inv = try store.createDps(
      name: "DPS", monthlyDeposit: Money.decimal("1000")!, tenureMonths: 2,
      interestRate: Money.decimal("8")!, interestType: "simple",
      startDate: WireDate.day("2026-01-01")!, notes: nil)
    ctx.insert(InvestmentDeposit(id: "u1", investmentId: inv.id,
      amount: Money.decimal("1000")!, dueDate: WireDate.day("2026-02-01"),
      depositDate: nil, installmentNumber: 2, status: "upcoming",
      notes: nil, updatedAt: Date()))
    try ctx.save()
    try store.closeDps(inv, receivedAmount: Money.decimal("980")!,
                       closureDate: WireDate.day("2026-01-15")!, notes: "early")
    #expect(inv.status == "closed" && inv.exitValue == Money.decimal("980"))
    #expect(inv.currentValue == 0)
    #expect(try ctx.fetch(FetchDescriptor<InvestmentDeposit>()).isEmpty)
    #expect(try ctx.fetch(FetchDescriptor<InvestmentWithdrawal>()).count == 1)
  }

  @Test func lumpSumCompleteCollapsesCurrentValue() throws {
    let (store, container) = try makeStore()
    let inv = try store.createLumpSumInvestment(
      name: "Gold", type: "gold", investedAmount: Money.decimal("1000")!,
      currentValue: Money.decimal("1200")!,
      dateOfInvestment: WireDate.day("2026-01-01")!,
      estimatedClosureDate: nil, notes: nil)
    try store.updateLumpSumInvestment(inv,
      name: "Gold", type: "gold", investedAmount: Money.decimal("1000")!,
      currentValue: Money.decimal("1200")!,
      dateOfInvestment: WireDate.day("2026-01-01")!,
      estimatedClosureDate: nil, notes: nil,
      completed: true, exitValue: Money.decimal("1300")!,
      completedAt: WireDate.day("2026-06-01")!)
    #expect(inv.status == "completed")
    #expect(inv.currentValue == Money.decimal("1300")) // collapses to exitValue
    let last = try container.mainContext
      .fetch(FetchDescriptor<PendingMutation>(sortBy: [SortDescriptor(\.createdAt)])).last!
    #expect(last.method == "PATCH")
    let b = try JSONSerialization.jsonObject(with: last.body!) as! [String: Any]
    #expect(b["status"] as? String == "completed")
    #expect(b["exitValue"] as? String == "1300.00")
  }
}
```

- [x] **Step 2: Run to verify failure** (`-only-testing:PhinioTests/StoreInvestmentTests`). Expected: BUILD FAILED — `createSavings` etc. not members of `Store`.

- [x] **Step 3: Implement — append to `Store.swift`**

Add above the `Store` struct:

```swift
enum StoreError: LocalizedError, Equatable {
  case validation(String)
  var errorDescription: String? {
    if case .validation(let message) = self { return message }
    return nil
  }
}
```

Append inside `Store` (after `markPaymentPaid`):

```swift
  // MARK: - Investments (mirrors src/server/investments.impl.ts)

  private func deposits(of investmentId: String) throws -> [InvestmentDeposit] {
    try context.fetch(FetchDescriptor<InvestmentDeposit>(
      predicate: #Predicate { $0.investmentId == investmentId }))
  }

  private func withdrawals(of investmentId: String) throws -> [InvestmentWithdrawal] {
    try context.fetch(FetchDescriptor<InvestmentWithdrawal>(
      predicate: #Predicate { $0.investmentId == investmentId }))
  }

  @discardableResult
  func createLumpSumInvestment(
    name: String, type: String, investedAmount: Decimal, currentValue: Decimal,
    dateOfInvestment: Date, estimatedClosureDate: Date?, notes: String?
  ) throws -> Investment {
    let inv = Investment(
      id: newId(), name: name, type: type, mode: "lump_sum", status: "active",
      investedAmount: investedAmount, currentValue: currentValue,
      exitValue: nil, dateOfInvestment: dateOfInvestment, startDate: nil,
      monthlyDeposit: nil, tenureMonths: nil, interestRate: nil,
      interestType: nil, estimatedClosureDate: estimatedClosureDate,
      completedAt: nil, notes: notes, updatedAt: Date())
    context.insert(inv)
    var body: [String: Any] = [
      "id": inv.id, "name": name, "type": type,
      "investedAmount": Money.string(investedAmount),
      "currentValue": Money.string(currentValue),
      "dateOfInvestment": WireDate.dayString(dateOfInvestment),
    ]
    if let estimatedClosureDate {
      body["estimatedClosureDate"] = WireDate.dayString(estimatedClosureDate)
    }
    if let notes { body["notes"] = notes }
    try enqueue(method: "POST", path: "/api/v1/investments", body: body)
    try context.save()
    return inv
  }

  func updateLumpSumInvestment(
    _ inv: Investment, name: String, type: String, investedAmount: Decimal,
    currentValue: Decimal, dateOfInvestment: Date, estimatedClosureDate: Date?,
    notes: String?, completed: Bool, exitValue: Decimal?, completedAt: Date?
  ) throws {
    if completed {
      guard let exitValue, let completedAt else {
        throw StoreError.validation("Exit value and completion date are required")
      }
      inv.status = "completed"
      inv.exitValue = exitValue
      inv.completedAt = completedAt
      inv.currentValue = exitValue // server collapses currentValue to exitValue
    } else {
      inv.status = "active"
      inv.exitValue = nil
      inv.completedAt = nil
      inv.currentValue = currentValue
    }
    inv.name = name
    inv.type = type
    inv.investedAmount = investedAmount
    inv.dateOfInvestment = dateOfInvestment
    inv.estimatedClosureDate = estimatedClosureDate
    inv.notes = notes
    inv.updatedAt = Date()
    var body: [String: Any] = [
      "name": name, "type": type, "status": inv.status,
      "investedAmount": Money.string(investedAmount),
      "currentValue": Money.string(completed ? currentValue : inv.currentValue),
      "dateOfInvestment": WireDate.dayString(dateOfInvestment),
    ]
    if let estimatedClosureDate {
      body["estimatedClosureDate"] = WireDate.dayString(estimatedClosureDate)
    }
    if let notes { body["notes"] = notes }
    if completed {
      body["exitValue"] = Money.string(inv.exitValue!)
      body["completedAt"] = WireDate.dayString(inv.completedAt!)
    }
    try enqueue(method: "PATCH", path: "/api/v1/investments/\(inv.id)", body: body)
    try context.save()
  }

  func deleteInvestment(_ inv: Investment) throws {
    for d in try deposits(of: inv.id) { context.delete(d) }
    for w in try withdrawals(of: inv.id) { context.delete(w) }
    let path = "/api/v1/investments/\(inv.id)"
    context.delete(inv)
    try enqueue(method: "DELETE", path: path, body: [:])
    try context.save()
  }

  @discardableResult
  func createSavings(
    name: String, startDate: Date, currentValue: Decimal, notes: String?
  ) throws -> Investment {
    let inv = Investment(
      id: newId(), name: name, type: "savings", mode: "flexible",
      status: "active",
      investedAmount: currentValue > 0 ? currentValue : 0,
      currentValue: currentValue, exitValue: nil, dateOfInvestment: nil,
      startDate: startDate, monthlyDeposit: nil, tenureMonths: nil,
      interestRate: nil, interestType: nil, estimatedClosureDate: nil,
      completedAt: nil, notes: notes, updatedAt: Date())
    context.insert(inv)
    if currentValue > 0 { // server seeds the initial deposit the same way
      context.insert(InvestmentDeposit(
        id: newId(), investmentId: inv.id, amount: currentValue,
        dueDate: nil, depositDate: startDate, installmentNumber: nil,
        status: "paid", notes: "Initial deposit", updatedAt: Date()))
    }
    var body: [String: Any] = [
      "id": inv.id, "name": name,
      "startDate": WireDate.dayString(startDate),
      "currentValue": Money.string(currentValue),
    ]
    if let notes { body["notes"] = notes }
    try enqueue(method: "POST", path: "/api/v1/investments/savings", body: body)
    try context.save()
    return inv
  }

  func updateSavings(_ inv: Investment, name: String, currentValue: Decimal,
                     notes: String?) throws {
    inv.name = name
    inv.currentValue = currentValue
    inv.notes = notes
    inv.updatedAt = Date()
    var body: [String: Any] = [
      "name": name, "currentValue": Money.string(currentValue),
    ]
    if let notes { body["notes"] = notes }
    try enqueue(method: "PATCH", path: "/api/v1/investments/savings/\(inv.id)",
                body: body)
    try context.save()
  }

  func addDeposit(to inv: Investment, amount: Decimal, depositDate: Date,
                  notes: String?) throws {
    context.insert(InvestmentDeposit(
      id: newId(), investmentId: inv.id, amount: amount, dueDate: nil,
      depositDate: depositDate, installmentNumber: nil, status: "paid",
      notes: notes, updatedAt: Date()))
    inv.investedAmount += amount
    inv.currentValue += amount
    inv.updatedAt = Date()
    var body: [String: Any] = [
      "amount": Money.string(amount),
      "depositDate": WireDate.dayString(depositDate),
    ]
    if let notes { body["notes"] = notes }
    try enqueue(method: "POST",
                path: "/api/v1/investments/savings/\(inv.id)/deposits", body: body)
    try context.save()
  }

  func removeDeposit(_ dep: InvestmentDeposit, from inv: Investment) throws {
    let path = "/api/v1/deposits/\(dep.id)"
    let removed = dep.amount
    context.delete(dep)
    // Server re-syncs investedAmount = SUM(remaining), currentValue clamped.
    let remaining = try deposits(of: inv.id).reduce(Decimal(0)) { $0 + $1.amount }
    inv.investedAmount = remaining
    inv.currentValue = max(0, inv.currentValue - removed)
    inv.updatedAt = Date()
    try enqueue(method: "DELETE", path: path, body: [:])
    try context.save()
  }

  func withdraw(from inv: Investment, amount: Decimal, withdrawalDate: Date,
                notes: String?, closeInvestment: Bool) throws {
    guard inv.mode != "scheduled" else {
      throw StoreError.validation("Use premature closure for DPS schemes")
    }
    guard inv.status == "active" else {
      throw StoreError.validation("Investment is not active")
    }
    guard amount <= inv.currentValue else {
      throw StoreError.validation("Withdrawal amount exceeds current value")
    }
    let resulting = inv.currentValue - amount
    if closeInvestment && resulting != 0 {
      throw StoreError.validation("Only full withdrawals can close an investment")
    }
    context.insert(InvestmentWithdrawal(
      id: newId(), investmentId: inv.id, amount: amount,
      withdrawalDate: withdrawalDate, notes: notes))
    inv.currentValue = resulting
    if closeInvestment || resulting == 0 {
      inv.status = "completed"
      inv.exitValue = try withdrawals(of: inv.id).reduce(Decimal(0)) { $0 + $1.amount }
      inv.completedAt = withdrawalDate
    }
    inv.updatedAt = Date()
    var body: [String: Any] = [
      "amount": Money.string(amount),
      "withdrawalDate": WireDate.dayString(withdrawalDate),
    ]
    if let notes { body["notes"] = notes }
    if closeInvestment { body["closeInvestment"] = true }
    try enqueue(method: "POST", path: "/api/v1/investments/\(inv.id)/withdraw",
                body: body)
    try context.save()
  }

  @discardableResult
  func createDps(
    name: String, monthlyDeposit: Decimal, tenureMonths: Int,
    interestRate: Decimal, interestType: String, startDate: Date, notes: String?
  ) throws -> Investment {
    // ponytail: installment schedule is server-generated (generateDpsSchedule
    // is not ported); rows arrive with the first snapshot after sync.
    let inv = Investment(
      id: newId(), name: name, type: "dps", mode: "scheduled", status: "active",
      investedAmount: 0, currentValue: 0, exitValue: nil, dateOfInvestment: nil,
      startDate: startDate, monthlyDeposit: monthlyDeposit,
      tenureMonths: tenureMonths, interestRate: interestRate,
      interestType: interestType, estimatedClosureDate: nil, completedAt: nil,
      notes: notes, updatedAt: Date())
    context.insert(inv)
    var body: [String: Any] = [
      "id": inv.id, "name": name,
      "monthlyDeposit": Money.string(monthlyDeposit),
      "tenureMonths": tenureMonths,
      "interestRate": Money.string(interestRate),
      "interestType": interestType,
      "startDate": WireDate.dayString(startDate),
    ]
    if let notes { body["notes"] = notes }
    try enqueue(method: "POST", path: "/api/v1/investments/dps", body: body)
    try context.save()
    return inv
  }

  func updateDps(_ inv: Investment, name: String, notes: String?) throws {
    inv.name = name
    inv.notes = notes
    inv.updatedAt = Date()
    var body: [String: Any] = ["name": name]
    if let notes { body["notes"] = notes }
    try enqueue(method: "PATCH", path: "/api/v1/investments/dps/\(inv.id)",
                body: body)
    try context.save()
  }

  func markDepositPaid(_ dep: InvestmentDeposit, investment inv: Investment,
                       paid: Bool) throws {
    // Note: InvestmentDeposit has no paidAt property (the server tracks it);
    // status alone drives all local UI.
    dep.status = paid ? "paid" : "upcoming"
    dep.updatedAt = Date()
    // Server re-syncs both totals to SUM(paid deposits).
    let paidSum = try deposits(of: inv.id)
      .filter { $0.status == "paid" }
      .reduce(Decimal(0)) { $0 + $1.amount }
    inv.investedAmount = paidSum
    inv.currentValue = paidSum
    let unpaidRemain = try deposits(of: inv.id).contains { $0.status != "paid" }
    if paid && !unpaidRemain {
      inv.status = "matured"
    } else if !paid && inv.status == "matured" {
      inv.status = "active"
    }
    inv.updatedAt = Date()
    try enqueue(method: "POST", path: "/api/v1/deposits/\(dep.id)/mark-paid",
                body: ["paid": paid])
    try context.save()
  }

  func closeDps(_ inv: Investment, receivedAmount: Decimal, closureDate: Date,
                notes: String?) throws {
    guard inv.status == "active" else {
      throw StoreError.validation("DPS is not active")
    }
    let note = "Premature closure." + (notes.map { " \($0)" } ?? "")
    context.insert(InvestmentWithdrawal(
      id: newId(), investmentId: inv.id, amount: receivedAmount,
      withdrawalDate: closureDate, notes: note))
    for d in try deposits(of: inv.id) where d.status == "upcoming" {
      context.delete(d)
    }
    inv.currentValue = 0
    inv.exitValue = receivedAmount
    inv.status = "closed"
    inv.completedAt = closureDate
    inv.updatedAt = Date()
    var body: [String: Any] = [
      "receivedAmount": Money.string(receivedAmount),
      "closureDate": WireDate.dayString(closureDate),
    ]
    if let notes { body["notes"] = notes }
    try enqueue(method: "POST", path: "/api/v1/investments/dps/\(inv.id)/close",
                body: body)
    try context.save()
  }
```

- [x] **Step 4: Run tests — expect PASS.**

- [x] **Step 5: Commit**

```bash
git add apps/ios/Phinio/Phinio/Sync/Store.swift apps/ios/Phinio/PhinioTests/StoreInvestmentTests.swift
git commit -m "✨ feat(ios): Store investment writes — savings, deposits, withdraw, DPS"
```

---

### Task 3: Store — EMI edit/complete/delete + processing fee, notifications, profile

**Files:**
- Modify: `apps/ios/Phinio/Phinio/Sync/Store.swift` (extend `createEmi`, `markPaymentPaid`; append new ops)
- Test: `apps/ios/Phinio/PhinioTests/StoreEmiTests.swift`

**Interfaces:**
- Consumes: Task 2's `StoreError`, existing `createEmi`/`markPaymentPaid`.
- Produces (all on `Store`, all `throws`):
  - `createEmi(label:type:principal:interestRate:tenureMonths:startDate:notes:)` gains a `processingFee: Decimal? = nil` parameter (existing callers unaffected)
  - `markPaymentPaid(_ payment:EmiPayment, paid:Bool)` — same signature, now rejects the fee row and auto-completes/reopens the parent EMI
  - `updateEmi(_ emi:Emi, label:String, notes:String?)`
  - `deleteEmi(_ emi:Emi)`
  - `completeEmi(_ emi:Emi)`
  - `markNotificationRead(_ n:AppNotification)`
  - `markAllNotificationsRead()`
  - `clearReadNotifications()`
  - `updateProfile(_ p:Profile, fullName:String, preferredCurrency:String, preferredLanguage:String)`

- [x] **Step 1: Write the failing tests**

```swift
// apps/ios/Phinio/PhinioTests/StoreEmiTests.swift
import Foundation
import SwiftData
import Testing
@testable import Phinio

@MainActor
struct StoreEmiTests {
  private func makeStore() throws -> (Store, ModelContainer) {
    let container = try makeModelContainer(inMemory: true)
    return (Store(context: container.mainContext), container)
  }

  @Test func processingFeeInsertsSentinelRowAndWiresBody() throws {
    let (store, container) = try makeStore()
    let ctx = container.mainContext
    _ = try store.createEmi(
      label: "Loan", type: .bankLoan, principal: Money.decimal("12000")!,
      interestRate: Money.decimal("10")!, tenureMonths: 3,
      startDate: WireDate.day("2026-02-01")!, notes: nil,
      processingFee: Money.decimal("500")!)
    let payments = try ctx.fetch(FetchDescriptor<EmiPayment>())
    #expect(payments.count == 4) // 3 + fee sentinel
    let fee = payments.first { $0.paymentNumber == 0 }!
    #expect(fee.status == "paid" && fee.emiAmount == Money.decimal("500"))
    let m = try ctx.fetch(FetchDescriptor<PendingMutation>()).first!
    let b = try JSONSerialization.jsonObject(with: m.body!) as! [String: Any]
    #expect(b["processingFee"] as? String == "500.00")
    #expect(b["processingFeeId"] as? String == fee.id)
    #expect((b["paymentIds"] as? [String])?.count == 3) // fee id NOT in paymentIds
  }

  @Test func markPaidRejectsFeeRowAndAutoCompletes() throws {
    let (store, container) = try makeStore()
    let ctx = container.mainContext
    let emi = try store.createEmi(
      label: "L", type: .bankLoan, principal: Money.decimal("1000")!,
      interestRate: Money.decimal("0")!, tenureMonths: 2,
      startDate: WireDate.day("2026-01-01")!, notes: nil,
      processingFee: Money.decimal("50")!)
    let payments = try ctx.fetch(FetchDescriptor<EmiPayment>())
      .sorted { $0.paymentNumber < $1.paymentNumber }
    #expect(throws: StoreError.self) {
      try store.markPaymentPaid(payments[0], paid: true) // fee row
    }
    try store.markPaymentPaid(payments[1], paid: true)
    #expect(emi.status == "active")
    try store.markPaymentPaid(payments[2], paid: true)
    #expect(emi.status == "completed") // auto-complete
    try store.markPaymentPaid(payments[2], paid: false)
    #expect(emi.status == "active") // reopen
  }

  @Test func completeEmiMarksRemainingRegularPayments() throws {
    let (store, container) = try makeStore()
    let ctx = container.mainContext
    let emi = try store.createEmi(
      label: "L", type: .creditCard, principal: Money.decimal("5000")!,
      interestRate: Money.decimal("24")!, tenureMonths: 3,
      startDate: WireDate.day("2026-01-01")!, notes: nil)
    try store.completeEmi(emi)
    #expect(emi.status == "completed")
    let unpaid = try ctx.fetch(FetchDescriptor<EmiPayment>())
      .filter { $0.paymentNumber > 0 && $0.status != "paid" }
    #expect(unpaid.isEmpty)
    let last = try ctx.fetch(FetchDescriptor<PendingMutation>(
      sortBy: [SortDescriptor(\.createdAt)])).last!
    #expect(last.path == "/api/v1/emis/\(emi.id)/complete")
  }

  @Test func deleteEmiRemovesPaymentsToo() throws {
    let (store, container) = try makeStore()
    let ctx = container.mainContext
    let emi = try store.createEmi(
      label: "L", type: .bankLoan, principal: Money.decimal("1000")!,
      interestRate: Money.decimal("5")!, tenureMonths: 2,
      startDate: WireDate.day("2026-01-01")!, notes: nil)
    try store.deleteEmi(emi)
    #expect(try ctx.fetch(FetchDescriptor<Emi>()).isEmpty)
    #expect(try ctx.fetch(FetchDescriptor<EmiPayment>()).isEmpty)
  }

  @Test func notificationOpsFlipLocallyAndEnqueue() throws {
    let (store, container) = try makeStore()
    let ctx = container.mainContext
    let n1 = AppNotification(id: "n1", type: "emi.payment.due", title: "t",
      body: "b", link: nil, readAt: nil, createdAt: Date())
    let n2 = AppNotification(id: "n2", type: "emi.payment.due", title: "t",
      body: "b", link: nil, readAt: Date(), createdAt: Date())
    ctx.insert(n1); ctx.insert(n2); try ctx.save()
    try store.markNotificationRead(n1)
    #expect(n1.readAt != nil)
    try store.clearReadNotifications()
    #expect(try ctx.fetch(FetchDescriptor<AppNotification>()).isEmpty)
    let paths = try ctx.fetch(FetchDescriptor<PendingMutation>(
      sortBy: [SortDescriptor(\.createdAt)])).map(\.path)
    #expect(paths == ["/api/v1/notifications/n1/read",
                      "/api/v1/notifications/clear-read"])
  }

  @Test func profilePatchSendsAllThreeFields() throws {
    let (store, container) = try makeStore()
    let ctx = container.mainContext
    let p = Profile(id: "p1", fullName: "Old", preferredCurrency: "BDT",
                    preferredLanguage: "en", updatedAt: Date())
    ctx.insert(p); try ctx.save()
    try store.updateProfile(p, fullName: "New Name",
                            preferredCurrency: "USD", preferredLanguage: "bn")
    #expect(p.fullName == "New Name" && p.preferredCurrency == "USD")
    let m = try ctx.fetch(FetchDescriptor<PendingMutation>()).first!
    #expect(m.method == "PATCH" && m.path == "/api/v1/profile")
    let b = try JSONSerialization.jsonObject(with: m.body!) as! [String: Any]
    #expect(b["preferredLanguage"] as? String == "bn")
  }
}
```

- [x] **Step 2: Run to verify failure** (`-only-testing:PhinioTests/StoreEmiTests`). Expected: BUILD FAILED — extra argument `processingFee`, missing members.

- [x] **Step 3: Implement in `Store.swift`**

In `createEmi`, add the parameter `processingFee: Decimal? = nil` (after `notes`), and before the `body` dictionary is built insert:

```swift
    var feeId: String? = nil
    if let processingFee, processingFee > 0 {
      let id = newId()
      feeId = id
      // Sentinel fee row, mirroring the server: paymentNumber 0, pre-paid.
      context.insert(EmiPayment(
        id: id, emiId: emiId, paymentNumber: 0, dueDate: startDate,
        emiAmount: processingFee, principalComponent: 0, interestComponent: 0,
        remainingBalance: principal, status: "paid", paidAt: now,
        updatedAt: now))
    }
```

and after the existing `if let notes { ... }` line in `createEmi`:

```swift
    if let processingFee, processingFee > 0 {
      body["processingFee"] = Money.string(processingFee)
      body["processingFeeId"] = feeId!
    }
```

Replace the whole `markPaymentPaid` with:

```swift
  func markPaymentPaid(_ payment: EmiPayment, paid: Bool) throws {
    guard payment.paymentNumber > 0 else {
      throw StoreError.validation("Processing fee cannot be modified")
    }
    payment.status = paid ? "paid" : "upcoming"
    payment.paidAt = paid ? Date() : nil
    payment.updatedAt = Date()
    // Auto-complete / reopen the parent EMI, mirroring markPaymentPaidImpl.
    let emiId = payment.emiId
    if let emi = try context.fetch(FetchDescriptor<Emi>(
      predicate: #Predicate { $0.id == emiId })).first {
      let unpaidRemain = try context.fetch(FetchDescriptor<EmiPayment>(
        predicate: #Predicate { $0.emiId == emiId }))
        .contains { $0.paymentNumber > 0 && $0.status != "paid" }
      if paid && !unpaidRemain {
        emi.status = "completed"
        emi.updatedAt = Date()
      } else if !paid && emi.status == "completed" {
        emi.status = "active"
        emi.updatedAt = Date()
      }
    }
    try enqueue(
      method: "POST",
      path: "/api/v1/emi-payments/\(payment.id)/mark-paid",
      body: ["paid": paid])
    try context.save()
  }
```

Append the remaining ops inside `Store`:

```swift
  // MARK: - EMI management

  func updateEmi(_ emi: Emi, label: String, notes: String?) throws {
    emi.label = label
    emi.notes = notes
    emi.updatedAt = Date()
    var body: [String: Any] = ["label": label]
    if let notes { body["notes"] = notes }
    try enqueue(method: "PATCH", path: "/api/v1/emis/\(emi.id)", body: body)
    try context.save()
  }

  func deleteEmi(_ emi: Emi) throws {
    let emiId = emi.id
    for p in try context.fetch(FetchDescriptor<EmiPayment>(
      predicate: #Predicate { $0.emiId == emiId })) {
      context.delete(p)
    }
    context.delete(emi)
    try enqueue(method: "DELETE", path: "/api/v1/emis/\(emiId)", body: [:])
    try context.save()
  }

  func completeEmi(_ emi: Emi) throws {
    let emiId = emi.id
    let now = Date()
    for p in try context.fetch(FetchDescriptor<EmiPayment>(
      predicate: #Predicate { $0.emiId == emiId }))
    where p.paymentNumber > 0 && p.status != "paid" {
      p.status = "paid"
      p.paidAt = now
      p.updatedAt = now
    }
    emi.status = "completed"
    emi.updatedAt = now
    try enqueue(method: "POST", path: "/api/v1/emis/\(emiId)/complete", body: [:])
    try context.save()
  }

  // MARK: - Notifications

  func markNotificationRead(_ n: AppNotification) throws {
    n.readAt = Date()
    try enqueue(method: "POST", path: "/api/v1/notifications/\(n.id)/read",
                body: [:])
    try context.save()
  }

  func markAllNotificationsRead() throws {
    let now = Date()
    for n in try context.fetch(FetchDescriptor<AppNotification>(
      predicate: #Predicate { $0.readAt == nil })) {
      n.readAt = now
    }
    try enqueue(method: "POST", path: "/api/v1/notifications/read-all", body: [:])
    try context.save()
  }

  func clearReadNotifications() throws {
    for n in try context.fetch(FetchDescriptor<AppNotification>(
      predicate: #Predicate { $0.readAt != nil })) {
      context.delete(n)
    }
    try enqueue(method: "POST", path: "/api/v1/notifications/clear-read",
                body: [:])
    try context.save()
  }

  // MARK: - Profile

  func updateProfile(_ p: Profile, fullName: String, preferredCurrency: String,
                     preferredLanguage: String) throws {
    p.fullName = fullName
    p.preferredCurrency = preferredCurrency
    p.preferredLanguage = preferredLanguage
    p.updatedAt = Date()
    try enqueue(method: "PATCH", path: "/api/v1/profile", body: [
      "fullName": fullName,
      "preferredCurrency": preferredCurrency,
      "preferredLanguage": preferredLanguage,
    ])
    try context.save()
  }
```

- [x] **Step 4: Run ALL Store tests — expect PASS** (`-only-testing:PhinioTests/StoreEmiTests -only-testing:PhinioTests/StoreTests -only-testing:PhinioTests/StoreInvestmentTests`). The pre-existing `StoreTests.markPaymentPaidFlipsStatusAndEnqueues` must still pass (it marks a regular payment — unaffected by the fee guard).

- [x] **Step 5: Commit**

```bash
git add apps/ios/Phinio/Phinio/Sync/Store.swift apps/ios/Phinio/PhinioTests/StoreEmiTests.swift
git commit -m "✨ feat(ios): Store EMI management, notifications + profile writes"
```

---

### Task 4: Local dashboard stats

**Files:**
- Create: `apps/ios/Phinio/Phinio/Domain/DashboardStats.swift`
- Test: `apps/ios/Phinio/PhinioTests/DashboardStatsTests.swift`

**Interfaces:**
- Consumes: models from `DomainModels.swift`, `utcDaysUntil` from Task 1.
- Produces:
  ```swift
  struct UpcomingItem: Identifiable {
    enum Kind { case emi, deposit }
    let id: String; let kind: Kind; let parentId: String // emiId / investmentId
    let label: String; let amount: Decimal; let dueDate: Date
    let sequenceNumber: Int?; let daysUntilDue: Int
    var isOverdue: Bool { daysUntilDue < 0 }
  }
  struct DashboardStats {
    let netWorth: Decimal; let invested: Decimal; let current: Decimal
    let gainLossPercent: Double? // nil when invested == 0 ("No holdings")
    let monthlyEmiOutflow: Decimal
    let upcoming: [UpcomingItem]
    let allocation: [(type: String, value: Decimal, percent: Double)]
    static func compute(
      investments: [Investment], emis: [Emi], payments: [EmiPayment],
      deposits: [InvestmentDeposit], withdrawals: [InvestmentWithdrawal],
      now: Date) -> DashboardStats
  }
  ```

This is a pure-function port of `src/server/dashboard.impl.ts` (lines 122–216). Rules, verbatim from the server: totals over **active** investments only; `gainLossPercent = (current + withdrawn − invested) / invested × 100` rounded to 2 dp; remaining EMI balance = each active EMI's **next-unpaid** payment's `remainingBalance` (NOT a sum of emiAmounts); `netWorth = current − remainingEmiBalance`; allocation = share of `current` by type, sorted desc; upcoming = unpaid EMI payments (`paymentNumber > 0`, due ≤ now+30d, take 5) merged with upcoming DPS deposits (dueDate non-nil ≤ 30d, parent `mode == "scheduled" && status == "active"`, take 5), sorted by dueDate, take 5 overall; overdue/daysUntil by UTC day.

- [x] **Step 1: Write the failing tests**

```swift
// apps/ios/Phinio/PhinioTests/DashboardStatsTests.swift
import Foundation
import Testing
@testable import Phinio

struct DashboardStatsTests {
  private let now = WireDate.timestamp("2026-07-17T10:00:00.000Z")!

  private func investment(_ id: String, type: String, invested: String,
                          current: String, status: String = "active",
                          mode: String = "lump_sum") -> Investment {
    Investment(id: id, name: id, type: type, mode: mode, status: status,
      investedAmount: Money.decimal(invested)!,
      currentValue: Money.decimal(current)!, exitValue: nil,
      dateOfInvestment: nil, startDate: nil, monthlyDeposit: nil,
      tenureMonths: nil, interestRate: nil, interestType: nil,
      estimatedClosureDate: nil, completedAt: nil, notes: nil, updatedAt: now)
  }

  @Test func formulasMirrorTheServer() {
    let invs = [
      investment("a", type: "gold", invested: "1000", current: "1200"),
      investment("b", type: "stock", invested: "500", current: "300"),
      investment("c", type: "gold", invested: "999", current: "999",
                 status: "completed"), // excluded
    ]
    let wd = [InvestmentWithdrawal(id: "w1", investmentId: "a",
      amount: Money.decimal("100")!, withdrawalDate: now, notes: nil)]
    let emi = Emi(id: "e1", label: "Loan", type: "bank_loan",
      principal: Money.decimal("10000")!, interestRate: Money.decimal("10")!,
      tenureMonths: 12, emiAmount: Money.decimal("879.16")!,
      startDate: now, status: "active", notes: nil, updatedAt: now)
    let pay = [
      EmiPayment(id: "p1", emiId: "e1", paymentNumber: 1,
        dueDate: WireDate.day("2026-07-20")!, emiAmount: Money.decimal("879.16")!,
        principalComponent: Money.decimal("795.83")!,
        interestComponent: Money.decimal("83.33")!,
        remainingBalance: Money.decimal("9204.17")!, status: "upcoming",
        paidAt: nil, updatedAt: now),
      EmiPayment(id: "p2", emiId: "e1", paymentNumber: 2,
        dueDate: WireDate.day("2026-08-20")!, emiAmount: Money.decimal("879.16")!,
        principalComponent: Money.decimal("802.46")!,
        interestComponent: Money.decimal("76.70")!,
        remainingBalance: Money.decimal("8401.71")!, status: "upcoming",
        paidAt: nil, updatedAt: now),
    ]
    let s = DashboardStats.compute(investments: invs, emis: [emi],
      payments: pay, deposits: [], withdrawals: wd, now: now)
    #expect(s.invested == Money.decimal("1500"))
    #expect(s.current == Money.decimal("1500"))
    // (1500 + 100 − 1500) / 1500 = 6.67%
    #expect(s.gainLossPercent == 6.67)
    #expect(s.monthlyEmiOutflow == Money.decimal("879.16"))
    // netWorth = 1500 − next-unpaid remainingBalance (9204.17). Negated from
    // a positive: Money.decimal mirrors the server's unsigned money regex, so
    // it returns nil for "-7704.17" — net worth may legitimately be negative.
    #expect(s.netWorth == -Money.decimal("7704.17")!)
    #expect(s.allocation.first?.type == "gold")
    #expect(s.allocation.first?.percent == 80.0)
    // Only p1 is within 30 days (Aug 20 is 34 days out)
    #expect(s.upcoming.map(\.id) == ["p1"])
    #expect(s.upcoming[0].daysUntilDue == 3)
    #expect(!s.upcoming[0].isOverdue)
  }

  @Test func emptyPortfolioHasNilGainAndZeroes() {
    let s = DashboardStats.compute(investments: [], emis: [], payments: [],
      deposits: [], withdrawals: [], now: now)
    #expect(s.gainLossPercent == nil)
    #expect(s.netWorth == 0 && s.upcoming.isEmpty && s.allocation.isEmpty)
  }

  @Test func upcomingMergesDpsDepositsAndSortsByDueDate() {
    let dps = investment("d1", type: "dps", invested: "0", current: "0",
                         mode: "scheduled")
    let dep = InvestmentDeposit(id: "dd1", investmentId: "d1",
      amount: Money.decimal("1000")!, dueDate: WireDate.day("2026-07-16")!,
      depositDate: nil, installmentNumber: 3, status: "upcoming", notes: nil,
      updatedAt: now)
    let s = DashboardStats.compute(investments: [dps], emis: [], payments: [],
      deposits: [dep], withdrawals: [], now: now)
    #expect(s.upcoming.count == 1)
    #expect(s.upcoming[0].kind == .deposit)
    #expect(s.upcoming[0].isOverdue) // due yesterday
    #expect(s.upcoming[0].sequenceNumber == 3)
  }
}
```

- [x] **Step 2: Run to verify failure** (`-only-testing:PhinioTests/DashboardStatsTests`). Expected: BUILD FAILED, `DashboardStats` unresolved.

- [x] **Step 3: Implement**

```swift
// apps/ios/Phinio/Phinio/Domain/DashboardStats.swift
import Foundation

struct UpcomingItem: Identifiable {
  enum Kind { case emi, deposit }
  let id: String
  let kind: Kind
  let parentId: String
  let label: String
  let amount: Decimal
  let dueDate: Date
  let sequenceNumber: Int?
  let daysUntilDue: Int
  var isOverdue: Bool { daysUntilDue < 0 }
}

/// Pure port of getDashboardStatsImpl (src/server/dashboard.impl.ts).
/// Computed locally so the dashboard works offline; Decimal instead of the
/// server's Number() float math — differences are sub-paisa and invisible
/// after currency formatting.
struct DashboardStats {
  let netWorth: Decimal
  let invested: Decimal
  let current: Decimal
  let gainLossPercent: Double?
  let monthlyEmiOutflow: Decimal
  let upcoming: [UpcomingItem]
  let allocation: [(type: String, value: Decimal, percent: Double)]

  static func compute(
    investments: [Investment], emis: [Emi], payments: [EmiPayment],
    deposits: [InvestmentDeposit], withdrawals: [InvestmentWithdrawal],
    now: Date
  ) -> DashboardStats {
    let active = investments.filter { $0.status == "active" }
    let withdrawnByInv = Dictionary(grouping: withdrawals, by: \.investmentId)
      .mapValues { $0.reduce(Decimal(0)) { $0 + $1.amount } }

    var invested: Decimal = 0
    var current: Decimal = 0
    var withdrawn: Decimal = 0
    var byType: [String: Decimal] = [:]
    for inv in active {
      invested += inv.investedAmount
      current += inv.currentValue
      withdrawn += withdrawnByInv[inv.id] ?? 0
      byType[inv.type, default: 0] += inv.currentValue
    }

    let gainLossPercent: Double? = invested > 0
      ? (Double(truncating: NSDecimalNumber(
          decimal: (current + withdrawn - invested) / invested)) * 10000)
          .rounded() / 100
      : nil

    let activeEmis = emis.filter { $0.status == "active" }
    let paymentsByEmi = Dictionary(grouping: payments, by: \.emiId)
    var remainingEmiBalance: Decimal = 0
    var monthlyOutflow: Decimal = 0
    for emi in activeEmis {
      monthlyOutflow += emi.emiAmount
      // Next-unpaid payment's stored remainingBalance, not a sum of
      // emiAmounts (those include interest and overstate the liability).
      let nextUnpaid = (paymentsByEmi[emi.id] ?? [])
        .filter { $0.paymentNumber > 0 && $0.status != "paid" }
        .min { $0.paymentNumber < $1.paymentNumber }
      if let nextUnpaid { remainingEmiBalance += nextUnpaid.remainingBalance }
    }

    let totalAlloc = current
    let allocation = byType
      .map { (type: $0.key, value: $0.value,
              percent: totalAlloc > 0
                ? (Double(truncating: NSDecimalNumber(
                    decimal: $0.value / totalAlloc)) * 10000).rounded() / 100
                : 0) }
      .sorted { $0.value > $1.value }

    let horizon = now.addingTimeInterval(30 * 24 * 60 * 60)
    let emiById = Dictionary(uniqueKeysWithValues: emis.map { ($0.id, $0) })
    let upcomingEmi = payments
      .filter { $0.status != "paid" && $0.paymentNumber > 0 && $0.dueDate <= horizon }
      .sorted { $0.dueDate < $1.dueDate }
      .prefix(5)
      .compactMap { p -> UpcomingItem? in
        guard let emi = emiById[p.emiId] else { return nil }
        return UpcomingItem(
          id: p.id, kind: .emi, parentId: p.emiId, label: emi.label,
          amount: p.emiAmount, dueDate: p.dueDate,
          sequenceNumber: p.paymentNumber,
          daysUntilDue: utcDaysUntil(p.dueDate, from: now))
      }
    let scheduledActive = Dictionary(uniqueKeysWithValues:
      investments.filter { $0.mode == "scheduled" && $0.status == "active" }
        .map { ($0.id, $0) })
    let upcomingDeposits = deposits
      .filter {
        $0.status != "paid" && $0.dueDate != nil && $0.dueDate! <= horizon
          && scheduledActive[$0.investmentId] != nil
      }
      .sorted { $0.dueDate! < $1.dueDate! }
      .prefix(5)
      .map { d in
        UpcomingItem(
          id: d.id, kind: .deposit, parentId: d.investmentId,
          label: scheduledActive[d.investmentId]!.name, amount: d.amount,
          dueDate: d.dueDate!, sequenceNumber: d.installmentNumber,
          daysUntilDue: utcDaysUntil(d.dueDate!, from: now))
      }
    let upcoming = Array((upcomingEmi + upcomingDeposits)
      .sorted { $0.dueDate < $1.dueDate }
      .prefix(5))

    return DashboardStats(
      netWorth: current - remainingEmiBalance,
      invested: invested, current: current,
      gainLossPercent: gainLossPercent,
      monthlyEmiOutflow: monthlyOutflow,
      upcoming: upcoming, allocation: allocation)
  }
}
```

- [x] **Step 4: Run tests — expect PASS.**

- [x] **Step 5: Commit**

```bash
git add apps/ios/Phinio/Phinio/Domain/DashboardStats.swift apps/ios/Phinio/PhinioTests/DashboardStatsTests.swift
git commit -m "✨ feat(ios): local dashboard stats — port of getDashboardStatsImpl"
```

---

### Task 5: Tab shell, shared UI atoms, deep-link router

**Files:**
- Create: `apps/ios/Phinio/Phinio/UI/MainTabView.swift`
- Create: `apps/ios/Phinio/Phinio/UI/SharedViews.swift`
- Create: `apps/ios/Phinio/Phinio/Support/DeepLink.swift`
- Modify: `apps/ios/Phinio/Phinio/PhinioApp.swift` (`RootView` swaps `DebugHomeView()` → `MainTabView()`; inject `DeepLinkRouter`)
- Delete: `apps/ios/Phinio/Phinio/UI/DebugHomeView.swift`
- Test: `apps/ios/Phinio/PhinioTests/DeepLinkTests.swift`

**Interfaces:**
- Produces:
  - `enum DeepLink: Equatable { case emi(String); case dps(String) }` with `DeepLink.parse(_ link: String) -> DeepLink?` (parses the server's notification `link` strings `/app/emis/<id>` and `/app/investments/dps/<id>`)
  - `@MainActor final class DeepLinkRouter: ObservableObject { @Published var pending: DeepLink? }`
  - Route value types the tab stacks push: `struct EmiRoute: Hashable { let id: String }`, `struct InvestmentRoute: Hashable { let id: String }` (detail views resolve mode themselves)
  - Shared atoms in `SharedViews.swift`: `MoneyText(amount: Decimal)` (queries the profile for currency, defaults `BDT`), `EmptyStateView(symbol: String, title: String, message: String)`, `UpcomingRow(item: UpcomingItem)`
- Consumes: placeholder screens — this task stubs `DashboardView`, `InvestmentsListView`, `EmiListView`, `ActivityView` as `Text` placeholders IN `MainTabView.swift`; Tasks 6–11 replace them with real files and delete the stubs.

- [x] **Step 1: Write the failing deep-link test**

```swift
// apps/ios/Phinio/PhinioTests/DeepLinkTests.swift
import Testing
@testable import Phinio

struct DeepLinkTests {
  @Test func parsesServerLinkStrings() {
    #expect(DeepLink.parse("/app/emis/abc-123") == .emi("abc-123"))
    #expect(DeepLink.parse("/app/investments/dps/xyz") == .dps("xyz"))
    #expect(DeepLink.parse("/app/activity") == nil)
    #expect(DeepLink.parse("") == nil)
  }
}
```

- [x] **Step 2: Run to verify failure**, then implement:

```swift
// apps/ios/Phinio/Phinio/Support/DeepLink.swift
import Combine
import Foundation

/// Parses the `link` field the reminder cron puts in notifications
/// (send-reminders.ts): "/app/emis/<id>" and "/app/investments/dps/<id>".
enum DeepLink: Equatable {
  case emi(String)
  case dps(String)

  static func parse(_ link: String) -> DeepLink? {
    let parts = link.split(separator: "/").map(String.init)
    if parts.count == 3, parts[0] == "app", parts[1] == "emis" {
      return .emi(parts[2])
    }
    if parts.count == 4, parts[0] == "app", parts[1] == "investments",
       parts[2] == "dps" {
      return .dps(parts[3])
    }
    return nil
  }
}

@MainActor
final class DeepLinkRouter: ObservableObject {
  @Published var pending: DeepLink?
}
```

```swift
// apps/ios/Phinio/Phinio/UI/SharedViews.swift
import SwiftData
import SwiftUI

/// Amount rendered in the profile's preferred currency (BDT until synced).
struct MoneyText: View {
  let amount: Decimal
  @Query private var profiles: [Profile]

  var body: some View {
    Text(amount.currency(profiles.first?.preferredCurrency ?? "BDT"))
  }
}

struct EmptyStateView: View {
  let symbol: String
  let title: String
  let message: String

  var body: some View {
    ContentUnavailableView(
      title, systemImage: symbol, description: Text(message))
  }
}

struct UpcomingRow: View {
  let item: UpcomingItem

  var body: some View {
    HStack {
      VStack(alignment: .leading) {
        Text(item.label).font(.body)
        Text(item.sequenceNumber.map { "#\($0) · " } ?? "")
          .font(.caption).foregroundStyle(.secondary)
        + Text(dueLabel(daysUntil: item.daysUntilDue))
          .font(.caption)
          .foregroundStyle(item.isOverdue ? AnyShapeStyle(.red)
                                          : AnyShapeStyle(.secondary))
      }
      Spacer()
      MoneyText(amount: item.amount).font(.body.monospacedDigit())
    }
  }
}
```

```swift
// apps/ios/Phinio/Phinio/UI/MainTabView.swift
import SwiftUI

struct EmiRoute: Hashable { let id: String }
struct InvestmentRoute: Hashable { let id: String }

struct MainTabView: View {
  @EnvironmentObject private var deepLink: DeepLinkRouter
  @State private var tab: Tab = .dashboard
  @State private var investmentsPath = NavigationPath()
  @State private var emisPath = NavigationPath()

  enum Tab { case dashboard, investments, emis, activity }

  var body: some View {
    TabView(selection: $tab) {
      SwiftUI.Tab("Dashboard", systemImage: "chart.pie", value: Tab.dashboard) {
        NavigationStack { DashboardView() }
      }
      SwiftUI.Tab("Investments", systemImage: "banknote", value: Tab.investments) {
        NavigationStack(path: $investmentsPath) {
          InvestmentsListView()
            .navigationDestination(for: InvestmentRoute.self) {
              InvestmentDetailRouter(investmentId: $0.id)
            }
        }
      }
      SwiftUI.Tab("EMIs", systemImage: "creditcard", value: Tab.emis) {
        NavigationStack(path: $emisPath) {
          EmiListView()
            .navigationDestination(for: EmiRoute.self) {
              EmiDetailView(emiId: $0.id)
            }
        }
      }
      SwiftUI.Tab("Activity", systemImage: "clock.arrow.circlepath", value: Tab.activity) {
        NavigationStack { ActivityView() }
      }
    }
    .onChange(of: deepLink.pending) { _, link in
      guard let link else { return }
      deepLink.pending = nil
      switch link {
      case .emi(let id):
        tab = .emis
        emisPath.append(EmiRoute(id: id))
      case .dps(let id):
        tab = .investments
        investmentsPath.append(InvestmentRoute(id: id))
      }
    }
  }
}

// Placeholder stubs — replaced by Tasks 6–11 (each task deletes its stub here
// and creates the real file).
struct DashboardView: View { var body: some View { Text("Dashboard") } }
struct InvestmentsListView: View { var body: some View { Text("Investments") } }
struct InvestmentDetailRouter: View {
  let investmentId: String
  var body: some View { Text(investmentId) }
}
struct EmiListView: View { var body: some View { Text("EMIs") } }
struct EmiDetailView: View {
  let emiId: String
  var body: some View { Text(emiId) }
}
struct ActivityView: View { var body: some View { Text("Activity") } }
```

In `PhinioApp.swift`: add `private let deepLinkRouter = DeepLinkRouter()` as a stored property of `PhinioApp` (a plain `let`, NOT `@StateObject` — the App struct lives for the process, and Task 14's AppDelegate needs a reference it can grab in `init()`), pass `.environmentObject(deepLinkRouter)` alongside the existing environment objects, and in `RootView` replace `DebugHomeView()` with `MainTabView()`. Delete `UI/DebugHomeView.swift`.

- [x] **Step 3: Run the full suite — expect PASS** (DeepLinkTests green; nothing else regressed). Build the app target too.

- [x] **Step 4: Commit**

```bash
git add -A apps/ios/Phinio
git commit -m "✨ feat(ios): 4-tab shell, deep-link router + shared UI atoms"
```

---

### Task 6: Dashboard screen

**Files:**
- Create: `apps/ios/Phinio/Phinio/UI/Dashboard/DashboardView.swift`
- Modify: `apps/ios/Phinio/Phinio/UI/MainTabView.swift` (delete the `DashboardView` stub)

**Interfaces:**
- Consumes: `DashboardStats.compute` (Task 4), `MoneyText`/`UpcomingRow`/`EmptyStateView` (Task 5), `EmiRoute`/`InvestmentRoute`, `sync.state`, `SettingsView` (Task 12 — until then, reference a placeholder `SettingsView` stub added HERE and replaced in Task 12).
- Produces: `DashboardView` (used by the tab shell). Adds a `SettingsView` stub `struct SettingsView: View { var body: some View { Text("Settings") } }` at the bottom of this file — Task 12 deletes it.

No unit test (pure SwiftUI over an already-tested pure function); verification is build + manual, per spec.

- [x] **Step 1: Implement**

```swift
// apps/ios/Phinio/Phinio/UI/Dashboard/DashboardView.swift
import Charts
import SwiftData
import SwiftUI

struct DashboardView: View {
  @EnvironmentObject private var sync: SyncEngine
  @Query private var investments: [Investment]
  @Query private var emis: [Emi]
  @Query private var payments: [EmiPayment]
  @Query private var deposits: [InvestmentDeposit]
  @Query private var withdrawals: [InvestmentWithdrawal]

  private var stats: DashboardStats {
    DashboardStats.compute(
      investments: investments, emis: emis, payments: payments,
      deposits: deposits, withdrawals: withdrawals, now: Date())
  }

  private var isEmptyPortfolio: Bool {
    stats.invested == 0 && stats.monthlyEmiOutflow == 0
      && stats.upcoming.isEmpty && stats.allocation.isEmpty
  }

  var body: some View {
    ScrollView {
      if isEmptyPortfolio {
        EmptyStateView(
          symbol: "chart.pie",
          title: "Welcome to Phinio",
          message: "Add your first investment or EMI to see your dashboard.")
          .padding(.top, 80)
      } else {
        VStack(spacing: 16) {
          statCards
          if !stats.allocation.isEmpty { allocationCard }
          upcomingSection
        }
        .padding()
      }
    }
    .navigationTitle("Dashboard")
    .toolbar {
      ToolbarItem(placement: .topBarLeading) { syncBadge }
      ToolbarItem(placement: .topBarTrailing) {
        NavigationLink { SettingsView() } label: {
          Image(systemName: "gearshape")
        }
      }
    }
    .refreshable { await sync.syncNow() }
  }

  // Custom chrome → Liquid Glass per spec §3.
  private var statCards: some View {
    GlassEffectContainer {
      VStack(spacing: 12) {
        VStack(spacing: 4) {
          Text("Net worth").font(.caption).foregroundStyle(.secondary)
          MoneyText(amount: stats.netWorth)
            .font(.system(.largeTitle, design: .rounded, weight: .bold))
          Text("Assets minus remaining EMI balance")
            .font(.caption2).foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .glassEffect(in: .rect(cornerRadius: 20))

        HStack(spacing: 12) {
          VStack(alignment: .leading, spacing: 4) {
            Text("Invested").font(.caption).foregroundStyle(.secondary)
            MoneyText(amount: stats.current).font(.title3.bold())
            if let gain = stats.gainLossPercent {
              Text(gain, format: .number.sign(strategy: .always())
                     .precision(.fractionLength(2)))
              + Text("%")
            } else {
              Text("No holdings").font(.caption).foregroundStyle(.tertiary)
            }
          }
          .font(.caption)
          .foregroundStyle((stats.gainLossPercent ?? 0) >= 0 ? .green : .red)
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding()
          .glassEffect(in: .rect(cornerRadius: 20))

          VStack(alignment: .leading, spacing: 4) {
            Text("Monthly EMI").font(.caption).foregroundStyle(.secondary)
            MoneyText(amount: stats.monthlyEmiOutflow).font(.title3.bold())
            Text(stats.monthlyEmiOutflow > 0 ? "Total outflow" : "No EMIs yet")
              .font(.caption).foregroundStyle(.tertiary)
          }
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding()
          .glassEffect(in: .rect(cornerRadius: 20))
        }
      }
    }
  }

  private var allocationCard: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("Allocation").font(.headline)
      Chart(stats.allocation, id: \.type) { slice in
        SectorMark(
          angle: .value("Value", Double(truncating:
            NSDecimalNumber(decimal: slice.value))),
          innerRadius: .ratio(0.6), angularInset: 1.5)
          .foregroundStyle(by: .value("Type", investmentTypeLabel(slice.type)))
      }
      .frame(height: 200)
      ForEach(stats.allocation, id: \.type) { slice in
        HStack {
          Text(investmentTypeLabel(slice.type)).font(.caption)
          Spacer()
          Text(slice.percent, format: .number.precision(.fractionLength(2)))
            .font(.caption.monospacedDigit()).foregroundStyle(.secondary)
          + Text("%").font(.caption).foregroundStyle(.secondary)
        }
      }
    }
    .padding()
    .background(.fill.tertiary, in: .rect(cornerRadius: 20))
  }

  private var upcomingSection: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("Upcoming payments").font(.headline)
      if stats.upcoming.isEmpty {
        Text("Nothing due in the next 30 days")
          .font(.subheadline).foregroundStyle(.secondary)
      } else {
        ForEach(stats.upcoming) { item in
          NavigationLink(value: destination(for: item)) {
            UpcomingRow(item: item)
          }
          .buttonStyle(.plain)
          Divider()
        }
      }
    }
    .padding()
    .background(.fill.tertiary, in: .rect(cornerRadius: 20))
  }

  private func destination(for item: UpcomingItem) -> AnyHashable {
    switch item.kind {
    case .emi: EmiRoute(id: item.parentId)
    case .deposit: InvestmentRoute(id: item.parentId)
    }
  }

  @ViewBuilder private var syncBadge: some View {
    switch sync.state {
    case .syncing: ProgressView().controlSize(.small)
    case .offline: Image(systemName: "wifi.slash").foregroundStyle(.secondary)
    case .idle, .unauthorized: EmptyView()
    }
  }
}

// Placeholder — replaced by Task 12.
struct SettingsView: View { var body: some View { Text("Settings") } }
```

Dashboard tab's `NavigationStack` needs the same destinations as the other tabs for the upcoming rows to resolve — in `MainTabView.swift` change the dashboard tab to:

```swift
      SwiftUI.Tab("Dashboard", systemImage: "chart.pie", value: Tab.dashboard) {
        NavigationStack {
          DashboardView()
            .navigationDestination(for: EmiRoute.self) {
              EmiDetailView(emiId: $0.id)
            }
            .navigationDestination(for: InvestmentRoute.self) {
              InvestmentDetailRouter(investmentId: $0.id)
            }
        }
      }
```

and delete the `DashboardView` stub from `MainTabView.swift`.

- [x] **Step 2: Build — expect SUCCESS.** `AnyHashable` in `NavigationLink(value:)` requires the destinations registered above; if the compiler rejects `AnyHashable`, split the row into two `NavigationLink`s inside a `switch item.kind` instead.

- [x] **Step 3: Manual check** — run in the simulator against `npm run dev`, sign in with an account that has data (or create a sample EMI from the EMIs tab once Task 10 lands). Fresh accounts must show the welcome empty state, not zeroed cards.

- [x] **Step 4: Commit**

```bash
git add -A apps/ios/Phinio
git commit -m "✨ feat(ios): dashboard — glass stat cards, allocation donut, upcoming list"
```

---

### Task 7: Investments list + lump-sum form, detail, withdraw sheet

**Files:**
- Create: `apps/ios/Phinio/Phinio/UI/Investments/InvestmentsListView.swift`
- Create: `apps/ios/Phinio/Phinio/UI/Investments/LumpSumDetailView.swift`
- Create: `apps/ios/Phinio/Phinio/UI/Investments/LumpSumFormView.swift`
- Create: `apps/ios/Phinio/Phinio/UI/Investments/WithdrawSheet.swift`
- Modify: `apps/ios/Phinio/Phinio/UI/MainTabView.swift` (delete `InvestmentsListView` + `InvestmentDetailRouter` stubs)

**Interfaces:**
- Consumes: `Store` investment ops (Task 2), `Validate` (Task 1), `MoneyText`/`EmptyStateView` (Task 5).
- Produces: `InvestmentsListView`; `InvestmentDetailRouter(investmentId:)` which dispatches on `mode` — `lump_sum` → `LumpSumDetailView`, `flexible` → `SavingsDetailView` (Task 8), `scheduled` → `DpsDetailView` (Task 9). Until Tasks 8/9 land, the router shows `Text("…")` for those modes — this task creates the router with those two arms as placeholders and Tasks 8/9 fill them in.
- Produces: `WithdrawSheet(investment:)` — reused by Task 8's savings detail.

- [x] **Step 1: Implement the list + router**

```swift
// apps/ios/Phinio/Phinio/UI/Investments/InvestmentsListView.swift
import SwiftData
import SwiftUI

struct InvestmentsListView: View {
  @Query(sort: \Investment.updatedAt, order: .reverse)
  private var investments: [Investment]
  @State private var showCompleted = false
  @State private var creating: CreateKind?

  enum CreateKind: String, Identifiable {
    case lumpSum, savings, dps
    var id: String { rawValue }
  }

  private var filtered: [Investment] {
    // Web filter: active = ['active']; completed = ['completed','matured','closed']
    investments.filter {
      showCompleted ? $0.status != "active" : $0.status == "active"
    }
  }

  private var grouped: [(type: String, items: [Investment])] {
    Dictionary(grouping: filtered, by: \.type)
      .map { (type: $0.key, items: $0.value) }
      .sorted { $0.type < $1.type }
  }

  var body: some View {
    List {
      Picker("Filter", selection: $showCompleted) {
        Text("Active").tag(false)
        Text("Completed").tag(true)
      }
      .pickerStyle(.segmented)
      .listRowBackground(Color.clear)

      ForEach(grouped, id: \.type) { group in
        Section(investmentTypeLabel(group.type)) {
          ForEach(group.items) { inv in
            NavigationLink(value: InvestmentRoute(id: inv.id)) {
              HStack {
                VStack(alignment: .leading) {
                  Text(inv.name)
                  Text(inv.status.capitalized)
                    .font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                MoneyText(amount: inv.currentValue)
                  .font(.body.monospacedDigit())
              }
            }
          }
        }
      }
    }
    .overlay {
      if filtered.isEmpty {
        EmptyStateView(symbol: "banknote", title: "No investments",
          message: showCompleted ? "Nothing completed yet."
                                 : "Add your first investment.")
      }
    }
    .navigationTitle("Investments")
    .toolbar {
      Menu {
        Button("Lump sum") { creating = .lumpSum }
        Button("Savings") { creating = .savings }
        Button("DPS") { creating = .dps }
      } label: {
        Image(systemName: "plus")
      }
    }
    .sheet(item: $creating) { kind in
      switch kind {
      case .lumpSum: LumpSumFormView(existing: nil)
      case .savings: SavingsFormView(existing: nil)
      case .dps: DpsFormView()
      }
    }
  }
}

/// Detail dispatch by mode. Detail views take an id and re-query so a
/// deep link works and deletion pops gracefully.
struct InvestmentDetailRouter: View {
  let investmentId: String
  @Query private var matches: [Investment]

  init(investmentId: String) {
    self.investmentId = investmentId
    _matches = Query(filter: #Predicate<Investment> { $0.id == investmentId })
  }

  var body: some View {
    if let inv = matches.first {
      switch inv.mode {
      case "flexible": SavingsDetailView(investment: inv)
      case "scheduled": DpsDetailView(investment: inv)
      default: LumpSumDetailView(investment: inv)
      }
    } else {
      EmptyStateView(symbol: "questionmark.circle", title: "Not found",
        message: "This investment is no longer on this device.")
    }
  }
}
```

Until Tasks 8/9 land, add temporary stubs at the bottom of this file (each later task deletes its stub):

```swift
// Stubs — Task 8 / Task 9 replace these with real files.
struct SavingsDetailView: View {
  let investment: Investment
  var body: some View { Text(investment.name) }
}
struct SavingsFormView: View {
  let existing: Investment?
  var body: some View { Text("Savings form") }
}
struct DpsDetailView: View {
  let investment: Investment
  var body: some View { Text(investment.name) }
}
struct DpsFormView: View { var body: some View { Text("DPS form") } }
```

- [x] **Step 2: Implement the lump-sum form**

```swift
// apps/ios/Phinio/Phinio/UI/Investments/LumpSumFormView.swift
import SwiftData
import SwiftUI

/// Create + edit for lump-sum investments. Mirrors investmentCreateSchema /
/// investmentUpdateSchema: name, type enum, positive money amounts, dates.
struct LumpSumFormView: View {
  let existing: Investment?
  @Environment(\.dismiss) private var dismiss
  @Environment(\.modelContext) private var context
  @EnvironmentObject private var sync: SyncEngine

  static let types = ["stock", "mutual_fund", "fd", "gold", "crypto",
                      "sanchayapatra", "real_estate", "agro_farm",
                      "business", "other"]

  @State private var name = ""
  @State private var type = "stock"
  @State private var investedAmount = ""
  @State private var currentValue = ""
  @State private var dateOfInvestment = Date()
  @State private var hasClosureDate = false
  @State private var estimatedClosureDate = Date()
  @State private var notes = ""
  @State private var completed = false
  @State private var exitValue = ""
  @State private var completedAt = Date()
  @State private var error: String?

  var body: some View {
    NavigationStack {
      Form {
        Section {
          TextField("Name", text: $name)
          Picker("Type", selection: $type) {
            ForEach(Self.types, id: \.self) { Text(investmentTypeLabel($0)) }
          }
          TextField("Invested amount", text: $investedAmount)
            .keyboardType(.decimalPad)
          TextField("Current value", text: $currentValue)
            .keyboardType(.decimalPad)
          DatePicker("Date of investment", selection: $dateOfInvestment,
                     displayedComponents: .date)
          Toggle("Estimated closure date", isOn: $hasClosureDate)
          if hasClosureDate {
            DatePicker("Closes on", selection: $estimatedClosureDate,
                       displayedComponents: .date)
          }
          TextField("Notes", text: $notes, axis: .vertical)
        }
        if existing != nil {
          Section("Completion") {
            Toggle("Completed", isOn: $completed)
            if completed {
              TextField("Exit value", text: $exitValue)
                .keyboardType(.decimalPad)
              DatePicker("Completed on", selection: $completedAt,
                         displayedComponents: .date)
            }
          }
        }
        if let error {
          Section { Text(error).foregroundStyle(.red) }
        }
      }
      .navigationTitle(existing == nil ? "New investment" : "Edit investment")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Save") { save() }.disabled(!isValid)
        }
      }
      .onAppear { populate() }
    }
  }

  private var isValid: Bool {
    Validate.name(name) != nil
      && Validate.positiveMoney(investedAmount) != nil
      && Validate.positiveMoney(currentValue) != nil
      && Validate.notes(notes) != nil
      && (!completed || Validate.positiveMoney(exitValue) != nil)
  }

  private func populate() {
    guard let inv = existing else { return }
    name = inv.name
    type = inv.type
    investedAmount = Money.string(inv.investedAmount)
    currentValue = Money.string(inv.currentValue)
    dateOfInvestment = inv.dateOfInvestment ?? Date()
    hasClosureDate = inv.estimatedClosureDate != nil
    estimatedClosureDate = inv.estimatedClosureDate ?? Date()
    notes = inv.notes ?? ""
    completed = inv.status == "completed"
    exitValue = inv.exitValue.map(Money.string) ?? ""
    completedAt = inv.completedAt ?? Date()
  }

  private func save() {
    do {
      let store = Store(context: context)
      let cleanName = Validate.name(name)!
      let cleanNotes = Validate.notes(notes)!
      let closure = hasClosureDate ? estimatedClosureDate : nil
      if let inv = existing {
        try store.updateLumpSumInvestment(inv,
          name: cleanName, type: type,
          investedAmount: Validate.positiveMoney(investedAmount)!,
          currentValue: Validate.positiveMoney(currentValue)!,
          dateOfInvestment: dateOfInvestment, estimatedClosureDate: closure,
          notes: cleanNotes, completed: completed,
          exitValue: completed ? Validate.positiveMoney(exitValue) : nil,
          completedAt: completed ? completedAt : nil)
      } else {
        try store.createLumpSumInvestment(
          name: cleanName, type: type,
          investedAmount: Validate.positiveMoney(investedAmount)!,
          currentValue: Validate.positiveMoney(currentValue)!,
          dateOfInvestment: dateOfInvestment, estimatedClosureDate: closure,
          notes: cleanNotes)
      }
      Task { await sync.syncNow() }
      dismiss()
    } catch {
      self.error = error.localizedDescription
    }
  }
}
```

- [x] **Step 3: Implement the detail + withdraw sheet**

```swift
// apps/ios/Phinio/Phinio/UI/Investments/LumpSumDetailView.swift
import SwiftData
import SwiftUI

struct LumpSumDetailView: View {
  let investment: Investment
  @Environment(\.modelContext) private var context
  @Environment(\.dismiss) private var dismiss
  @EnvironmentObject private var sync: SyncEngine
  @Query private var withdrawals: [InvestmentWithdrawal]
  @State private var editing = false
  @State private var withdrawing = false
  @State private var confirmDelete = false

  init(investment: Investment) {
    self.investment = investment
    let invId = investment.id
    _withdrawals = Query(
      filter: #Predicate<InvestmentWithdrawal> { $0.investmentId == invId },
      sort: [SortDescriptor(\.withdrawalDate, order: .reverse)])
  }

  var body: some View {
    List {
      Section {
        LabeledContent("Type") { Text(investmentTypeLabel(investment.type)) }
        LabeledContent("Status") { Text(investment.status.capitalized) }
        LabeledContent("Invested") { MoneyText(amount: investment.investedAmount) }
        LabeledContent("Current value") { MoneyText(amount: investment.currentValue) }
        if let exit = investment.exitValue {
          LabeledContent("Exit value") { MoneyText(amount: exit) }
        }
        if let date = investment.dateOfInvestment {
          LabeledContent("Invested on") { Text(date, style: .date) }
        }
        if let notes = investment.notes {
          Text(notes).font(.callout).foregroundStyle(.secondary)
        }
      }
      if !withdrawals.isEmpty {
        Section("Withdrawals") {
          ForEach(withdrawals) { w in
            HStack {
              VStack(alignment: .leading) {
                Text(w.withdrawalDate, style: .date)
                if let n = w.notes {
                  Text(n).font(.caption).foregroundStyle(.secondary)
                }
              }
              Spacer()
              MoneyText(amount: w.amount).font(.body.monospacedDigit())
            }
          }
        }
      }
      if investment.status == "active" {
        Section {
          Button("Withdraw") { withdrawing = true }
        }
      }
      Section {
        Button("Delete investment", role: .destructive) { confirmDelete = true }
      }
    }
    .navigationTitle(investment.name)
    .toolbar {
      Button("Edit") { editing = true }
    }
    .sheet(isPresented: $editing) { LumpSumFormView(existing: investment) }
    .sheet(isPresented: $withdrawing) { WithdrawSheet(investment: investment) }
    .confirmationDialog("Delete this investment?", isPresented: $confirmDelete,
                        titleVisibility: .visible) {
      Button("Delete", role: .destructive) {
        try? Store(context: context).deleteInvestment(investment)
        Task { await sync.syncNow() }
        dismiss()
      }
    }
  }
}
```

```swift
// apps/ios/Phinio/Phinio/UI/Investments/WithdrawSheet.swift
import SwiftData
import SwiftUI

/// Withdraw from a lump-sum or savings investment. StoreError.validation
/// surfaces the server-identical guard messages inline.
struct WithdrawSheet: View {
  let investment: Investment
  @Environment(\.dismiss) private var dismiss
  @Environment(\.modelContext) private var context
  @EnvironmentObject private var sync: SyncEngine

  @State private var amount = ""
  @State private var withdrawalDate = Date()
  @State private var notes = ""
  @State private var closeInvestment = false
  @State private var error: String?

  var body: some View {
    NavigationStack {
      Form {
        Section {
          LabeledContent("Available") {
            MoneyText(amount: investment.currentValue)
          }
          TextField("Amount", text: $amount).keyboardType(.decimalPad)
          DatePicker("Date", selection: $withdrawalDate,
                     displayedComponents: .date)
          TextField("Notes", text: $notes, axis: .vertical)
          Toggle("Close investment", isOn: $closeInvestment)
        } footer: {
          Text("Closing requires withdrawing the full current value.")
        }
        if let error {
          Section { Text(error).foregroundStyle(.red) }
        }
      }
      .navigationTitle("Withdraw")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Withdraw") { submit() }
            .disabled(Validate.positiveMoney(amount) == nil
                      || Validate.notes(notes, max: 500) == nil)
        }
      }
    }
  }

  private func submit() {
    do {
      try Store(context: context).withdraw(
        from: investment, amount: Validate.positiveMoney(amount)!,
        withdrawalDate: withdrawalDate,
        notes: Validate.notes(notes, max: 500)!,
        closeInvestment: closeInvestment)
      Task { await sync.syncNow() }
      dismiss()
    } catch {
      self.error = error.localizedDescription
    }
  }
}
```

Delete the `InvestmentsListView` and `InvestmentDetailRouter` stubs from `MainTabView.swift`.

- [x] **Step 4: Build + run tests — expect SUCCESS / all green.**

- [x] **Step 5: Manual check** — create a lump-sum investment offline (airplane mode in the sim: Settings app, or just stop `npm run dev`), verify it appears instantly and the outbox drains once the server is reachable. Try withdrawing more than the current value — the inline error must read "Withdrawal amount exceeds current value" without touching the network.

- [x] **Step 6: Commit**

```bash
git add -A apps/ios/Phinio
git commit -m "✨ feat(ios): investments list, lump-sum form/detail + withdraw"
```

---

### Task 8: Savings detail + form

**Files:**
- Create: `apps/ios/Phinio/Phinio/UI/Investments/SavingsDetailView.swift`
- Create: `apps/ios/Phinio/Phinio/UI/Investments/SavingsFormView.swift`
- Modify: `apps/ios/Phinio/Phinio/UI/Investments/InvestmentsListView.swift` (delete the `SavingsDetailView`/`SavingsFormView` stubs)

**Interfaces:**
- Consumes: `Store.createSavings/updateSavings/addDeposit/removeDeposit`, `WithdrawSheet` (Task 7), `Validate`, `MoneyText`.
- Produces: `SavingsDetailView(investment:)`, `SavingsFormView(existing:)` — names must match the stubs being deleted.

- [x] **Step 1: Implement**

```swift
// apps/ios/Phinio/Phinio/UI/Investments/SavingsFormView.swift
import SwiftData
import SwiftUI

/// Create + edit for flexible savings (savingsCreateSchema/savingsUpdateSchema).
struct SavingsFormView: View {
  let existing: Investment?
  @Environment(\.dismiss) private var dismiss
  @Environment(\.modelContext) private var context
  @EnvironmentObject private var sync: SyncEngine

  @State private var name = ""
  @State private var startDate = Date()
  @State private var currentValue = ""
  @State private var notes = ""
  @State private var error: String?

  var body: some View {
    NavigationStack {
      Form {
        Section {
          TextField("Name", text: $name)
          if existing == nil {
            DatePicker("Start date", selection: $startDate,
                       displayedComponents: .date)
          }
          TextField(existing == nil ? "Initial balance" : "Current value",
                    text: $currentValue)
            .keyboardType(.decimalPad)
          TextField("Notes", text: $notes, axis: .vertical)
        } footer: {
          if existing == nil {
            Text("An initial balance is recorded as your first deposit.")
          }
        }
        if let error {
          Section { Text(error).foregroundStyle(.red) }
        }
      }
      .navigationTitle(existing == nil ? "New savings" : "Edit savings")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Save") { save() }
            .disabled(Validate.name(name) == nil
                      || Validate.nonNegativeMoney(currentValue) == nil
                      || Validate.notes(notes) == nil)
        }
      }
      .onAppear {
        guard let inv = existing else { return }
        name = inv.name
        currentValue = Money.string(inv.currentValue)
        notes = inv.notes ?? ""
      }
    }
  }

  private func save() {
    do {
      let store = Store(context: context)
      if let inv = existing {
        try store.updateSavings(inv, name: Validate.name(name)!,
          currentValue: Validate.nonNegativeMoney(currentValue)!,
          notes: Validate.notes(notes)!)
      } else {
        try store.createSavings(name: Validate.name(name)!,
          startDate: startDate,
          currentValue: Validate.nonNegativeMoney(currentValue)!,
          notes: Validate.notes(notes)!)
      }
      Task { await sync.syncNow() }
      dismiss()
    } catch {
      self.error = error.localizedDescription
    }
  }
}
```

```swift
// apps/ios/Phinio/Phinio/UI/Investments/SavingsDetailView.swift
import SwiftData
import SwiftUI

struct SavingsDetailView: View {
  let investment: Investment
  @Environment(\.modelContext) private var context
  @Environment(\.dismiss) private var dismiss
  @EnvironmentObject private var sync: SyncEngine
  @Query private var deposits: [InvestmentDeposit]
  @Query private var withdrawals: [InvestmentWithdrawal]
  @State private var editing = false
  @State private var addingDeposit = false
  @State private var withdrawing = false
  @State private var confirmDelete = false

  init(investment: Investment) {
    self.investment = investment
    let invId = investment.id
    _deposits = Query(
      filter: #Predicate<InvestmentDeposit> { $0.investmentId == invId },
      sort: [SortDescriptor(\.depositDate, order: .reverse)])
    _withdrawals = Query(
      filter: #Predicate<InvestmentWithdrawal> { $0.investmentId == invId },
      sort: [SortDescriptor(\.withdrawalDate, order: .reverse)])
  }

  var body: some View {
    List {
      Section {
        LabeledContent("Status") { Text(investment.status.capitalized) }
        LabeledContent("Balance") { MoneyText(amount: investment.currentValue) }
        LabeledContent("Total deposited") {
          MoneyText(amount: investment.investedAmount)
        }
        if let notes = investment.notes {
          Text(notes).font(.callout).foregroundStyle(.secondary)
        }
      }
      Section("Deposits") {
        if deposits.isEmpty {
          Text("No deposits yet").foregroundStyle(.secondary)
        }
        ForEach(deposits) { dep in
          HStack {
            VStack(alignment: .leading) {
              if let d = dep.depositDate { Text(d, style: .date) }
              if let n = dep.notes {
                Text(n).font(.caption).foregroundStyle(.secondary)
              }
            }
            Spacer()
            MoneyText(amount: dep.amount).font(.body.monospacedDigit())
          }
          .swipeActions {
            if investment.status == "active" {
              Button("Remove", role: .destructive) {
                try? Store(context: context)
                  .removeDeposit(dep, from: investment)
                Task { await sync.syncNow() }
              }
            }
          }
        }
      }
      if !withdrawals.isEmpty {
        Section("Withdrawals") {
          ForEach(withdrawals) { w in
            HStack {
              Text(w.withdrawalDate, style: .date)
              Spacer()
              MoneyText(amount: w.amount).font(.body.monospacedDigit())
            }
          }
        }
      }
      if investment.status == "active" {
        Section {
          Button("Add deposit") { addingDeposit = true }
          Button("Withdraw") { withdrawing = true }
        }
      }
      Section {
        Button("Delete savings", role: .destructive) { confirmDelete = true }
      }
    }
    .navigationTitle(investment.name)
    .toolbar { Button("Edit") { editing = true } }
    .sheet(isPresented: $editing) { SavingsFormView(existing: investment) }
    .sheet(isPresented: $addingDeposit) { AddDepositSheet(investment: investment) }
    .sheet(isPresented: $withdrawing) { WithdrawSheet(investment: investment) }
    .confirmationDialog("Delete this savings?", isPresented: $confirmDelete,
                        titleVisibility: .visible) {
      Button("Delete", role: .destructive) {
        try? Store(context: context).deleteInvestment(investment)
        Task { await sync.syncNow() }
        dismiss()
      }
    }
  }
}

struct AddDepositSheet: View {
  let investment: Investment
  @Environment(\.dismiss) private var dismiss
  @Environment(\.modelContext) private var context
  @EnvironmentObject private var sync: SyncEngine
  @State private var amount = ""
  @State private var depositDate = Date()
  @State private var notes = ""
  @State private var error: String?

  var body: some View {
    NavigationStack {
      Form {
        TextField("Amount", text: $amount).keyboardType(.decimalPad)
        DatePicker("Date", selection: $depositDate, displayedComponents: .date)
        TextField("Notes", text: $notes, axis: .vertical)
        if let error { Text(error).foregroundStyle(.red) }
      }
      .navigationTitle("Add deposit")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Add") { submit() }
            .disabled(Validate.positiveMoney(amount) == nil
                      || Validate.notes(notes, max: 500) == nil)
        }
      }
    }
  }

  private func submit() {
    do {
      try Store(context: context).addDeposit(
        to: investment, amount: Validate.positiveMoney(amount)!,
        depositDate: depositDate, notes: Validate.notes(notes, max: 500)!)
      Task { await sync.syncNow() }
      dismiss()
    } catch {
      self.error = error.localizedDescription
    }
  }
}
```

Delete the `SavingsDetailView` and `SavingsFormView` stubs from `InvestmentsListView.swift`.

- [x] **Step 2: Build + full test suite — expect green.**

- [x] **Step 3: Manual check** — create a savings with an initial balance (initial deposit appears), add and swipe-remove a deposit (totals update instantly), withdraw fully with "Close investment" (status flips to Completed and it moves to the Completed filter).

- [x] **Step 4: Commit**

```bash
git add -A apps/ios/Phinio
git commit -m "✨ feat(ios): savings detail + form with deposits"
```

---

### Task 9: DPS detail + form

**Files:**
- Create: `apps/ios/Phinio/Phinio/UI/Investments/DpsDetailView.swift`
- Create: `apps/ios/Phinio/Phinio/UI/Investments/DpsFormView.swift`
- Modify: `apps/ios/Phinio/Phinio/UI/Investments/InvestmentsListView.swift` (delete the `DpsDetailView`/`DpsFormView` stubs)

**Interfaces:**
- Consumes: `Store.createDps/updateDps/markDepositPaid/closeDps`, `Validate`, `MoneyText`, `dueLabel`/`utcDaysUntil`.
- Produces: `DpsDetailView(investment:)`, `DpsFormView()` (create-only; editing name/notes happens via an edit sheet inside the detail view using `updateDps`).

- [x] **Step 1: Implement**

```swift
// apps/ios/Phinio/Phinio/UI/Investments/DpsFormView.swift
import SwiftData
import SwiftUI

/// DPS create (dpsCreateSchema). The installment schedule is generated
/// server-side and arrives with the first snapshot after sync.
struct DpsFormView: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(\.modelContext) private var context
  @EnvironmentObject private var sync: SyncEngine

  @State private var name = ""
  @State private var monthlyDeposit = ""
  @State private var tenureMonths = 12
  @State private var interestRate = ""
  @State private var interestType = "compound"
  @State private var startDate = Date()
  @State private var notes = ""
  @State private var error: String?

  var body: some View {
    NavigationStack {
      Form {
        Section {
          TextField("Name", text: $name)
          TextField("Monthly deposit", text: $monthlyDeposit)
            .keyboardType(.decimalPad)
          Stepper("Tenure: \(tenureMonths) months", value: $tenureMonths,
                  in: 1...600)
          TextField("Interest rate (%)", text: $interestRate)
            .keyboardType(.decimalPad)
          Picker("Interest type", selection: $interestType) {
            Text("Compound").tag("compound")
            Text("Simple").tag("simple")
          }
          DatePicker("Start date", selection: $startDate,
                     displayedComponents: .date)
          TextField("Notes", text: $notes, axis: .vertical)
        } footer: {
          Text("The installment schedule appears after the first sync.")
        }
        if let error { Section { Text(error).foregroundStyle(.red) } }
      }
      .navigationTitle("New DPS")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Save") { save() }
            .disabled(Validate.name(name) == nil
                      || Validate.positiveMoney(monthlyDeposit) == nil
                      || Validate.rate(interestRate) == nil
                      || Validate.notes(notes) == nil)
        }
      }
    }
  }

  private func save() {
    do {
      try Store(context: context).createDps(
        name: Validate.name(name)!,
        monthlyDeposit: Validate.positiveMoney(monthlyDeposit)!,
        tenureMonths: tenureMonths,
        interestRate: Validate.rate(interestRate)!,
        interestType: interestType, startDate: startDate,
        notes: Validate.notes(notes)!)
      Task { await sync.syncNow() }
      dismiss()
    } catch {
      self.error = error.localizedDescription
    }
  }
}
```

```swift
// apps/ios/Phinio/Phinio/UI/Investments/DpsDetailView.swift
import SwiftData
import SwiftUI

struct DpsDetailView: View {
  let investment: Investment
  @Environment(\.modelContext) private var context
  @EnvironmentObject private var sync: SyncEngine
  @Query private var deposits: [InvestmentDeposit]
  @State private var editing = false
  @State private var closing = false

  init(investment: Investment) {
    self.investment = investment
    let invId = investment.id
    _deposits = Query(
      filter: #Predicate<InvestmentDeposit> { $0.investmentId == invId },
      sort: [SortDescriptor(\.installmentNumber)])
  }

  private var paidCount: Int { deposits.filter { $0.status == "paid" }.count }

  var body: some View {
    List {
      Section {
        LabeledContent("Status") { Text(investment.status.capitalized) }
        LabeledContent("Monthly deposit") {
          MoneyText(amount: investment.monthlyDeposit ?? 0)
        }
        LabeledContent("Deposited so far") {
          MoneyText(amount: investment.currentValue)
        }
        if let rate = investment.interestRate {
          LabeledContent("Interest") {
            Text("\(Money.string(rate))% \(investment.interestType ?? "")")
          }
        }
        if let exit = investment.exitValue {
          LabeledContent("Exit value") { MoneyText(amount: exit) }
        }
        if !deposits.isEmpty {
          ProgressView(value: Double(paidCount), total: Double(deposits.count)) {
            Text("\(paidCount) of \(deposits.count) installments paid")
              .font(.caption)
          }
        }
        if let notes = investment.notes {
          Text(notes).font(.callout).foregroundStyle(.secondary)
        }
      }
      Section("Installments") {
        if deposits.isEmpty {
          Text("Schedule appears after first sync")
            .foregroundStyle(.secondary)
        }
        ForEach(deposits) { dep in
          HStack {
            VStack(alignment: .leading) {
              Text("#\(dep.installmentNumber ?? 0)")
              if let due = dep.dueDate {
                Text(dep.status == "paid" ? due.formatted(date: .abbreviated,
                                                          time: .omitted)
                     : dueLabel(daysUntil: utcDaysUntil(due, from: Date())))
                  .font(.caption)
                  .foregroundStyle(
                    dep.status != "paid" && utcDaysUntil(due, from: Date()) < 0
                      ? AnyShapeStyle(.red) : AnyShapeStyle(.secondary))
              }
            }
            Spacer()
            MoneyText(amount: dep.amount).font(.body.monospacedDigit())
            Image(systemName: dep.status == "paid"
                  ? "checkmark.circle.fill" : "circle")
              .foregroundStyle(dep.status == "paid" ? .green : .secondary)
          }
          .contentShape(.rect)
          .swipeActions {
            if investment.status == "active" || investment.status == "matured" {
              Button(dep.status == "paid" ? "Unpay" : "Paid") {
                try? Store(context: context).markDepositPaid(
                  dep, investment: investment, paid: dep.status != "paid")
                Task { await sync.syncNow() }
              }
              .tint(dep.status == "paid" ? .orange : .green)
            }
          }
        }
      }
      if investment.status == "active" {
        Section {
          Button("Close early", role: .destructive) { closing = true }
        }
      }
    }
    .navigationTitle(investment.name)
    .toolbar { Button("Edit") { editing = true } }
    .sheet(isPresented: $editing) { DpsEditSheet(investment: investment) }
    .sheet(isPresented: $closing) { DpsCloseSheet(investment: investment) }
  }
}

struct DpsEditSheet: View {
  let investment: Investment
  @Environment(\.dismiss) private var dismiss
  @Environment(\.modelContext) private var context
  @EnvironmentObject private var sync: SyncEngine
  @State private var name = ""
  @State private var notes = ""

  var body: some View {
    NavigationStack {
      Form {
        TextField("Name", text: $name)
        TextField("Notes", text: $notes, axis: .vertical)
      }
      .navigationTitle("Edit DPS")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Save") {
            try? Store(context: context).updateDps(
              investment, name: Validate.name(name)!,
              notes: Validate.notes(notes)!)
            Task { await sync.syncNow() }
            dismiss()
          }
          .disabled(Validate.name(name) == nil || Validate.notes(notes) == nil)
        }
      }
      .onAppear {
        name = investment.name
        notes = investment.notes ?? ""
      }
    }
  }
}

struct DpsCloseSheet: View {
  let investment: Investment
  @Environment(\.dismiss) private var dismiss
  @Environment(\.modelContext) private var context
  @EnvironmentObject private var sync: SyncEngine
  @State private var receivedAmount = ""
  @State private var closureDate = Date()
  @State private var notes = ""
  @State private var error: String?

  var body: some View {
    NavigationStack {
      Form {
        Section {
          TextField("Amount received", text: $receivedAmount)
            .keyboardType(.decimalPad)
          DatePicker("Closure date", selection: $closureDate,
                     displayedComponents: .date)
          TextField("Notes", text: $notes, axis: .vertical)
        } footer: {
          Text("Premature closure removes remaining installments. This can't be undone locally.")
        }
        if let error { Section { Text(error).foregroundStyle(.red) } }
      }
      .navigationTitle("Close DPS")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Close DPS", role: .destructive) { submit() }
            .disabled(Validate.positiveMoney(receivedAmount) == nil
                      || Validate.notes(notes, max: 500) == nil)
        }
      }
    }
  }

  private func submit() {
    do {
      try Store(context: context).closeDps(
        investment, receivedAmount: Validate.positiveMoney(receivedAmount)!,
        closureDate: closureDate, notes: Validate.notes(notes, max: 500)!)
      Task { await sync.syncNow() }
      dismiss()
    } catch {
      self.error = error.localizedDescription
    }
  }
}
```

Delete the `DpsDetailView` and `DpsFormView` stubs from `InvestmentsListView.swift`.

- [x] **Step 2: Build + full test suite — expect green.**

- [x] **Step 3: Manual check** — create a DPS, sync, confirm installments appear; swipe an installment paid (totals resync); close early and confirm upcoming installments vanish and status shows Closed.

- [x] **Step 4: Commit**

```bash
git add -A apps/ios/Phinio
git commit -m "✨ feat(ios): DPS form, installment schedule + premature close"
```

---

### Task 10: EMI list, create form with live schedule preview, detail

**Files:**
- Create: `apps/ios/Phinio/Phinio/UI/Emis/EmiListView.swift`
- Create: `apps/ios/Phinio/Phinio/UI/Emis/EmiFormView.swift`
- Create: `apps/ios/Phinio/Phinio/UI/Emis/EmiDetailView.swift`
- Modify: `apps/ios/Phinio/Phinio/UI/MainTabView.swift` (delete the `EmiListView`/`EmiDetailView` stubs)

**Interfaces:**
- Consumes: `Store.createEmi(...processingFee:)`, `markPaymentPaid`, `updateEmi`, `deleteEmi`, `completeEmi` (Task 3); `EmiCalculator.amortization` for the live preview; `Validate`, `MoneyText`, `dueLabel`.
- Produces: `EmiListView`, `EmiDetailView(emiId: String)` (id-based — deep-link target), `EmiFormView`.

- [x] **Step 1: Implement the list**

```swift
// apps/ios/Phinio/Phinio/UI/Emis/EmiListView.swift
import SwiftData
import SwiftUI

struct EmiListView: View {
  @Query(sort: \Emi.updatedAt, order: .reverse) private var emis: [Emi]
  @Query private var payments: [EmiPayment]
  @State private var showCompleted = false
  @State private var creating = false

  private var filtered: [Emi] {
    emis.filter { showCompleted ? $0.status == "completed"
                                : $0.status == "active" }
  }

  private func progress(_ emi: Emi) -> (paid: Int, total: Int) {
    let rows = payments.filter { $0.emiId == emi.id && $0.paymentNumber > 0 }
    return (rows.filter { $0.status == "paid" }.count, rows.count)
  }

  var body: some View {
    List {
      Picker("Filter", selection: $showCompleted) {
        Text("Active").tag(false)
        Text("Completed").tag(true)
      }
      .pickerStyle(.segmented)
      .listRowBackground(Color.clear)

      ForEach(filtered) { emi in
        NavigationLink(value: EmiRoute(id: emi.id)) {
          VStack(alignment: .leading, spacing: 6) {
            HStack {
              Text(emi.label)
              Spacer()
              MoneyText(amount: emi.emiAmount).font(.body.monospacedDigit())
            }
            let p = progress(emi)
            ProgressView(value: Double(p.paid), total: Double(max(p.total, 1)))
            Text("\(p.paid)/\(p.total) paid · \(emi.type == "bank_loan" ? "Bank loan" : "Credit card")")
              .font(.caption).foregroundStyle(.secondary)
          }
        }
      }
    }
    .overlay {
      if filtered.isEmpty {
        EmptyStateView(symbol: "creditcard", title: "No EMIs",
          message: showCompleted ? "Nothing completed yet."
                                 : "Add your first EMI.")
      }
    }
    .navigationTitle("EMIs")
    .toolbar {
      Button { creating = true } label: { Image(systemName: "plus") }
    }
    .sheet(isPresented: $creating) { EmiFormView() }
  }
}
```

- [x] **Step 2: Implement the create form with live preview**

```swift
// apps/ios/Phinio/Phinio/UI/Emis/EmiFormView.swift
import SwiftData
import SwiftUI

/// EMI create (emiCreateSchema) with a live schedule preview computed by the
/// local calculator — identical math to the server, so the preview equals
/// the persisted schedule.
struct EmiFormView: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(\.modelContext) private var context
  @EnvironmentObject private var sync: SyncEngine

  @State private var label = ""
  @State private var type: EmiMethod = .bankLoan
  @State private var principal = ""
  @State private var interestRate = ""
  @State private var tenureMonths = 12
  @State private var startDate = Date()
  @State private var processingFee = ""
  @State private var notes = ""
  @State private var error: String?

  private var preview: [AmortizationRow]? {
    guard let p = Validate.positiveMoney(principal),
          let r = Validate.rate(interestRate) else { return nil }
    return try? EmiCalculator.amortization(
      principal: NSDecimalNumber(decimal: p).doubleValue,
      annualRate: NSDecimalNumber(decimal: r).doubleValue,
      tenureMonths: tenureMonths, startDate: startDate, type: type)
  }

  var body: some View {
    NavigationStack {
      Form {
        Section {
          TextField("Label", text: $label)
          Picker("Type", selection: $type) {
            Text("Bank loan").tag(EmiMethod.bankLoan)
            Text("Credit card").tag(EmiMethod.creditCard)
          }
          TextField("Principal", text: $principal).keyboardType(.decimalPad)
          TextField("Interest rate (%)", text: $interestRate)
            .keyboardType(.decimalPad)
          Stepper("Tenure: \(tenureMonths) months", value: $tenureMonths,
                  in: 1...600)
          DatePicker("First payment", selection: $startDate,
                     displayedComponents: .date)
          TextField("Processing fee (optional)", text: $processingFee)
            .keyboardType(.decimalPad)
          TextField("Notes", text: $notes, axis: .vertical)
        }
        if let rows = preview, let first = rows.first {
          Section("Schedule preview") {
            LabeledContent("Monthly EMI") {
              MoneyText(amount: Money.decimal(first.emiAmount) ?? 0)
                .fontWeight(.semibold)
            }
            ForEach(rows.prefix(3), id: \.paymentNumber) { row in
              HStack {
                Text("#\(row.paymentNumber)")
                Text(row.dueDate, style: .date)
                  .font(.caption).foregroundStyle(.secondary)
                Spacer()
                MoneyText(amount: Money.decimal(row.emiAmount) ?? 0)
                  .font(.callout.monospacedDigit())
              }
            }
            if rows.count > 3 {
              Text("… and \(rows.count - 3) more")
                .font(.caption).foregroundStyle(.secondary)
            }
          }
          .listRowBackground(Color.clear.glassEffect(in: .rect(cornerRadius: 12)))
        }
        if let error { Section { Text(error).foregroundStyle(.red) } }
      }
      .navigationTitle("New EMI")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Save") { save() }.disabled(!isValid)
        }
      }
    }
  }

  private var isValid: Bool {
    Validate.name(label) != nil
      && Validate.positiveMoney(principal) != nil
      && Validate.rate(interestRate) != nil
      && Validate.notes(notes) != nil
      && (processingFee.trimmingCharacters(in: .whitespaces).isEmpty
          || Validate.nonNegativeMoney(processingFee) != nil)
  }

  private func save() {
    do {
      let feeText = processingFee.trimmingCharacters(in: .whitespaces)
      let fee = feeText.isEmpty ? nil : Validate.nonNegativeMoney(feeText)
      try Store(context: context).createEmi(
        label: Validate.name(label)!, type: type,
        principal: Validate.positiveMoney(principal)!,
        interestRate: Validate.rate(interestRate)!,
        tenureMonths: tenureMonths, startDate: startDate,
        notes: Validate.notes(notes)!,
        processingFee: (fee ?? 0) > 0 ? fee : nil)
      Task { await sync.syncNow() }
      dismiss()
    } catch {
      self.error = error.localizedDescription
    }
  }
}
```

Note: `EmiMethod` must be `Hashable` for the `Picker` tags — it is a plain two-case enum in `EmiCalculator.swift`; add `Hashable` conformance there if the compiler asks.

- [x] **Step 3: Implement the detail**

```swift
// apps/ios/Phinio/Phinio/UI/Emis/EmiDetailView.swift
import SwiftData
import SwiftUI

struct EmiDetailView: View {
  let emiId: String
  @Environment(\.modelContext) private var context
  @Environment(\.dismiss) private var dismiss
  @EnvironmentObject private var sync: SyncEngine
  @Query private var matches: [Emi]
  @Query private var payments: [EmiPayment]
  @State private var editing = false
  @State private var confirmComplete = false
  @State private var confirmDelete = false
  @State private var error: String?

  init(emiId: String) {
    self.emiId = emiId
    _matches = Query(filter: #Predicate<Emi> { $0.id == emiId })
    _payments = Query(
      filter: #Predicate<EmiPayment> { $0.emiId == emiId },
      sort: [SortDescriptor(\.paymentNumber)])
  }

  private var emi: Emi? { matches.first }
  private var fee: EmiPayment? { payments.first { $0.paymentNumber == 0 } }
  private var schedule: [EmiPayment] { payments.filter { $0.paymentNumber > 0 } }
  private var paidCount: Int { schedule.filter { $0.status == "paid" }.count }

  var body: some View {
    if let emi {
      List {
        Section {
          LabeledContent("Status") { Text(emi.status.capitalized) }
          LabeledContent("Monthly EMI") { MoneyText(amount: emi.emiAmount) }
          LabeledContent("Principal") { MoneyText(amount: emi.principal) }
          LabeledContent("Interest") { Text("\(Money.string(emi.interestRate))%") }
          if let fee {
            LabeledContent("Processing fee") { MoneyText(amount: fee.emiAmount) }
          }
          ProgressView(value: Double(paidCount),
                       total: Double(max(schedule.count, 1))) {
            Text("\(paidCount) of \(schedule.count) payments made").font(.caption)
          }
          if let notes = emi.notes {
            Text(notes).font(.callout).foregroundStyle(.secondary)
          }
        }
        Section("Amortization") {
          ForEach(schedule) { p in
            VStack(alignment: .leading, spacing: 4) {
              HStack {
                Text("#\(p.paymentNumber)")
                Text(p.status == "paid"
                     ? p.dueDate.formatted(date: .abbreviated, time: .omitted)
                     : dueLabel(daysUntil: utcDaysUntil(p.dueDate, from: Date())))
                  .font(.caption)
                  .foregroundStyle(
                    p.status != "paid" && utcDaysUntil(p.dueDate, from: Date()) < 0
                      ? AnyShapeStyle(.red) : AnyShapeStyle(.secondary))
                Spacer()
                MoneyText(amount: p.emiAmount).font(.body.monospacedDigit())
                Image(systemName: p.status == "paid"
                      ? "checkmark.circle.fill" : "circle")
                  .foregroundStyle(p.status == "paid" ? .green : .secondary)
              }
              Text("Principal ")
                .font(.caption2).foregroundStyle(.tertiary)
              + Text(Money.string(p.principalComponent))
                .font(.caption2.monospacedDigit()).foregroundStyle(.tertiary)
              + Text(" · Interest ")
                .font(.caption2).foregroundStyle(.tertiary)
              + Text(Money.string(p.interestComponent))
                .font(.caption2.monospacedDigit()).foregroundStyle(.tertiary)
              + Text(" · Balance ")
                .font(.caption2).foregroundStyle(.tertiary)
              + Text(Money.string(p.remainingBalance))
                .font(.caption2.monospacedDigit()).foregroundStyle(.tertiary)
            }
            .swipeActions {
              Button(p.status == "paid" ? "Unpay" : "Paid") {
                do {
                  try Store(context: context)
                    .markPaymentPaid(p, paid: p.status != "paid")
                  Task { await sync.syncNow() }
                } catch { self.error = error.localizedDescription }
              }
              .tint(p.status == "paid" ? .orange : .green)
            }
          }
        }
        if emi.status == "active" {
          Section {
            Button("Complete early") { confirmComplete = true }
          }
        }
        Section {
          Button("Delete EMI", role: .destructive) { confirmDelete = true }
        }
        if let error {
          Section { Text(error).foregroundStyle(.red) }
        }
      }
      .navigationTitle(emi.label)
      .toolbar { Button("Edit") { editing = true } }
      .sheet(isPresented: $editing) { EmiEditSheet(emi: emi) }
      .confirmationDialog("Mark all remaining payments as paid?",
                          isPresented: $confirmComplete,
                          titleVisibility: .visible) {
        Button("Complete EMI") {
          try? Store(context: context).completeEmi(emi)
          Task { await sync.syncNow() }
        }
      }
      .confirmationDialog("Delete this EMI and its schedule?",
                          isPresented: $confirmDelete,
                          titleVisibility: .visible) {
        Button("Delete", role: .destructive) {
          try? Store(context: context).deleteEmi(emi)
          Task { await sync.syncNow() }
          dismiss()
        }
      }
    } else {
      EmptyStateView(symbol: "questionmark.circle", title: "Not found",
        message: "This EMI is no longer on this device.")
    }
  }
}

struct EmiEditSheet: View {
  let emi: Emi
  @Environment(\.dismiss) private var dismiss
  @Environment(\.modelContext) private var context
  @EnvironmentObject private var sync: SyncEngine
  @State private var label = ""
  @State private var notes = ""

  var body: some View {
    NavigationStack {
      Form {
        TextField("Label", text: $label)
        TextField("Notes", text: $notes, axis: .vertical)
      }
      .navigationTitle("Edit EMI")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Save") {
            try? Store(context: context).updateEmi(
              emi, label: Validate.name(label)!, notes: Validate.notes(notes)!)
            Task { await sync.syncNow() }
            dismiss()
          }
          .disabled(Validate.name(label) == nil || Validate.notes(notes) == nil)
        }
      }
      .onAppear {
        label = emi.label
        notes = emi.notes ?? ""
      }
    }
  }
}
```

Delete the `EmiListView` and `EmiDetailView` stubs from `MainTabView.swift`.

- [x] **Step 4: Build + full test suite — expect green.**

- [x] **Step 5: Manual check** — the form preview's monthly EMI must equal the created EMI's `emiAmount` exactly (same calculator); mark the last unpaid payment paid and confirm the EMI auto-flips to Completed; swipe-unpay it and confirm it reopens.

- [x] **Step 6: Commit**

```bash
git add -A apps/ios/Phinio
git commit -m "✨ feat(ios): EMI list, create with live preview + amortization detail"
```

---

### Task 11: Activity tab + notifications screen

**Files:**
- Modify: `apps/ios/Phinio/Phinio/Networking/DTOs.swift` (append activity DTOs)
- Modify: `apps/ios/Phinio/Phinio/Networking/APIClient.swift` (add `fetchActivity`)
- Create: `apps/ios/Phinio/Phinio/UI/Activity/ActivityView.swift`
- Create: `apps/ios/Phinio/Phinio/UI/Activity/NotificationsView.swift`
- Modify: `apps/ios/Phinio/Phinio/UI/MainTabView.swift` (delete the `ActivityView` stub)
- Test: `apps/ios/Phinio/PhinioTests/ActivityDTOTests.swift`

**Interfaces:**
- Consumes: `APIClient.run`/`request` (private — add `fetchActivity` inside `APIClient`), `Store` notification ops (Task 3), `DeepLink.parse`.
- Produces:
  ```swift
  struct ActivityChangeDTO: Decodable { let field: String; let from: String?; let to: String?; let currency: String? }
  struct ActivityItemDTO: Decodable, Identifiable {
    let id: String; let action: String; let entityType: String
    let entityId: String?; let entityLabel: String; let summary: String
    let changes: [ActivityChangeDTO]?; let createdAt: String
  }
  struct ActivityPageDTO: Decodable { let items: [ActivityItemDTO]; let nextCursor: String? }
  // APIClient:
  func fetchActivity(cursor: String?) async throws -> ActivityPageDTO
  ```

- [x] **Step 1: Write the failing DTO test**

```swift
// apps/ios/Phinio/PhinioTests/ActivityDTOTests.swift
import Foundation
import Testing
@testable import Phinio

struct ActivityDTOTests {
  @Test func decodesActivityPage() throws {
    let json = #"""
    {
      "items": [{
        "id": "a1", "action": "update", "entityType": "emi_payment",
        "entityId": "p1", "entityLabel": "Car loan",
        "summary": "Marked payment #3 as paid",
        "changes": [{"field": "status", "from": "upcoming", "to": "paid"}],
        "createdAt": "2026-07-17T10:00:00.000Z"
      }],
      "nextCursor": null
    }
    """#
    let page = try JSONDecoder().decode(ActivityPageDTO.self,
                                        from: Data(json.utf8))
    #expect(page.items.count == 1)
    #expect(page.items[0].summary == "Marked payment #3 as paid")
    #expect(page.items[0].changes?.first?.to == "paid")
    #expect(page.nextCursor == nil)
  }
}
```

- [x] **Step 2: Run to verify failure, then implement.** Append the three DTO structs above to `DTOs.swift` verbatim. Add to `APIClient` (the private `request(path:)` helper uses `baseURL.appending(path:)`, which would percent-encode a `?`, so build this URL with `URLComponents` instead):

```swift
  func fetchActivity(cursor: String?) async throws -> ActivityPageDTO {
    var comps = URLComponents(
      url: baseURL.appending(path: "/api/v1/activity"),
      resolvingAgainstBaseURL: false)!
    comps.queryItems = [URLQueryItem(name: "limit", value: "30")]
    if let cursor {
      comps.queryItems!.append(URLQueryItem(name: "cursor", value: cursor))
    }
    var req = URLRequest(url: comps.url!)
    req.httpMethod = "GET"
    if let token = tokenProvider() {
      req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }
    let data = try await run(req)
    do {
      return try JSONDecoder().decode(ActivityPageDTO.self, from: data)
    } catch {
      throw APIError.decoding
    }
  }
```

- [x] **Step 3: Implement the screens**

```swift
// apps/ios/Phinio/Phinio/UI/Activity/ActivityView.swift
import SwiftUI

/// Online-only: the activity log is server-derived and not in the snapshot.
struct ActivityView: View {
  @State private var items: [ActivityItemDTO] = []
  @State private var nextCursor: String?
  @State private var loading = false
  @State private var offline = false
  private let client = APIClient()

  var body: some View {
    List {
      ForEach(items) { item in
        VStack(alignment: .leading, spacing: 2) {
          Text(item.summary)
          HStack {
            Text(item.entityLabel).font(.caption).foregroundStyle(.secondary)
            Spacer()
            if let date = WireDate.timestamp(item.createdAt) {
              Text(date, format: .relative(presentation: .named))
                .font(.caption).foregroundStyle(.tertiary)
            }
          }
        }
        .onAppear {
          if item.id == items.last?.id, nextCursor != nil {
            Task { await loadMore() }
          }
        }
      }
      if loading { ProgressView().frame(maxWidth: .infinity) }
    }
    .overlay {
      if offline && items.isEmpty {
        EmptyStateView(symbol: "wifi.slash", title: "Offline",
          message: "Activity needs a connection.")
      } else if !loading && !offline && items.isEmpty {
        EmptyStateView(symbol: "clock.arrow.circlepath", title: "No activity",
          message: "Changes you make will show up here.")
      }
    }
    .navigationTitle("Activity")
    .toolbar {
      NavigationLink { NotificationsView() } label: { NotificationBell() }
    }
    .task { await reload() }
    .refreshable { await reload() }
  }

  private func reload() async {
    loading = true
    defer { loading = false }
    do {
      let page = try await client.fetchActivity(cursor: nil)
      items = page.items
      nextCursor = page.nextCursor
      offline = false
    } catch {
      offline = true
    }
  }

  private func loadMore() async {
    guard let cursor = nextCursor, !loading else { return }
    loading = true
    defer { loading = false }
    do {
      let page = try await client.fetchActivity(cursor: cursor)
      items += page.items
      nextCursor = page.nextCursor
    } catch {
      nextCursor = nil // stop paginating; pull-to-refresh recovers
    }
  }
}
```

```swift
// apps/ios/Phinio/Phinio/UI/Activity/NotificationsView.swift
import SwiftData
import SwiftUI

/// Bell icon with the local unread count — reused by the Activity toolbar.
struct NotificationBell: View {
  @Query(filter: #Predicate<AppNotification> { $0.readAt == nil })
  private var unread: [AppNotification]

  var body: some View {
    Image(systemName: "bell")
      .badge(unread.count) // falls back gracefully outside a List
      .overlay(alignment: .topTrailing) {
        if !unread.isEmpty {
          Circle().fill(.red).frame(width: 8, height: 8).offset(x: 2, y: -2)
        }
      }
  }
}

struct NotificationsView: View {
  @Environment(\.modelContext) private var context
  @EnvironmentObject private var sync: SyncEngine
  @EnvironmentObject private var deepLink: DeepLinkRouter
  @Query(sort: \AppNotification.createdAt, order: .reverse)
  private var notifications: [AppNotification]

  var body: some View {
    List {
      ForEach(notifications) { n in
        Button {
          if n.readAt == nil {
            try? Store(context: context).markNotificationRead(n)
            Task { await sync.syncNow() }
          }
          if let link = n.link, let parsed = DeepLink.parse(link) {
            deepLink.pending = parsed
          }
        } label: {
          HStack(alignment: .top) {
            if n.readAt == nil {
              Circle().fill(.blue).frame(width: 8, height: 8).padding(.top, 6)
            }
            VStack(alignment: .leading, spacing: 2) {
              Text(n.title).fontWeight(n.readAt == nil ? .semibold : .regular)
              Text(n.body).font(.callout).foregroundStyle(.secondary)
              Text(n.createdAt, format: .relative(presentation: .named))
                .font(.caption).foregroundStyle(.tertiary)
            }
          }
        }
        .buttonStyle(.plain)
      }
    }
    .overlay {
      if notifications.isEmpty {
        EmptyStateView(symbol: "bell", title: "No notifications",
          message: "Payment reminders will show up here.")
      }
    }
    .navigationTitle("Notifications")
    .toolbar {
      Menu {
        Button("Mark all read") {
          try? Store(context: context).markAllNotificationsRead()
          Task { await sync.syncNow() }
        }
        Button("Clear read", role: .destructive) {
          try? Store(context: context).clearReadNotifications()
          Task { await sync.syncNow() }
        }
      } label: {
        Image(systemName: "ellipsis.circle")
      }
    }
  }
}
```

Delete the `ActivityView` stub from `MainTabView.swift`.

- [x] **Step 4: Build + full test suite — expect green** (`ActivityDTOTests` passes).

- [x] **Step 5: Manual check** — Activity lists server-side log entries after making changes; scrolling paginates; airplane mode shows the offline state. Notifications: mark one read (dot disappears), tapping a reminder with a link jumps to the EMI detail.

- [x] **Step 6: Commit**

```bash
git add -A apps/ios/Phinio
git commit -m "✨ feat(ios): activity log + notifications with unread badge"
```

---

### Task 12: Settings

**Files:**
- Create: `apps/ios/Phinio/Phinio/UI/Dashboard/SettingsView.swift`
- Modify: `apps/ios/Phinio/Phinio/UI/Dashboard/DashboardView.swift` (delete the `SettingsView` stub at the bottom)

**Interfaces:**
- Consumes: `Store.updateProfile` (Task 3), `SyncIssue` model, `AuthManager.signOut(container:)`, `sync.state`, `UNUserNotificationCenter` (permission status; full APNs wiring is Task 14 — this task calls `PushManager.registerIfAuthorized()` which Task 14 provides; until then, add a placeholder `enum PushManager { static func requestAndRegister() async {} static var deviceTokenForLogout: String? { nil } }` in THIS file and Task 14 replaces it).
- Produces: `SettingsView`.

- [x] **Step 1: Implement**

```swift
// apps/ios/Phinio/Phinio/UI/Dashboard/SettingsView.swift
import SwiftData
import SwiftUI
import UserNotifications

struct SettingsView: View {
  @Environment(\.modelContext) private var context
  @EnvironmentObject private var auth: AuthManager
  @EnvironmentObject private var sync: SyncEngine
  @Query private var profiles: [Profile]
  @Query(sort: \SyncIssue.occurredAt, order: .reverse)
  private var issues: [SyncIssue]

  @State private var fullName = ""
  @State private var currency = "BDT"
  @State private var language = "en"
  @State private var notifStatus: UNAuthorizationStatus = .notDetermined
  @State private var confirmSignOut = false

  private var profile: Profile? { profiles.first }
  private var dirty: Bool {
    guard let p = profile else { return false }
    return fullName != p.fullName || currency != p.preferredCurrency
      || language != p.preferredLanguage
  }

  var body: some View {
    Form {
      Section("Profile") {
        TextField("Full name", text: $fullName)
        Picker("Currency", selection: $currency) {
          Text("BDT").tag("BDT")
          Text("USD").tag("USD")
        }
        Picker("Language", selection: $language) {
          Text("English").tag("en")
          Text("বাংলা").tag("bn")
        }
        if dirty {
          Button("Save changes") { saveProfile() }
            .disabled(Validate.name(fullName, max: 120) == nil
                      || fullName.trimmingCharacters(in: .whitespaces).count < 2)
        }
      }

      Section("Notifications") {
        switch notifStatus {
        case .authorized, .provisional:
          Label("Reminders enabled", systemImage: "bell.badge")
        case .denied:
          // Re-prime path per spec §5: once denied, only Settings can enable.
          Button("Enable in Settings…") {
            if let url = URL(string: UIApplication.openSettingsURLString) {
              UIApplication.shared.open(url)
            }
          }
        default:
          Button("Enable reminders") {
            Task {
              await PushManager.requestAndRegister()
              await refreshNotifStatus()
            }
          }
        }
      }

      Section("Sync") {
        LabeledContent("Status") {
          Text(String(describing: sync.state).capitalized)
        }
        Button("Sync now") { Task { await sync.syncNow() } }
        if !issues.isEmpty {
          ForEach(issues) { issue in
            VStack(alignment: .leading) {
              Text(issue.message).font(.callout)
              Text(issue.occurredAt, format: .relative(presentation: .named))
                .font(.caption).foregroundStyle(.secondary)
            }
            .swipeActions {
              Button("Dismiss", role: .destructive) {
                context.delete(issue)
                try? context.save()
              }
            }
          }
        }
      } footer: {
        if !issues.isEmpty {
          Text("These changes were rejected by the server and undone by the last sync.")
        }
      }

      Section {
        Button("Sign out", role: .destructive) { confirmSignOut = true }
      }
    }
    .navigationTitle("Settings")
    .onAppear {
      if let p = profile {
        fullName = p.fullName
        currency = p.preferredCurrency
        language = p.preferredLanguage
      }
    }
    .task { await refreshNotifStatus() }
    .confirmationDialog(
      "Sign out? Local data on this device will be erased.",
      isPresented: $confirmSignOut, titleVisibility: .visible) {
      Button("Sign out", role: .destructive) { signOut() }
    }
  }

  private func saveProfile() {
    guard let p = profile else { return }
    try? Store(context: context).updateProfile(
      p, fullName: fullName.trimmingCharacters(in: .whitespaces),
      preferredCurrency: currency, preferredLanguage: language)
    Task { await sync.syncNow() }
  }

  private func refreshNotifStatus() async {
    notifStatus = await UNUserNotificationCenter.current()
      .notificationSettings().authorizationStatus
  }

  private func signOut() {
    // Best-effort server-side device-token removal before the token dies.
    if let token = PushManager.deviceTokenForLogout {
      let client = APIClient()
      Task.detached {
        try? await client.post(
          path: "/api/v1/device-tokens/\(token)", body: nil,
          method: "DELETE", idempotencyKey: UUID())
      }
    }
    auth.signOut(container: context.container)
  }
}

// Placeholder — Task 14 replaces this with the real PushManager file.
enum PushManager {
  static func requestAndRegister() async {}
  static var deviceTokenForLogout: String? { nil }
}
```

Delete the `SettingsView` stub from `DashboardView.swift`.

- [x] **Step 2: Build + full test suite — expect green.**

- [x] **Step 3: Manual check** — edit the name, Save, confirm the PATCH drains (server profile updates); currency switch immediately reformats every money value (MoneyText reads the profile); force a sync issue (create an EMI offline with a tenure of 601 by temporarily bypassing the form validator — or just trust the SyncEngine unit tests) and confirm the issues list renders; sign out wipes data and returns to login.

- [x] **Step 4: Commit**

```bash
git add -A apps/ios/Phinio
git commit -m "✨ feat(ios): settings — profile, notifications, sync issues, sign-out"
```

---

### Task 13: Onboarding flow

**Files:**
- Modify: `apps/ios/Phinio/Phinio/Networking/APIClient.swift` (add `signUp`)
- Modify: `apps/ios/Phinio/Phinio/Auth/AuthManager.swift` (add `signUp` passthrough)
- Create: `apps/ios/Phinio/Phinio/UI/Onboarding/OnboardingView.swift`
- Create: `apps/ios/Phinio/Phinio/UI/Onboarding/AuthStepView.swift`
- Modify: `apps/ios/Phinio/Phinio/PhinioApp.swift` (`RootView` gains the onboarding branch)
- Delete: `apps/ios/Phinio/Phinio/UI/LoginView.swift` (superseded by `AuthStepView`)

**Interfaces:**
- Consumes: `AuthManager.signIn`, `SyncEngine.syncNow`, `PushManager.requestAndRegister` (Task 12 placeholder / Task 14 real).
- Produces:
  - `APIClient.signUp(name:email:password:) async throws` — POST `/api/auth/sign-up/email` `{name, email, password}`; success is 2xx (no token — email verification is required before sign-in works).
  - `AuthManager.signUp(name:email:password:) async throws` — passthrough to the client (no state change; the user still signs in after verifying).
  - `OnboardingView` — full-screen flow; sets `@AppStorage("hasOnboarded") = true` when finished.
  - `RootView` logic: `!auth.isAuthenticated` → `OnboardingView` (starts at welcome on first launch, straight at auth after a sign-out); `auth.isAuthenticated && !hasOnboarded` → `OnboardingView` (resumes at the priming step); else `MainTabView`.

- [x] **Step 1: Add `signUp` to `APIClient`** (below `signIn`; same shape, but any 2xx passes and no token is read):

```swift
  /// Create an account. Better Auth requires email verification before
  /// sign-in succeeds, so no token comes back here.
  func signUp(name: String, email: String, password: String) async throws {
    var req = request(path: "/api/auth/sign-up/email", method: "POST")
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.httpBody = try JSONEncoder().encode(
      ["name": name, "email": email, "password": password])
    let (data, response): (Data, URLResponse)
    do {
      (data, response) = try await session.data(for: req)
    } catch {
      throw APIError.retryable
    }
    guard let http = response as? HTTPURLResponse,
          (200...299).contains(http.statusCode) else {
      let envelope = try? JSONDecoder().decode(ErrorEnvelope.self,
                                               from: data)
      throw APIError.rejected(
        code: envelope?.error.code ?? "sign_up_failed",
        message: envelope?.error.message ?? "Sign-up failed")
    }
  }
```

(The tuple destructure mirrors `signIn`'s structure exactly, so `data` is in scope for the error-envelope decode.)

And in `AuthManager`:

```swift
  func signUp(name: String, email: String, password: String) async throws {
    try await client.signUp(name: name, email: email, password: password)
  }
```

- [x] **Step 2: Implement the flow container**

```swift
// apps/ios/Phinio/Phinio/UI/Onboarding/OnboardingView.swift
import SwiftUI

/// First-launch flow (spec §5): welcome pages → auth → notification priming
/// → initial sync. Every step except auth is skippable. `hasOnboarded`
/// flips once the flow completes so relaunches go straight to the tabs.
struct OnboardingView: View {
  @EnvironmentObject private var auth: AuthManager
  @EnvironmentObject private var sync: SyncEngine
  @AppStorage("hasOnboarded") private var hasOnboarded = false

  enum Stage { case welcome, auth, priming, syncing }
  @State private var stage: Stage

  init(startAt stage: Stage = .welcome) {
    _stage = State(initialValue: stage)
  }

  var body: some View {
    switch stage {
    case .welcome:
      WelcomePages { stage = .auth }
    case .auth:
      AuthStepView { stage = .priming }
    case .priming:
      PrimingStep {
        stage = .syncing
      }
    case .syncing:
      InitialSyncStep { hasOnboarded = true }
    }
  }
}

private struct WelcomePages: View {
  let done: () -> Void
  @State private var page = 0

  private static let pages: [(symbol: String, title: String, text: String)] = [
    ("chart.line.uptrend.xyaxis", "Track investments",
     "Savings, DPS, stocks, gold and more — with gains at a glance."),
    ("creditcard", "Manage EMIs",
     "Full amortization schedules, payment tracking and reminders."),
    ("wifi.slash", "Works offline",
     "Everything works without a connection and syncs when you're back."),
  ]

  var body: some View {
    VStack {
      TabView(selection: $page) {
        ForEach(Array(Self.pages.enumerated()), id: \.offset) { i, p in
          VStack(spacing: 16) {
            Image(systemName: p.symbol)
              .font(.system(size: 64))
              .foregroundStyle(.tint)
            Text(p.title).font(.title.bold())
            Text(p.text)
              .multilineTextAlignment(.center)
              .foregroundStyle(.secondary)
              .padding(.horizontal, 32)
          }
          .tag(i)
        }
      }
      .tabViewStyle(.page)
      Button(page == Self.pages.count - 1 ? "Get started" : "Skip") { done() }
        .buttonStyle(.borderedProminent)
        .padding(.bottom, 32)
    }
  }
}

private struct PrimingStep: View {
  let done: () -> Void

  var body: some View {
    VStack(spacing: 16) {
      Spacer()
      Image(systemName: "bell.badge")
        .font(.system(size: 64)).foregroundStyle(.tint)
      Text("Payment reminders").font(.title.bold())
      Text("Get notified before EMI payments and DPS installments are due, so nothing slips.")
        .multilineTextAlignment(.center)
        .foregroundStyle(.secondary)
        .padding(.horizontal, 32)
      Spacer()
      Button("Enable reminders") {
        Task {
          await PushManager.requestAndRegister()
          done()
        }
      }
      .buttonStyle(.borderedProminent)
      Button("Maybe later") { done() }
        .padding(.bottom, 32)
    }
  }
}

private struct InitialSyncStep: View {
  @EnvironmentObject private var sync: SyncEngine
  let done: () -> Void

  var body: some View {
    VStack(spacing: 16) {
      ProgressView().controlSize(.large)
      Text("Getting your data…").foregroundStyle(.secondary)
      if sync.state == .offline {
        Text("Couldn't reach the server — you can start offline.")
          .font(.caption).foregroundStyle(.secondary)
        Button("Continue") { done() }
      }
    }
    .task {
      await sync.syncNow()
      done() // idle or offline — either way the app is usable
    }
  }
}
```

```swift
// apps/ios/Phinio/Phinio/UI/Onboarding/AuthStepView.swift
import SwiftUI

/// Sign-in / sign-up with the "check your email" verification loop:
/// after sign-up we retry sign-in on demand until verification sticks.
struct AuthStepView: View {
  let done: () -> Void
  @EnvironmentObject private var auth: AuthManager

  enum Mode { case signIn, signUp, checkEmail }
  @State private var mode: Mode = .signIn
  @State private var name = ""
  @State private var email = ""
  @State private var password = ""
  @State private var error: String?
  @State private var busy = false

  var body: some View {
    NavigationStack {
      Form {
        switch mode {
        case .checkEmail:
          Section {
            Label("Check your email", systemImage: "envelope.badge")
              .font(.headline)
            Text("We sent a verification link to \(email). Tap it, then come back here.")
              .foregroundStyle(.secondary)
          }
          Section {
            Button(busy ? "Checking…" : "I've verified — continue") {
              Task { await trySignIn() }
            }
            .disabled(busy)
          }
        case .signIn, .signUp:
          Section {
            if mode == .signUp {
              TextField("Full name", text: $name)
                .textContentType(.name)
            }
            TextField("Email", text: $email)
              .textContentType(.emailAddress)
              .keyboardType(.emailAddress)
              .textInputAutocapitalization(.never)
              .autocorrectionDisabled()
            SecureField("Password", text: $password)
              .textContentType(mode == .signUp ? .newPassword : .password)
          }
          if let error {
            Section { Text(error).foregroundStyle(.red) }
          }
          Section {
            Button(busy ? "Working…" : (mode == .signUp ? "Create account"
                                                        : "Sign in")) {
              Task { mode == .signUp ? await submitSignUp()
                                     : await trySignIn() }
            }
            .disabled(busy || email.isEmpty || password.isEmpty
                      || (mode == .signUp && name.trimmingCharacters(
                            in: .whitespaces).count < 2))
            Button(mode == .signUp ? "Have an account? Sign in"
                                   : "New here? Create an account") {
              error = nil
              mode = mode == .signUp ? .signIn : .signUp
            }
          }
        }
      }
      .navigationTitle("Phinio")
    }
  }

  private func trySignIn() async {
    busy = true
    defer { busy = false }
    do {
      try await auth.signIn(email: email, password: password)
      done()
    } catch let APIError.rejected(_, message) {
      error = message
      if mode == .checkEmail { error = "Not verified yet — try again in a moment." }
    } catch {
      self.error = "Could not reach the server."
    }
  }

  private func submitSignUp() async {
    busy = true
    defer { busy = false }
    do {
      try await auth.signUp(
        name: name.trimmingCharacters(in: .whitespaces),
        email: email, password: password)
      error = nil
      mode = .checkEmail
    } catch let APIError.rejected(_, message) {
      error = message
    } catch {
      self.error = "Could not reach the server."
    }
  }
}
```

- [x] **Step 3: Rewire `RootView`** in `PhinioApp.swift`:

```swift
struct RootView: View {
  @EnvironmentObject private var auth: AuthManager
  @EnvironmentObject private var sync: SyncEngine
  @Environment(\.modelContext) private var context
  @AppStorage("hasOnboarded") private var hasOnboarded = false

  var body: some View {
    if auth.isAuthenticated && hasOnboarded {
      MainTabView()
        .onChange(of: sync.state) { _, state in
          if state == .unauthorized {
            auth.signOut(container: context.container)
          }
        }
    } else if auth.isAuthenticated {
      // Signed in mid-onboarding (or flag lost): resume at priming.
      OnboardingView(startAt: .priming)
    } else {
      // Post-sign-out relaunches skip the welcome pages.
      OnboardingView(startAt: hasOnboarded ? .auth : .welcome)
    }
  }
}
```

Note the sign-out case: `AuthManager.signOut` flips `isAuthenticated`; `hasOnboarded` deliberately stays true so a returning user lands on the auth step directly. Delete `UI/LoginView.swift`.

- [x] **Step 4: Build + full test suite — expect green.**

- [x] **Step 5: Manual check** — delete the app from the simulator (clears UserDefaults), reinstall: welcome pages → sign in → priming ("Maybe later") → sync spinner → dashboard. Sign out from Settings → lands on the auth step, no welcome pages. Create a fresh account against dev (`npm run dev` prints the verification link to the console — open it, then "I've verified").

- [x] **Step 6: Commit**

```bash
git add -A apps/ios/Phinio
git commit -m "✨ feat(ios): onboarding — welcome, signup + verification, priming, initial sync"
```

---

### Task 14: APNs registration, deep links from notification taps, badge

**Files:**
- Create: `apps/ios/Phinio/Phinio/Support/PushManager.swift`
- Modify: `apps/ios/Phinio/Phinio/PhinioApp.swift` (add `@UIApplicationDelegateAdaptor`, share the router with the delegate)
- Modify: `apps/ios/Phinio/Phinio/UI/Dashboard/SettingsView.swift` (delete the `PushManager` placeholder enum)
- Create: `apps/ios/Phinio/Phinio/Phinio.entitlements`

**Interfaces:**
- Consumes: `DeepLink.parse`/`DeepLinkRouter` (Task 5), `APIClient.post`.
- Produces:
  - `enum PushManager { static func requestAndRegister() async; static func handleDeviceToken(_ deviceToken: Data); static var deviceTokenForLogout: String? }` — token hex stored in `UserDefaults` key `"apnsDeviceToken"`.
  - `final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate` with `static weak var router: DeepLinkRouter?` (set by `PhinioApp.init`).
- APNs payload from the server (`src/server/apns.ts`): `{"aps": {"alert": {"title", "body"}, "badge": n}, "link": "/app/emis/<id>" | "/app/investments/dps/<id>"}` — the badge is server-computed (unread count), so the client never sets it. ponytail: no local badge bookkeeping; the next server push corrects it.

- [x] **Step 1: Implement**

```swift
// apps/ios/Phinio/Phinio/Support/PushManager.swift
import SwiftUI
import UserNotifications

enum PushManager {
  private static let tokenKey = "apnsDeviceToken"

  static var deviceTokenForLogout: String? {
    UserDefaults.standard.string(forKey: tokenKey)
  }

  /// Priming flow: request permission, then register with APNs. The token
  /// arrives async in AppDelegate.didRegisterForRemoteNotifications.
  @MainActor
  static func requestAndRegister() async {
    let granted = (try? await UNUserNotificationCenter.current()
      .requestAuthorization(options: [.alert, .badge, .sound])) ?? false
    guard granted else { return }
    UIApplication.shared.registerForRemoteNotifications()
  }

  static func handleDeviceToken(_ deviceToken: Data) {
    let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
    UserDefaults.standard.set(hex, forKey: tokenKey)
    // Upsert-on-token server-side, so a plain retry-less POST is fine —
    // the next launch re-registers anyway.
    Task {
      try? await APIClient().post(
        path: "/api/v1/device-tokens",
        body: try? JSONSerialization.data(withJSONObject:
          ["token": hex, "platform": "ios"]),
        method: "POST", idempotencyKey: UUID())
    }
  }
}

final class AppDelegate: NSObject, UIApplicationDelegate,
                         UNUserNotificationCenterDelegate {
  static weak var router: DeepLinkRouter?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions:
      [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    UNUserNotificationCenter.current().delegate = self
    // Re-register on every launch if permission was already granted, so a
    // rotated APNs token reaches the server without user action.
    Task { @MainActor in
      let status = await UNUserNotificationCenter.current()
        .notificationSettings().authorizationStatus
      if status == .authorized {
        UIApplication.shared.registerForRemoteNotifications()
      }
    }
    return true
  }

  func application(_ application: UIApplication,
                   didRegisterForRemoteNotificationsWithDeviceToken
                     deviceToken: Data) {
    PushManager.handleDeviceToken(deviceToken)
  }

  // Reminder tapped → deep-link to the EMI / DPS detail.
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse
  ) async {
    let userInfo = response.notification.request.content.userInfo
    if let link = userInfo["link"] as? String,
       let parsed = DeepLink.parse(link) {
      await MainActor.run { Self.router?.pending = parsed }
    }
  }

  // Show reminders as banners while the app is foregrounded too.
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification
  ) async -> UNNotificationPresentationOptions {
    [.banner, .badge, .sound]
  }
}
```

In `PhinioApp.swift`, add to the `App` struct:

```swift
  @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
```

and at the end of `init()` (Task 5 already made the router a plain `let deepLinkRouter`):

```swift
    AppDelegate.router = deepLinkRouter
```

Delete the placeholder `PushManager` enum from `SettingsView.swift`.

- [x] **Step 2: Entitlements.** Create `apps/ios/Phinio/Phinio/Phinio.entitlements`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>aps-environment</key>
	<string>development</string>
</dict>
</plist>
```

Wire it into the build settings (both Debug and Release of the app target):

```bash
sed -i '' 's|CODE_SIGN_STYLE = Automatic;|CODE_SIGN_STYLE = Automatic;\n\t\t\t\tCODE_SIGN_ENTITLEMENTS = Phinio/Phinio.entitlements;|' apps/ios/Phinio/Phinio.xcodeproj/project.pbxproj
grep -c CODE_SIGN_ENTITLEMENTS apps/ios/Phinio/Phinio.xcodeproj/project.pbxproj
```

Expected count: 2 (Debug + Release of the app target). If the sed also hit the test target's configs (count > 2), revert (`git checkout -- '*.pbxproj'`) and add the setting in the Xcode GUI instead (Signing & Capabilities → + Capability → Push Notifications), which is a 30-second user step.

- [x] **Step 3: Build + full test suite — expect green.** Simulator builds fine with the entitlement; real APNs delivery needs the physical device.

- [x] **Step 4: Manual check (device, best-effort)** — on the physical iPhone with the dev server reachable: enable reminders in onboarding/Settings, confirm a `device_tokens` row appears in the DB (`npm run db:studio`). Full push delivery also needs `APNS_KEY_ID`/`APNS_TEAM_ID`/`APNS_PRIVATE_KEY` configured server-side and the reminder cron to fire — verify via the cron's `apnsPushed` count if configured, otherwise defer to TestFlight.

- [x] **Step 5: Commit**

```bash
git add -A apps/ios/Phinio
git commit -m "✨ feat(ios): APNs registration, notification deep links + entitlements"
```

---

### Task 15: Localization (String Catalog, en + bn)

**Files:**
- Create: `apps/ios/Phinio/Phinio/Localizable.xcstrings` (created via Xcode or as a JSON file — format below)
- Modify: `apps/ios/Phinio/Phinio.xcodeproj/project.pbxproj` (add `bn` to `knownRegions` — one-line sed)

**Interfaces:** none — SwiftUI string literals in `Text`, `Button`, `TextField` labels etc. are automatically `LocalizedStringKey`s; the catalog picks them up at build time.

Translation source: the web app's Bengali resources at `src/lib/i18n/resources/bn/*.json` (namespaces: common, dashboard, investments, emis, profile, notifications, validation, activity, withdraw). Match by meaning, not key — e.g. the iOS literal `"Net worth"` takes the value of `dashboard.json`'s `netWorth.label` bn entry. Where no web equivalent exists (e.g. "Schedule appears after first sync"), translate consistently with the web tone.

- [x] **Step 1: Register the language.**

```bash
sed -i '' 's/knownRegions = (/knownRegions = (\n\t\t\t\tbn,/' apps/ios/Phinio/Phinio.xcodeproj/project.pbxproj
grep -A4 "knownRegions" apps/ios/Phinio/Phinio.xcodeproj/project.pbxproj
```

Expected: `bn` listed alongside `en` and `Base`.

- [x] **Step 2: Create the catalog and extract.** Create an empty catalog file:

```bash
cat > apps/ios/Phinio/Phinio/Localizable.xcstrings <<'EOF'
{
  "sourceLanguage" : "en",
  "strings" : {
  },
  "version" : "1.0"
}
EOF
```

Then build once — Xcode extracts every literal into the catalog automatically (`LOCALIZED_STRING_SWIFTUI_SUPPORT` is on by default):

```bash
xcodebuild build -project apps/ios/Phinio/Phinio.xcodeproj -scheme Phinio -destination "id=$UDID" | tail -3
python3 -c "import json;d=json.load(open('apps/ios/Phinio/Phinio/Localizable.xcstrings'));print(len(d['strings']),'strings extracted')"
```

Expected: on the order of 100–150 strings.

- [x] **Step 3: Add bn translations.** For every key in the catalog, add a `"bn"` localization sourced from the web bn resources. The catalog entry format is:

```json
"Net worth" : {
  "localizations" : {
    "bn" : { "stringUnit" : { "state" : "translated", "value" : "নিট সম্পদ" } }
  }
}
```

Work through the catalog key-by-key with the web bn JSONs open (`src/lib/i18n/resources/bn/dashboard.json` etc.). Keys with interpolation (`\(count)`) become format strings (`%lld`) in the catalog — keep the placeholder in the bn value. Strings with no web counterpart get a fresh translation matching the web's Bengali register (the web files show the tone — e.g. "সিঙ্ক" for sync-related terms).

- [x] **Step 4: Verify.** Run with Bengali:

```bash
xcrun simctl launch $UDID com.phinio.app -AppleLanguages "(bn)"
```

(or set the scheme's App Language to Bengali in Xcode). Dashboard, tab labels, and forms must render in Bengali; numbers stay Latin (the web pins Bengali numerals via locale — iOS `Decimal.FormatStyle` with the device locale handles digits automatically; accept the system default).

- [x] **Step 5: Run the full test suite — expect green** (localization changes no logic). Commit:

```bash
git add -A apps/ios/Phinio
git commit -m "🌐 feat(ios): Bengali localization via String Catalog"
```

---

### Task 16: Final verification checkpoint

**Files:** none new — verification + plan bookkeeping only.

- [x] **Step 1: Full test suite** — all suites green:

```bash
xcodebuild test -project apps/ios/Phinio/Phinio.xcodeproj -scheme Phinio -destination "id=$UDID" -only-testing:PhinioTests 2>&1 | grep -E "Test case|TEST "
```

- [x] **Step 2: Manual end-to-end pass** against `npm run dev` (fresh simulator install):
  1. Onboarding: welcome → create account → verify via dev-console link → "I've verified" → priming (Maybe later) → initial sync → empty-state dashboard.
  2. Create one of each: lump-sum investment, savings (with initial balance), DPS, EMI (with processing fee). All appear instantly; dashboard populates.
  3. Offline round-trip: stop the dev server, mark an EMI payment paid + add a savings deposit, restart the server, sync — both mutations land (check the web app or `npm run db:studio`).
  4. Server-rejection path: verified by SyncEngine unit tests (rejected mutation → SyncIssue row + local state reverted by next snapshot) — spot-check the Settings sync-issues list renders it if one occurs naturally.
  5. Currency switch BDT→USD in Settings reformats all amounts; language switch works after Task 15.
  6. Sign out → data wiped → auth step (no welcome pages).
- [x] **Step 3: Tick all checkboxes in this plan**, then commit and push:

```bash
git add docs/superpowers/plans/2026-07-17-ios-screens.md
git commit -m "📝 docs: tick plan 3 checkboxes"
git push -u origin HEAD
```

Open a stacked PR (base: `feat/ios-app-foundation`) titled `✨ feat(ios): full native UI — onboarding, dashboard, investments, EMIs, notifications`.

**Known deferred items (carry into the PR description):**
- Production base URL in `AppConfig.swift` (`https://phinio.vercel.app`) still needs confirmation before a TestFlight build.
- APNs end-to-end delivery verification needs server env keys + a TestFlight/device build.
- `BGAppRefreshTask` background sync (spec §2 mentions it) is NOT in this plan — foreground + post-write sync covers the product need; add it if reminders regularly arrive before the data they reference. ponytail: skipped, add when stale-on-open becomes noticeable.




