---
title: Test-first planning strategy
description: Proposed verification approach for deterministic financial models, versioned rules, UI behavior, and optional AI.
---

## Recommendation

Use test-first development for financial behavior. Agree on the financial specification
and independently worked synthetic examples, write failing tests, implement the smallest
correct domain function, then connect it to the view model and UI.

A green test suite proves conformance to the tested specification, not that the
specification is financially or legally correct. Review formulas and rule sources
separately. Do not generate expected outputs with the same implementation under test.

The growth milestone follows this approach: domain and worksheet parsing tests were
written before their implementations and run in Vitest's Node environment.
Architecture and privacy-ignore regression checks also run in CI. The remaining
layers below are a strategy for future work, not a claim of existing test coverage.

The comparison refinement adds test-first contracts for signed and undefined
percentage differences, numeric overflow, per-month inflation-adjusted growth,
chart starting points and cumulative values, independent inflation assumptions,
column visibility, partial years, and the 1,200-month horizon. Existing nominal
ledger reconciliation tests remain in place. UI interaction and theme checks are
browser smoke tests, not a maintained end-to-end suite.

## Specify before implementing

For each calculator, decide:

- Period length, date conventions, and event ordering
- Beginning- versus end-of-period contributions and withdrawals
- Effective versus nominal rates and compounding frequency
- Whether values are nominal or inflation-adjusted
- Fee treatment, precision, rounding stages, and monetary representation
- Treatment of depleted balances, unmet withdrawals, and invalid inputs
- Account categories, jurisdiction, applicable year, and supported rule versions

Do not silently pick these conventions in UI event handlers.

## Verification layers

| Layer                | Tests to write first                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| Pure calculations    | Hand-worked examples, zero rates, zero periods, losses, large inputs, invalid inputs                          |
| Cash-flow ledger     | Opening balance plus ordered cash flows and growth reconciles to closing balance                              |
| Withdrawals          | Timing, depletion, unmet spending, and policy changes at period boundaries                                    |
| Tax modules          | Threshold boundaries, filing statuses, basis treatment, jurisdiction/year selection, unsupported combinations |
| Medicare modules     | Supported eligibility/enrollment cases, premium boundaries, relevant income years, rule-version selection     |
| Scenario comparison  | Identical inputs match, changed assumptions are visible, shared baselines use the same engine                 |
| View models          | Parsing, validation messages, domain calls, and explicit error states                                         |
| UI components        | Labels, keyboard operation, validation announcements, light/dark themes, and forced colors                    |
| End-to-end workflows | Create a synthetic scenario, change assumptions, compare results, inspect explanations                        |

Balance reconciliation and invariants are useful property tests. Apply monotonicity
claims only when their assumptions hold: increasing income need not increase net
spending when taxes and benefit rules interact.

For simulations, use recorded seeds, defined return-generation assumptions, and shared
random paths for comparable scenarios where appropriate. Test deterministic
reproducibility and model properties without asserting that historical patterns predict
future returns.

## Rule-data verification

Store public rule tables separately from personal scenario inputs. Every supported
rule version needs an authoritative citation, applicability dates, review date, and
boundary cases. Test adjacent values around thresholds using the specified rounding
rules. Changing a rule table is a behavioral change that needs review.

Expired or missing rule coverage must produce an explicit limitation. A projection
assumption for a future year must never be labeled as a published future rule.

## Optional AI evaluation

Before exposing AI features, create a synthetic evaluation set covering:

- Numeric statements agree with calculation outputs and units
- Explanations identify the assumptions responsible for differences
- References support the claim and match the applicable jurisdiction/year
- Missing information leads to a question or stated limitation, not invented facts
- Proposed edits are schema-valid, bounded, visible, and require confirmation
- Untrusted research content cannot authorize tools or override application policy
- Personal data is not transmitted without informed approval
- Provider failure leaves deterministic planning available

Use deterministic checks for numbers, schemas, and tool permissions. Human review
remains necessary for misleading framing and advice quality. An LLM judging its own
output is not sufficient evidence of correctness.

## Candidate tooling and release gates

Vitest covers the growth engine and worksheet input boundary. React Testing Library
remains a candidate for component behavior, and Playwright for repeatable complete
flows and theme screenshots. Browser smoke checks do not replace a maintained
end-to-end suite. Introduce additional tools with their actual tests, not as unused scaffolding.

Gate changes on the worked examples, rule boundary cases, relevant regressions,
typecheck, lint, accessibility checks, and production build. Set coverage targets
after identifying critical paths; coverage percentages do not establish financial accuracy.
