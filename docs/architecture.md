---
title: Application architecture
description: Dependency direction and separation between financial rules, feature models, views, and reusable UI.
---

## Responsibilities

| Layer                   | Owns                                                      | May depend on                                          |
| ----------------------- | --------------------------------------------------------- | ------------------------------------------------------ |
| `app`                   | Provider composition, application state, feature assembly | Public feature entries, public UI, domain              |
| `features/<name>/model` | Use cases, view-model hooks, parsing and orchestration    | Domain, React, shared utilities, its own model modules |
| `features/<name>/ui`    | Rendering prepared data and callbacks                     | Public UI, its own view components, model types        |
| `design-system`         | Styling, accessibility, UI variants, icons, themes        | React, Fluent, other design-system modules             |
| `domain`                | Financial calculations, validation rules, value types     | Other domain modules only                              |
| `shared`                | Pure draft parsing and presentation formatting utilities  | Other shared modules only                              |

The current `foundation` feature has no business model. The app owns its main preview
state; the standalone confirmation example owns only its modal's open state.
The `growth` feature owns worksheet state, input parsing, and presentation formatting
in `model/`. Its container connects that model to a stateless view, and the model calls
the independent `domain/growth` engine. Do not create placeholder services,
repositories, global stores, or routing before their requirements exist.

The `plan` feature owns in-memory household, account, income, and phase drafts. Its model calls
`domain/plan` to compile an ordered monthly schedule and run account-level projections.
The feature prepares timelines, charts, and tables from those domain outputs.
`shared/numbers` supplies money/percentage parsing and exact-cent display formatting to
worksheet models without introducing feature-to-feature dependencies. Views and
domain engines cannot import those presentation utilities.

The `portfolio` feature owns independent brokerage drafts and report formatting.
Its model calls `domain/portfolio`; neither imports the plan feature. App navigation
keeps worksheet containers mounted, preserving their in-memory drafts when switching
views. Reloading still clears inputs.

## Engines and worksheets

A calculator engine accepts an explicit, validated input contract and returns structured
results or errors. It has no dependency on worksheets, React, persistence, browser APIs,
or AI providers. Its outputs include the assumptions and calculation version needed to
explain results.

Worksheets help assemble inputs and inspect outputs. They do not own formulas.
Future CLI, server, batch, or AI-tool adapters must call the same engine rather than
reimplement financial behavior. AI can suggest scenarios and explain results, but
deterministic code remains authoritative. See the [growth-engine contract](growth-engine.md).

The existing growth engine has fixed cash flows and assumptions throughout a projection.
The independent schedule compiler now validates phase boundaries and carries account
instructions forward. It does not run the growth engine or calculate plan balances.

### Implemented portfolio-tax contract

`runPortfolioProjection(unknown)`, exported by `domain/portfolio`, returns structured
path/message errors or a `portfolio-1.1.0` result. The pure engine returns isolated
assumptions, monthly account and asset rows, calendar-year summaries, combined
holdings totals, and rebalance, settlement, and tax-shortage events.

Inputs specify a YYYY-MM start, 1-1200 months, entered ordinary-income,
qualified-dividend and realized-gain rates, and taxable brokerage accounts.
Accounts have starting cash, monthly external cash contributions, distribution
handling, an explicit `newCashMode` (`invest` or `hold`), a rebalance policy, and
stock/bond assets. Assets specify starting value,
pooled basis, invested-sleeve target weight, annual price growth, annual yield,
and the qualified share of stock dividends. Bonds produce ordinary interest.
Accounts are additive holdings, not alternative scenarios.

Money is safe-integer USD cents; rates are fractional values. Targets total one,
excluding cash. Initial allocations need not match targets. Price growth must be
greater than -1 and at most 100; yield is between zero and 10; tax rates and qualified
shares are between zero and one. Calendar years stay within 0001-9999.
Invalid or overflowing projections return errors rather than partial results.

Monthly accounting order:

1. Apply effective monthly price growth using the annual price-only rate.
2. Calculate each distribution as annual yield divided by 12 on post-growth value.
3. Add external contributions to account cash.
4. Assess distribution taxes and pay current/prior liabilities from available cash.
5. Plan rebalance sales from pretrade invested-sleeve weights, then execute them.
6. Settle net realized-gain tax in December or the final month and pay available cash.
7. Buy target deficits after a rebalance, or reinvest remaining distributions into
   their originating assets when reinvestment is selected and invest remaining
   new cash by target weight when `newCashMode` is `invest`.

