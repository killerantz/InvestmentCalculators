---
title: Investment and retirement planning discovery
description: Generic product goals, candidate capabilities, AI interaction opportunities, and a proposed delivery sequence.
---

## Status and scope

Milestone one is approved: a headless monthly growth and cash-flow engine with annual
summaries and two-scenario worksheets. Its contract is recorded in
[growth-engine.md](growth-engine.md). Remaining capabilities are exploratory.
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
