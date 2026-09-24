---
title: Investment and retirement planning discovery
description: Generic product goals, candidate capabilities, AI interaction opportunities, and a proposed delivery sequence.
---

## Status and scope

Milestone one is approved: a headless monthly growth and cash-flow engine with annual
summaries and two-scenario worksheets. Its contract is recorded in
[growth-engine.md](growth-engine.md). The life-phase planner and standalone
entered-rate portfolio/tax calculator now extend that foundation. Their implemented
boundaries are recorded in [architecture.md](architecture.md); other capabilities
remain exploratory.
Live research services, AI integration, and personal-data storage are not implemented.

Confirmed constraints:

- The repository is public and contains no personal financial data.
- Initial financial rules target the United States.
- Rule sets identify their jurisdiction, applicable year, sources, and supported scope.
- Financial calculations remain separate from views and AI-generated explanations.
- Foundational requirements precede feature implementation.
- Calculator engines work without a UI and can later be called by AI through validated adapters.
- Worksheets prepare and explain a plan; they do not reimplement financial rules.
- Changing life phases follow the first milestone.

## Product purpose

Help users understand investment trade-offs, explore retirement timing and lifestyle
choices, create plans, set measurable goals, and track progress toward milestones.
Plans should connect projections to reviewable actions without presenting uncertain
returns or future legislation as guarantees.

The product is a planning workbench, not a promise to identify the best investment
or replace individualized financial, tax, or legal advice.

## Requested capability areas

| Capability         | Questions it should help answer                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| Compound growth    | How might savings grow with contributions, fees, inflation, and different return assumptions?                   |
| Withdrawals        | How do spending policies and withdrawal timing affect projected balances and shortfalls?                        |
| Taxes              | How do account types, income sources, realizations, and jurisdiction affect estimated after-tax outcomes?       |
| Medicare           | How do enrollment decisions, coverage choices, income-sensitive premiums, and healthcare costs affect the plan? |
| Rebalancing        | How do calendar-based and allocation-band policies compare after fees and estimated taxes?                      |
| Scenarios          | What changes when retirement age, savings, spending, returns, or withdrawal policies change?                    |
| Portfolio research | What do holdings cost, how concentrated are they, and what risks and exposures do they represent?               |

## Age-based household planning

The next planning capability should support multiple accumulation phases, not one
fixed saving period followed by retirement. Savings can change as earnings grow,
priorities change, or the household pursues an age-based savings target.

Confirmed requirements:

- Enter each person's age in years and months at a chosen planning start month and year.
- Do not require dates of birth; a spouse or partner is optional.
- Define phases using ages and show both people's ages when a partner is included.
- Support successive accumulation phases, pre-retirement preparation, bridge years,
  and later retirement changes.
- Account for different retirement, pension, Social Security, and Medicare timing
  for each person.
- Offer contextual prompts about potentially relevant age-based opportunities and rules.
- Show trends across phases in comparison charts and data tables.
- Keep examples synthetic and household inputs out of the public repository.

Age inputs establish a monthly planning approximation, not an exact date of birth
or an authoritative benefit-eligibility determination. The start month connects
relative ages to calendar periods for future year-specific rules. Tax-year rules,
enrollment windows, and exact-date exceptions require their own supported contracts.

### Proposed organizing model

Separate three concepts to avoid requiring a new household phase for every person's
benefit or healthcare transition:

- Phases change planned saving, spending, or investment assumptions.
- Person-specific milestones start or change an income stream, expense, or other
  supported behavior within a phase.
- Goals describe targets to assess, rather than balances or savings increases the
  engine assumes will materialize.

A savings increase can be a scenario assumption, a goal, or both, but those meanings
must be explicit. Eligibility prompts must not automatically start benefits or
increase contributions. Proposed phase templates are editable starting points,
not fixed restrictions on the household's plan.

The recommended editing flow is household timeline, phase cards, scheduled income
and expenses, funding sources and goals, then comparison results. Phase cards would
show what changes at the boundary and both people's ages. A boundary could be
anchored to either person's age, with the other age derived from the shared timeline.
The first editor slice supports these age anchors and shows both ages in its validated
schedule. Separate income streams and account cash-flow results now extend that
schedule. Automated benefit rules and goals remain future work.