Distribution cash is additional to modeled price growth, not deducted from asset
value; a total-return assumption would double-count yield. Distributions and their
per-asset tax categories round separately to cents. Sales remove proportional pooled
basis, with exact basis removal on full liquidation. Purchases add their cost to basis.
This is a planning approximation, not a universal tax-reporting basis election.

Rebalancing is disabled, calendar-annual in December, or triggered by a monthly
absolute percentage-point drift check. Targets apply to invested assets only.
In `invest` mode, starting cash and monthly external contributions buy by target
weight at month-end, after taxes, independently of dividend handling and rebalance
triggers. New accounts default to this mode. `hold` preserves the earlier behavior:
these dollars deploy only at a rebalance. Missing or invalid modes are rejected.
The engine tracks new cash separately from retained payouts. Taxes consume other cash
first, then reduce new cash available for purchases. Between rebalances, retained
payouts stay in cash; reinvested payouts buy their originating assets, while new cash
buys by target weight. Purchases add basis, generate no sales, and do not increment
rebalance counts. First-month starting cash earns no investment return until after
its month-end purchase. A rebalance
uses all available post-tax cash, including distributions held between rebalances,
for target-deficit purchases. Taxes may prevent exact target weights. Cash earns zero.

Distribution tax uses separate ordinary and qualified rates. Positive net realized
gains receive one entered rate at settlement; same-account, same-calendar-year losses
offset gains. No cross-account netting, loss carryforward, ordinary-income loss
deduction, short/long-term split, tax lots, or wash-sale rules are modeled.
The final partial year settles projected gains explicitly. Pre-start year-to-date
activity and pre-existing tax liabilities are not inputs.

Taxes never trigger additional forced sales. Unpaid assessed tax persists, and
future available cash pays it before investment. Gross assets equal investments
plus cash; equity subtracts unpaid assessed tax. Paid tax has already reduced cash.
Unrealized gains are not taxed at the horizon, so equity is not after-liquidation
wealth. This entered-rate calculator does not implement a household return,
year-specific tax law, payment deadlines, withholding, or retirement cash routing.

The worksheet exposes account and aggregate ledgers, asset basis and realized gains,
and event details. Every input edit invalidates results. Synthetic engine/model
tests cover cent reconciliation, tax liabilities, gain/loss settlement, cash
deployment, and independent account aggregation.

### Implemented schedule contract

`compilePlan(unknown)` returns structured path/message errors or a versioned schedule
(`plan-schedule-1.0.0`). Inputs specify a YYYY-MM start, 1-1200 whole months, starting
ages in whole months, stable account IDs, and an ordered list of phases.
The first phase begins at plan start. Later phases reference either person's age;
intervals are end-exclusive, strictly increasing, and remain inside the horizon.
Calendar arithmetic uses month indices rather than time zones or dates of birth.

Account defaults carry forward. Each phase overrides only its supplied settings;
omission means inherit, while zero means an explicit change to zero. A rate override
replaces the whole effective/nominal assumption. Resolved instructions record the
source phase ID for each setting, or null for the original account default.
Money uses safe-integer cents; annual rates use decimal fractions.
Effective rates must be at least -1; nominal rates must be nonnegative with an explicit
1, 2, 4, 12, or 365 compounding frequency. Fees must be between zero and one.
The separate plan projection runner converts these conventions into equivalent monthly
accrual. It does not reproduce bank interest-crediting dates.

The compiler rejects unknown keys, missing references, duplicate IDs or account changes,
invalid ownership, and combined-portfolio accounts mixed with detailed accounts.
Partner and joint ownership require a partner; retirement accounts cannot be joint.
Starting ages are supported from 0 to 1800 months. Calendar years remain within 0001-9999.
Inputs and resolved settings are isolated from mutation. No balances are invented.

The editor invalidates previews on every edit and requires validation before showing
results. Plan copies are independent, remain in memory, and preserve stable internal
account and phase IDs. Account removal requires confirmation and removes its overrides;
phase removal requires confirmation because it changes later inheritance.
The household form accepts whole years and optional additional months, converting
them to the unchanged monthly engine contract. Existing month-based in-memory drafts
remain readable until edited; invalid or partial year input is never coerced to zero.
Validation runs from Schedule preview or Projection report. After the first request, errors update while
editing and stay visible across tabs with links to their owning section; successful
results still require explicit revalidation.

### Implemented phased financial contract

`runPlanProjection(unknown)` accepts a `schedule` input plus `incomes`,
`cashAccountId`, `monthlySpendingCents`, `withdrawalOrder`, `phaseChanges`,
`annualInflationRate`, and optional `taxes`. Money is safe-integer USD cents; rates are decimal
fractions. It returns structured errors or versioned monthly, annual, account,
and household results. Invalid or overflowing calculations never return partial results.

Each income stream names its recipient, type (Social Security or pension), start
age, monthly amount at that age, and annual increase assumption. Each person's
start uses the household clock; no new phase is required. Increases occur after
12 payment months and at subsequent start anniversaries. Starts before the plan
use the original start amount with elapsed anniversary increases; starts beyond
the horizon pay nothing within the projection. Payments continue through the horizon.
These are assumptions, not benefit estimates, official COLAs, or tax calculations.

Spending is fixed nominal monthly dollars until a phase overrides it. It does not
automatically escalate with reporting inflation. Spending and automatic withdrawal
order inherit across phases, including explicit zero spending or an empty order.
Only selected accounts cover automatic spending gaps; no legal-access check is inferred.
The surplus destination must be savings/cash, or the sole aggregate portfolio.

With taxes disabled, monthly events follow this order:

1. Apply phase instructions for that month and record opening balances.
2. Accrue equivalent monthly growth and deduct the annual fee divided by 12.
3. Add external savings contributions, then fund scheduled withdrawals to spending.
4. Execute account-to-account transfers in input order for the active phase.
5. Combine scheduled withdrawals to spending with that month's income to fund spending.
6. Withdraw the remaining gap from the selected accounts in order.
7. Report any unmet spending without carrying debt into later months.
8. Deposit unused spendable funds into the chosen surplus account.
9. Record balances and reporting values using the global inflation clock.

Contributions are savings already budgeted outside this model, such as paycheck
savings during accumulation. They are not funded again from the entered income.
Scheduled withdrawals are internal transfers to the spending pool, not extra
spending; unused transfers return to the surplus account. Their unfunded requests
are reported separately from unmet household spending.

Optional `transfers` entries contain an ID, starting `phaseId`, kind (`transfer` or
`roth-conversion`), source and destination IDs, and an amount method. A missing
`amountKind` or `monthly-dollars` uses `monthlyAmountCents`, preserving older
inputs. `annual-percentage` uses a fractional `annualRate`. Missing entries
mean no transfers for older inputs. Optional `endPhaseId` is inclusive: an ID ends
at that phase's exclusive end boundary, `null` continues through the plan horizon,
and omission preserves the legacy single-phase duration. Endpoints must exist and
the ending phase cannot precede the starting phase. Each entry moves up to the
available source balance throughout its selected range. Separate entries never
supersede one another; overlapping entries execute independently. Unfilled amounts are
reported without arrears. The input order defines priority and permits funds received
earlier in the month to fund later transfers. Destinations first earn growth on
received funds the next month. Roth conversions require a traditional IRA/401k source
and Roth IRA/401k destination owned by the same individual; these structural checks
do not establish legal eligibility. The optional tax layer estimates ordinary
income on conversions; without that layer, tax consequences are not calculated.

Percentage transfers calculate an annual target from the source account's previous
December closing balance, frozen for the calendar year and recalculated each January.
An optional account `priorYearEndBalanceCents` supplies the December 31 balance before
the plan begins; it is required when the source funds a percentage transfer active
in the first calendar year. This reference is never an opening balance or a deposit.
Subsequent years use actual projected December month-end balances after all flows.
The editor hides the historical field when it is not required and blank. Previously
entered values remain accessible with an explanation that they may no longer be needed.
Visible historical fields name the exact preceding December date. Plans that begin
before distributions generally need no historical entry.
The annual target is rounded to cents. Monthly requests use differences of cumulative
rounded twelfths, so January through December sum to the annual target without a
negative final installment for small amounts. Only active phase months make requests:
there is no catch-up or redistribution across a partial phase/year. This is a
user-specified distribution assumption, not an IRS divisor or RMD compliance engine.
Active percentage transfer detail includes `referenceBalanceCents` and
`annualRequestedCents`. The report groups these details by transfer and calendar year,
separately from projection-year ledgers, and shows full-year targets beside active-month
requests, moved amounts, and unfilled amounts.

Monthly transfer details retain requested, moved, and unfilled cents for every
entry, with zeros outside its active phase range. Account and household summaries expose
transfers in/out and source shortfalls; Roth conversion in/out values are subsets,
not additional flows. Annual summaries sum monthly flows. Household totals cancel
in/out, and the report counts each moved dollar once when presenting total transfers.