### Bridge funding and rule boundaries

An aggregate portfolio projection cannot establish that a bridge period is fundable.
Future funding checks need account ownership, liquid reserves, taxable investments,
tax-deferred accounts, and Roth accounts. Market liquidity, withdrawal treatment,
and tax consequences are distinct properties.

Do not encode a blanket prohibition on retirement-account withdrawals before age 60.
The usual early-distribution threshold is 59.5, with account-specific exceptions and
additional-tax rules. Medicare, catch-up contributions, Social Security, pensions,
and RMDs likewise require separate eligibility, election, timing, and calculation
contracts. RMDs are account distributions, not newly created investment income.

Reference starting points, not implemented rule sets:

- [IRS early-distribution rules and exceptions](https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-exceptions-to-tax-on-early-distributions)
- [IRS catch-up contributions](https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-catch-up-contributions)
- [Medicare eligibility and enrollment overview](https://www.medicare.gov/basics/get-started-with-medicare)
- [IRS required minimum distribution FAQs](https://www.irs.gov/retirement-plans/retirement-plan-and-ira-required-minimum-distributions-faqs)

Start by refining the household timeline and phase-editor flow. User-entered pension,
Social Security, and healthcare amounts can serve as explicit assumptions before
automated rule calculations exist. Clearly disclose that an aggregate projection does
not validate account access, taxes, contribution eligibility, or bridge funding.

Phase-value inheritance is approved: carry settings forward and edit only changes.
An explicit zero replaces a prior instruction; an omitted override inherits it.
The preview identifies each setting's source account default or named phase.
The first financial contract now defines boundary-month ordering, nominal payment
anniversary increases, fixed nominal phase spending, surplus deposits, and selected
account routing. Goal measurement, automatic spending escalation, and tax-aware
distribution policies remain open.

### Optional account detail and iterative planning

The planner must allow users to list individual accounts, including savings, 401(k),
IRA, and Roth accounts, with account-specific growth and compounding assumptions.
Detailed plans should expose where distributions come from. Account detail is optional:
a simpler aggregate model should remain available, with its funding and tax limitations
clearly disclosed. Both modes should use the same calculation foundations.

Keep account identity and ownership separate from account type, tax treatment,
investment assumptions, and intended use. A retirement-account label does not determine
its investments or expected return. Distinguish traditional and Roth IRA treatment
and traditional and Roth portions of workplace plans instead of using an ambiguous
Roth label. Taxable brokerage accounts and cash reserves also support bridge planning.
Use account nicknames, not account numbers, in the worksheet.

Rate entry needs an explicit convention. An effective annual return or APY already
includes compounding; a nominal annual interest rate requires a compounding frequency.
Do not apply frequency as an additional return multiplier. Monthly planning periods,
interest accrual, and interest-crediting dates are different concepts. Any conversion
to the existing monthly engine must disclose its approximation rather than claim to
reproduce daily bank statements. Investment return assumptions are not promised interest.
The first runner uses equivalent monthly accrual, not actual bank crediting dates.

Accounts should persist across phases rather than be copied into a new balance at every
transition. Proposed phase overrides would change future contributions, distributions,
or assumptions while retaining account history and ownership. Retirement income and
spending should remain separate from the account transfers used to fund them.

The plan should support repeated editing and comparison of alternatives. Recommended
interactions include duplicating a scenario, changing a phase or account assumption,
recalculating, and inspecting both household and account-level differences. Editing
must invalidate stale results; a calculation must not overwrite the plan assumptions.
Saving, revision history, import, and export still require an explicit private-storage
decision and are not implemented by the current in-memory worksheets.

The implemented editor includes household setup, optional partner ages, aggregate or
detailed account types, effective or nominal rate assumptions, and ordered age-based
phase changes. Plans can be duplicated and switched without altering the original.
All edits are held in memory only. Account and phase removal requires confirmation.
The proportional timeline and tables preview dates, both ages, and inherited instructions,
while the separate Projection report shows account growth, spending coverage,
depletion events, and money-over-time charts. Neither validates tax treatment or
legal eligibility. The existing growth comparison remains a separate calculator.

The usability pass uses years plus optional additional months for the household
duration, bottom-of-form Next actions, and validation within Schedule preview.
Validation issues identify their editing tabs and remain visible until corrected.
Account and phase removal opens a focused confirmation dialog. Numbered phases
connect the timeline to a single boundary table rather than a duplicated text list.

The approved income milestone adds separate Social Security and pension streams,
not IRA accounts with artificial balances. Each recipient has an independent start
age, nominal monthly amount at first payment, and optional annual increase assumption.
The first increase is after 12 payment months, then on each start anniversary.
No official COLA, tax treatment, benefit eligibility, or survivor change is inferred.

The user chose ordered automatic withdrawals for spending gaps and a chosen cash
account for surplus income. Account contributions remain additional savings from
outside the model, such as work income already budgeted for savings. Enter only
the spending these assets and benefit streams need to fund; no full salary budget
is required. Phase overrides support spending changes and withdrawal-order changes,
including an empty order during an accumulation-only phase.

Reports show balance/growth charts by account or household, income versus spending,
phase boundary balances, depletion events, and annual/monthly ledgers. Money can be
shown in nominal or today's dollars using one global inflation clock. The initial
example leaves income and spending at zero until the user supplies assumptions.
Plan copies support iteration; side-by-side phased-plan comparison remains future work.

Detailed results should show contributions, growth, fees, distributions, transfers,
and ending balances by account, with reconciled household totals. Moving money between
household accounts must not create wealth or external income. Distribution routing,
shortfall handling, and unsupported tax or eligibility assumptions must be visible.
Future contribution-limit rules may span multiple accounts; do not assume each account
has an independent allowance.

Potential standalone calculators within the phased planner include account growth,
savings needed to reach a goal, bridge-reserve requirements, and withdrawal-source
comparisons. Extract engines when their independent questions, contracts, and tests
are defined; do not create empty modules merely to populate a future catalog.

## Missing or underrepresented capabilities

### A household cash-flow and account model

Income, essential and discretionary spending, debts, emergency reserves, account types,
cost basis, contributions, employer matches, and contribution limits connect otherwise
isolated calculators. A reusable period-by-period cash-flow ledger can support taxes,
withdrawals, and scenario comparison without duplicating financial logic.

### Retirement income and transitions

Consider Social Security claiming, pensions, part-time work, required minimum
distributions, Roth conversions, household or survivor scenarios, and pre-Medicare
health coverage. These are candidate modules; their rules require explicit requirements
and authoritative references before implementation.

### Risk beyond an average return

Inflation, fees, longevity, market shocks, sequence-of-returns risk, and unexpected
expenses can change the result even when average returns look similar.
Start with deterministic stress cases. Historical replay and seeded simulations
can follow once assumptions and data provenance are specified.

### Goals, milestones, and plan maintenance

Represent a goal with its target, timing, funding source, constraints, and review cadence.
Connect a milestone to measurable progress, an action checklist, and explicit triggers
for revisiting the plan. Execution means user-reviewed guidance and task tracking,
not autonomous trading, account transfers, benefit elections, or tax filing.

### Trust and explainability

Every projection should expose its assumptions, cash flows, calculation version,
rule-set version, data dates, and limitations. Distinguish missing information from zero.
Reject unsupported jurisdiction/year combinations instead of silently using a nearby rule.
Future years without published rules need clearly labeled projection assumptions,
not fabricated legal certainty.

## What makes a scenario better

There should not be a single unexplained score. Compare outcomes against the user's
stated goals and constraints:

- Sustainable after-tax spending and timing of potential shortfalls
- Retirement timing and lifestyle trade-offs
- Ending assets in both nominal and inflation-adjusted terms
- Estimated taxes, healthcare costs, and available liquidity
- Sensitivity to adverse returns, inflation, and longevity assumptions
- Plan complexity, flexibility, and the actions required to maintain it

Make conflicting objectives visible. Use the same calculation engine and assumptions
for comparable scenarios. Uncertainty metrics are conditional on the chosen model,
not guarantees of real-world success.

## Valuable AI surfaces

Prefer contextual assistance next to assumptions and results over a chat box expected
to know everything.

| Surface              | Useful interaction                                               | Required boundary                                                                           |
| -------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Assumption interview | Identify missing inputs and explain unfamiliar planning concepts | Do not invent values or require personal identifiers                                        |
| Scenario editor      | Translate a request into proposed structured changes             | Show a before/after diff and require approval before applying                               |
| Results explainer    | Explain why two scenarios differ                                 | Reference deterministic outputs, periods, and assumptions                                   |
| Research assistant   | Summarize source material, fees, exposures, and risks            | Cite sources and dates; distinguish verified facts from interpretation                      |
| Rule navigator       | Find relevant tax or Medicare documentation                      | Identify jurisdiction, effective year, and uncertainty; do not author tax rules from memory |
| Plan coach           | Draft checklists and review reminders tied to goals              | Suggest actions for review; never execute financial transactions                            |
| Consistency review   | Flag contradictory or missing assumptions                        | Show the evidence and let the user decide how to resolve it                                 |

The calculation engine remains authoritative for arithmetic and rule application.
AI may request a calculation through a validated contract, but generated prose must
not replace it. The core planning workflow should remain usable without AI.

Recommended first AI slice, after deterministic scenarios work: explain an existing
comparison and propose one editable scenario change. This provides a bounded,
testable interaction without giving AI authority over financial decisions.

No model, provider, hosting platform, or AI data-retention policy has been selected.
Provider access requires an explicit privacy and backend decision; never ship credentials
in the Vite client.

## Proposed delivery sequence

### Portfolio, tax, and stress-testing priorities

The account and transfer workflow is ready for the next scope discussion. The
following requested capabilities are recorded for planning, not implemented tax
rules or approved simulation assumptions. Instruction and flow refinements can
follow the user's review without blocking the next engine design.

- Build a reusable, headless portfolio and estimated-tax engine that can power a
  standalone portfolio calculator and feed the retirement planner.
- Compare multiple brokerage accounts and stock/bond allocations across accounts,
  with asset-type assumptions for price growth, dividend or interest yield, and
  qualified versus ordinary dividend proportions. Offer an account-level estimate
  using dividend-paying stock exposure and yield before requiring detailed holdings.
- Define whether yield is quoted on the dividend-paying slice or the whole account.
  Separate price appreciation from distributions so total returns are not counted twice.
  Treat bond interest separately from stock dividends.
- Track dividends when paid, including when reinvested. Let users choose reinvestment
  or routing dividend cash toward spending; income must not be counted again as a
  transfer. Reinvested distributions increase investment cost basis.
- Track starting cost basis, purchases, sales, and realized gains separately from
  unrealized appreciation. Compare calendar-based and allocation-drift rebalancing,
  showing turnover, estimated taxes, and after-tax balances. Agree on cost-basis
  methodology and holding-period simplifications before implementing sale taxation.
- Begin with clearly labeled tax estimates if selected: user-entered ordinary-income
  and qualified-dividend/long-term-gain rates, with explicit exclusions and cash
  payment timing. A year-specific U.S. tax-rule engine remains a separate option
  requiring authoritative sources, filing assumptions, and boundary tests.
- Add an educational asset-comparison calculator for growth assumptions, yield,
  beta, volatility, valuation, and business fundamentals where relevant. Explain
  metric definitions, benchmark and measurement periods, and limitations rather than
  promising to identify strong companies or bargains. Beta is benchmark-relative,
  not an expected-return estimate or a complete risk measure.
- Start asset comparisons with manual, dated assumptions unless a data source is
  selected. Research market-data coverage, licensing, adjusted prices, missing values,
  and provenance before adding imports or live lookup.
- Add retirement stress scenarios with downturns, recoveries, and different return
  sequences. Compare cash reserve and stock/bond mixes using shortfalls, forced sales,
  drawdowns, and sustainable spending, not just ending wealth.
- Keep expected return separate from volatility, asset correlation, and stress-path
  assumptions. Higher assumed growth alone must not determine risk. Begin with
  explicit, reproducible paths; a later stochastic engine should use documented
  distributions, fixed seeds for comparison, and conditional outcome summaries.

The first portfolio slice now implements the agreed return decomposition, dividend
cash routing, pooled-basis approximation, and entered-rate tax boundary. Detailed
asset research and stochastic simulation can follow without coupling data providers
or random paths to the core accounting model.

### Approved first portfolio-tax slice

The implemented first deliverable is a reusable portfolio calculator with entered tax
rates, rather than a household tax-return engine or an immediate retirement-planner
extension. The following choices are approved:

- Use pooled cost basis per asset, with one entered capital-gains tax rate and no
  short-term/long-term holding-period split. This is a planning approximation, not
  a claim that pooled basis is an allowed tax-reporting election for every holding.
- Pay estimated taxes from portfolio cash. Do not automatically sell more assets
  to cover a tax shortage. Expose unpaid amounts rather than treating them as paid.
- Offset realized gains with losses within the same calendar year, with year-end
  settlement. Do not carry losses to later years or deduct them from ordinary income.

Implementation boundaries for the first slice include separate price-growth and
distribution-yield assumptions, ordinary versus qualified distribution tax rates,
stock and bond asset types, retained-cash versus reinvestment choices, and explicit
rebalancing policies. Each modeled account is estimated separately; cross-account
tax netting and a complete household tax calculation remain excluded. Final partial
calendar years need an explicitly labeled settlement so ending estimates do not omit
taxes merely because the horizon ends before December.

The standalone Portfolio & taxes worksheet now supports multiple additive brokerage
holdings, stock/bond allocations, cash contributions, no/December/drift rebalancing,
and account/asset/calendar ledgers. Held distributions and external contributions
deploy at the next rebalance; cash otherwise remains available for tax, not spending.
Reports distinguish gross assets from equity after unpaid assessed tax.
The pure engine is versioned `portfolio-1.0.0`; its
[accounting contract](architecture.md#implemented-portfolio-tax-contract) documents
timing, cent rounding, settlement, and exclusions.

Live data acquisition, asset-selection rankings, retirement-spending integration,
and stochastic simulations are subsequent capabilities, not implied by this approval.

### Milestone outline

| Phase | Deliverable                                                                                   | Exit condition                                                                  |
| ----- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1     | Deterministic growth, contributions, withdrawals, fees, inflation, and side-by-side scenarios | Agreed examples and boundary cases pass; each balance is explainable            |
| 2     | Account-aware retirement cash flows and goals                                                 | Income, spending, milestones, and shortfalls reconcile across the plan          |
| 3     | Versioned tax and healthcare rule modules                                                     | Supported jurisdictions and years have authoritative sources and boundary tests |
| 4     | Allocation policy comparison, portfolio research, and uncertainty analysis                    | Data provenance, licensing, policy costs, and reproducibility are validated     |
| 5     | Optional AI explanation and scenario editing                                                  | Numeric faithfulness, source grounding, consent, and approval tests pass        |

Phase 1 is approved with the [monthly engine contract](growth-engine.md). The remaining
delivery order is a recommendation, not a commitment. Introduce life phases after
milestone one so goals, investment allocations, spending, and priorities can change
through a plan. These life phases are distinct from software delivery phases.
Phase 1 does not claim to produce a complete after-tax retirement plan.

## Documentation to build with each feature

- User questions, supported cases, and explicit exclusions
- Formula and cash-flow timing specification with worked synthetic examples
- Input/output contract, units, rounding policy, and invalid-input behavior
- Rule sources, effective dates, jurisdiction coverage, and review history
- Architectural decisions and data contracts
- Test matrix and documented limitations
- Component usage and accessibility examples

The current [Medicare cost overview](https://www.medicare.gov/basics/costs/medicare-costs)
illustrates why coverage and service choices belong in the model. It is a starting
point for requirements research, not a complete implementation specification.
No current tax brackets, benefit amounts, or Medicare thresholds are encoded here.

See the [test-first proposal](test-strategy.md) and [privacy policy](privacy.md).