Effective annual growth uses `expm1(log1p(rate) / 12)`. Nominal APR with `p`
compounding periods uses `expm1(p * log1p(rate / p) / 12)`. The latter is a
fractional monthly equivalent, not a promise about crediting dates.
Round growth, fees, and income payments to cents, with half-cent ties away from zero.
Surplus deposits occur after growth, so they first earn growth in the following month.
Today's-dollar growth discounts each month's growth separately before aggregation;
today's-dollar balances discount the closing value at the global month end.

Household balances reconcile as opening plus external contributions plus income
plus growth, less fees and funded spending. Internal transfers cancel across the
household. Annual rows group projection months 1-12, 13-24, and any final partial
year. Account tables and income detail retain individual sources. Zero closing
balances and first unmet spending are events, not probability-of-success scores.

Age presentation uses the compiled schedule's starting household ages and integer
month offsets, never reparses raw age drafts. Ledger ages use the opening boundary
(`startMonth - 1` for yearly rows, `month - 1` for monthly rows).
Phase and plan end ages use the exclusive end boundary, including partial final years.
Schedule preview presents two combined age columns, one for each boundary, using
the same primary-then-partner formatter as the ledgers. Without a partner, both
headings and cells contain only the primary person.
Yearly ledger labels omit projection-month counts. One age column shows the primary
person's starting age followed by the partner's when included; partner text is omitted
from both the heading and cells when no partner is included.

The report traces external contributions to each account's compiled phase setting
and source, and sums projected monthly contributions for entire-phase totals.
An explicit zero remains a zero override. These deposits are external new money;
using them for Roth conversions would incorrectly increase household wealth.
Account-to-account transfers and Roth conversions use separate entries; no contribution
is automatically reinterpreted or changed. Reported income includes gross Social
Security and pensions. Optional tax reports separately identify ordinary taxable
income, qualified dividends, gains, and tax consequences of conversions.

The report reuses design-system charts, tables, tabs, and year navigation. Edits
clear the schedule and financial report together. Income removal uses the same
focused confirmation flow as accounts, phases, and transfers. Removing an account
removes transfers referencing it; removing a phase removes transfers whose start or
explicit end names it, but preserves transfers spanning across it. Transfer names
are feature metadata resolved by stable transfer IDs, not financial instructions.
Existing unnamed drafts retain numbered fallback labels. Names are used consistently
in errors, confirmations, previews, and reports; clearing an explicit name is invalid.
Copies keep independent names, endpoints, and amount drafts. Removing the surplus account
requires choosing a new destination rather than silently redirecting deposits.

### Optional life-phase tax projection layer

`PlanProjectionInput.taxes` enables estimated taxes without changing the schedule
compiler or requiring tax inputs for existing plans. The feature stores independent
optional drafts under `PlanDraft.taxes` and parses them only when enabled.
The projection includes a separate `taxes` result only in enabled mode. Its monthly,
projection-year, and total reports keep assessed tax, paid tax, and closing unpaid
liability distinct. Unpaid liability is a closing stock, never a summed flow.

Tax inputs contain three estimated fractional rates (`ordinaryRate`,
`capitalGainsRate`, `qualifiedDividendRate`), brokerage account assumptions
(`accountId`, `costBasisCents`, `annualDividendYield`, `qualifiedDividendShare`),
income taxable shares (`incomeId`, `taxableShare`), and optional phase overrides.
Optional `paymentOrder` lists preferred tax funding accounts; omission follows
the current spending order. Entries in `phaseRates` may override `paymentOrder`:
an omitted field inherits, an array replaces the preferred order, and `null`
resumes following spending orders. Empty arrays use only the spending fallback.
All lists require unique, existing account IDs. Draft copies and account removal
preserve independent orders and remove stale references.
Every taxable account requires explicit basis. Pensions may use a fully-taxable
assumption; Social Security requires an entered 0-85% taxable share. Rates and
phase overrides accept an explicit zero. Missing rates or basis do not silently
imply a tax exemption. Aggregate portfolios are unsupported in tax-enabled mode.

The existing growth input is total return. Estimated dividends are reinvested
within that return, not added again as growth or spendable household cash.
Gross dividends add brokerage basis and create estimated ordinary/qualified tax.
External contributions and incoming cash transfers add basis. Brokerage outflows
remove proportional pooled basis and recognize gains; positive gains are taxed
per sale, with no loss offsets or carryforward. Savings positive growth is taxable
ordinary interest. Traditional retirement outflows are ordinary income except
same-owner traditional rollovers. Roth outflows are assumed qualified and tax-free;
conversions are taxed once, not again as their transfer subtotal.

Available income and scheduled withdrawals fund taxes first. With no separate
order, combined spending/tax gap funding retains its earlier behavior. A separate
order first funds existing tax shortfalls, then spending withdrawals create new
tax bills funded by that preferred order. Each tax-funding pass falls back to the
current spending withdrawal order when preferred funds run out. Tax-only accounts
do not cover spending gaps. Account withdrawal totals accumulate across both uses.
Each pass uses bounded cent-level gross-up, with at most one spending pass per
eligible account; 100% tax rates cannot create an unbounded retry loop.
Tax-shortfall liabilities persist into
later months without interest or penalties; spending shortfalls still do not.
Tax-paid amounts appear in the household ledger, so conservation is opening
balances plus growth minus fees plus external contributions plus gross income,
minus funded spending and taxes paid. Internal transfers cancel at household level.
Actual post-tax December balances feed later percentage-transfer instructions.

This is an estimated-rate planner, not a tax-return engine. There are no brackets,
deductions, credits, state rules, after-tax traditional retirement basis, penalties,
holding-period distinctions, Social Security eligibility calculations, or tax
payment deadlines. It does not deduct potential liquidation tax on ending
unrealized gains. The standalone portfolio engine remains a separate strategy
tool with its own price-only return and calendar-year gain-settlement contract.

### Further account and timeline composition

Optional account-level planning extends the headless-engine approach, not the view
layer's financial responsibilities. The domain-level plan runner coordinates
the household timeline, phase changes, scheduled cash flows, and account calculations.
The feature model owns editable drafts, validation presentation, engine invocation,
and comparison formatting; it must not become the financial orchestration engine.

Give accounts stable identifiers and ownership across phases. Carry balances and any
supported accrual state through transitions. Preserve the plan's global time and
starting-dollar reference: independently projecting each phase and concatenating the
results would incorrectly restart inflation discounting and other time-dependent rules.

Define a common monthly event order before composing account engines. Record internal
transfers as linked source and destination entries, and distinguish them from external
income, spending, fees, and taxes. Reconcile the account ledgers to household totals;
never count a retirement distribution both as retained account assets and new wealth.
If a transfer incurs modeled costs, record those costs separately.

Pure account-growth, goal-funding, bridge-funding, and distribution-policy capabilities
can each support a standalone calculator when their contracts are established. The
full plan and standalone worksheets must share those implementations. Extend or
extract the existing growth engine where needed rather than duplicating its arithmetic.
Compound-rate normalization belongs in deterministic domain code, not field handlers.

Recalculation should consume explicit plan inputs without mutating them. Results should
identify their inputs and engine/rule versions so comparisons remain explainable.
Editable alternatives do not imply persistence: storage and revision-history adapters
remain outside the engine and require a separate privacy decision.

## Dependency direction

Financial calculations never import React, Fluent UI, feature code, browser APIs,
or formatting concerns. View components never call calculations, fetch data, or
own business state. Keep locale-aware display formatting in the feature model.
Use type-only imports when a view needs a model's result contract.

Features cannot import each other. Coordinate shared behavior in the app or extract
genuinely reusable domain capabilities. The design system must remain independent
of the investment domain so it can later become a separate package.

Consumers import UI from `@ui`, not internal files. App code imports features through
their public entries. The TypeScript and Vite aliases must remain synchronized.

## Enforcement and limits

The [ESLint policy](../tools/eslint/architecture.mjs) checks aliases and relative imports,
re-exports, static dynamic imports, and `require` calls. Non-static import paths are rejected.
External dependencies use a small allowlist; adding networking, routing, or other libraries
requires an intentional update to the policy and its regression checks.

Lint also keeps native elements and style overrides out of consumers, and prevents
React value imports in views. These checks enforce dependency direction, not arbitrary
semantics: they cannot prove that every arithmetic expression is presentation-only.
Review must still reject financial formulas and direct browser/network side effects in views
or domain modules. Do not disable lint rules to get around a boundary.

## Feature workflow

1. Establish formulas, units, currency, rounding, precision, validation, and examples.
2. Implement pure domain functions with tests for the agreed examples and edge cases.
3. Add a model that converts inputs into domain calls and prepares view data.
4. Compose a view from existing `@ui` components.
5. Add a reusable primitive only if the existing component API cannot express the need.
6. Add interaction, accessibility, and end-to-end coverage for the feature.

Infrastructure guardrail checks exist now because they validate the foundation itself.
Vitest runs domain and worksheet-model tests in a Node environment with no browser.
Test-only imports of Vitest are allowed in `*.test.ts`; production domain code remains
dependency-free. Component automation and coverage targets remain future work.
