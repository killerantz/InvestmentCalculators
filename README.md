---
title: Investment Calculators
description: React and Fluent UI foundation with token-driven components and explicit architecture boundaries.
---

## Start locally

Use Node.js 22.13 or newer in the 22.x line, Node.js 24.x, or Node.js 26+.
npm is the package manager.

```powershell
npm ci
npm run dev
```

Open the URL printed by Vite. VS Code includes `dev`, `build`, and `check` tasks.

## Foundation

| Dependency                    | Pinned version |
| ----------------------------- | -------------- |
| React and React DOM           | 19.3.0         |
| Fluent UI React components    | 9.74.8         |
| Fluent UI React charts        | 9.3.26         |
| Fluent System Icons for React | 2.0.341        |
| Vite                          | 8.3.0          |
| TypeScript                    | 6.0.2          |

These were the stable registry releases verified during setup on 2026-09-22.
Fluent components v9, charts v9, and icons v2 declare React 19 support.
Use `@fluentui/react-components`, not legacy `@fluentui/react` v8 or Northstar.
Do not use `--force` or `--legacy-peer-deps` to hide compatibility problems.
Exact dependency versions and the lockfile make installations reproducible.

## Repository structure

```text
src/
  app/                     Composition, application state, providers
  design-system/           Reusable presentation components; public index.ts
    theme/                 Fluent semantic mapping and product layout tokens
  domain/growth/           Validated headless engine; no React or I/O
  domain/plan/             Household schedule, income and account projections
  domain/portfolio/        Taxable holdings, pooled basis and estimated taxes
  shared/                  Pure numeric parsing and presentation formatting
  features/
    growth/
      model/               Input parsing, orchestration, result formatting
      ui/                  Scenario worksheet composition
    foundation/
      ui/                  Stateless component composition
      index.ts             Public feature entry
    plan/
      model/               In-memory drafts, validation and report presentation
      ui/                  Household, accounts, income, phases and reports
    portfolio/
      model/               Brokerage drafts, engine invocation and reports
      ui/                  Standalone portfolio and entered-tax-rate worksheet
tools/eslint/              Executable architecture and token policies
docs/                     Requirements and contributor guidance
```

The landing page builds an age-based life-phase plan using synthetic examples.
Enter household ages at a planning start month, list accounts, and change their
instructions at age-based phase boundaries. Settings carry forward unless overridden.
Duplicate a plan to edit an alternative without changing the original. The validated
timeline and tables show dates, both ages, and each instruction's source.
Add each person's Social Security and pensions on Income & spending. Enter the
nominal monthly amount at its start age and an optional assumed anniversary increase.
Choose spending, a surplus account, and an automatic withdrawal order; phases can
override spending and the eligible account order. Projection report shows household
and account trends, income versus spending, unmet spending, and yearly/monthly ledgers.
The report includes starting balances and overlays the household total with individual
accounts. Checkboxes show or hide lines independently; the household total always
includes every account. Radio groups choose account balance or growth earned so far,
nominal or today's dollars, and a years (default) or months time axis. Both time views
retain monthly calculation points. Balances start with the entered funds; growth
starts at zero because it excludes starting funds and cash flows and is before fees.
Both projection charts mark phase starts on the time axis. Numbered markers match
a key with each phase's name, calendar start, and elapsed time. A boundary marks
the start of the next monthly period, not its ending balance.
Plan-end ages appear in the household, schedule, and report views. Yearly ledgers
show one starting-age column instead of projection-month counts: primary, then
partner if included. Monthly ledgers use the same column; monthly detail
remains available. Schedule preview combines primary and optional partner ages into
two columns: start ages and end ages. Phase keys and chart tooltips also include ages.
The external-savings breakdown identifies each phase's per-account monthly amount,
source setting, and entire-phase total. These are new-money deposits, not
account-to-account transfers or Roth conversions.
Use Transfers & conversions to name a transfer and choose its source, destination,
starting phase, ending phase, and either fixed monthly dollars or an annual percentage.
Names appear in validation, schedule previews, and reports.
Annual percentages use the source's previous December 31 balance, recalculated each
January. Enter the source account's prior year-end balance on Accounts if the
transfer is active in the plan's first calendar year; later years use projected
December closing balances. If your plan starts before retirement and distributions
begin in a later calendar year, no historical entry is needed. The dated field appears
only when required or when a previously entered value needs to remain accessible.
The reference balance does not add money to the plan.
Each active month requests one-twelfth of the annual target, with cent adjustments
to reconcile a full calendar year. Partial years have no catch-up. Calculation
details show the reference balance, annual target, and actual active-month requests.
This supports RMD-style simulation using your chosen percentage, not IRS divisor
calculations or RMD compliance checks. Use a general transfer to cash or taxable
investments for distributions, not a Roth conversion.
Transfers run from the starting phase through the end of the ending phase, inclusive.
Choose Indefinitely to continue through the plan horizon. Starting in the last phase
disables the ending selector and ends with the plan. Existing entries retain their
single-phase duration until edited. A separate entry never replaces an existing one:
overlapping transfers both run, in displayed priority order. Use transfers for
account-to-account payouts and conversions; keep household spending and automatic
withdrawal order in phase settings. Do not duplicate the same payout as a scheduled
transfer to spending, because both instructions execute.
If a source runs short, only available funds move and the unfilled amount is
reported without carrying it forward. Roth conversions require traditional and
Roth accounts owned by the same person, but do not check legal eligibility.
Optional Tax assumptions estimate their ordinary-income tax; withholding is not
modeled. Reports show money moved and unfilled requests,
with conversions identified as a subset of transfers. Existing external-savings
entries are not automatically changed; correct them separately if they were meant
to represent conversions.
Reported income means Social Security and pensions, not taxable income.
Account contributions remain external, already-budgeted savings rather than modeled
salary. The planner does not automatically infer account-access or benefit rules.

### Optional life-phase tax estimates

Tax assumptions is a separate, opt-in section. Leave it off to preserve the
original cash-flow behavior. Enabling it requires entered ordinary-income,
realized-gain, and qualified-dividend rates; enter an explicit zero if applicable.
Optional per-phase rate changes carry forward until replaced. Disabling taxes
retains the entered drafts, and plan copies keep independent tax assumptions.

Traditional IRA/401(k) withdrawals and Roth conversions are modeled as fully
ordinary taxable income. Same-owner traditional-to-traditional transfers are
assumed tax-free rollovers. Qualified Roth withdrawals are assumed tax-free;
qualification is not checked. Positive savings growth is ordinary interest.
After-tax retirement basis, early-withdrawal penalties, deductions, credits,
brackets, state rules, and contribution deductions are not modeled.

Each brokerage account needs its starting pooled cost basis. Optional dividend
yield and qualified share default to zero. The existing account return is
**total return including reinvested dividends**, unlike the price-only return in
Portfolio & taxes. Dividend estimates use opening balance times annual yield
divided by 12. They add basis and estimated tax, not extra growth or spendable
cash. Brokerage withdrawals and outward transfers sell proportional pooled
basis; only positive realized gains are taxed, with no tax-loss offsets.

Pensions default to fully taxable, with an editable taxable share. Social
Security requires an explicit assumed taxable share from 0 to 85%; the planner
does not calculate it from household income. Income payments are gross amounts
when taxes are enabled. A combined portfolio cannot use one reliable account
tax treatment: split it into individual account types or leave taxes disabled.

Estimated taxes are assessed monthly and funded before spending. The planner
uses available income and scheduled withdrawals first. Extra tax withdrawals
follow the spending withdrawal order by default. Enable **Use a separate
tax-payment order** in Tax assumptions to choose and reorder preferred accounts,
such as savings, brokerage, then 401(k), without changing spending distributions.
If preferred tax accounts run out, tax funding falls back to that phase's spending
withdrawal order. Accounts selected only for taxes never cover spending shortfalls.
Both paths include the extra tax on withdrawals needed to fund the tax bill.
At a 20% rate,
$1,000 of spending funded entirely from a traditional IRA requires $1,250 gross.
With sufficient savings selected separately for taxes, the same plan withdraws
$1,000 from the IRA and $200 from savings instead.

Each phase can inherit its tax-payment setting, use a separate order, or resume
following the spending order. That choice carries forward until replaced. An
empty preferred list uses only the spending-order fallback; it does not turn off
tax payments. Separate withdrawals round tax per transaction, so cent-level
differences from combined funding are possible.
Unpaid taxes carry forward; unfunded spending still does not become debt.
Reports show tax assessed, tax paid, unpaid liability, brokerage basis, and
account balances less remaining unpaid tax. Ending unrealized gains are not
automatically liquidated or taxed. Annual tax reports group projection years,
not tax-return years; no filing or payment deadlines are simulated.

The Growth comparison page compares two synthetic growth and cash-flow scenarios with monthly
calculations, dollar/percentage differences, a shared balance/growth chart, and
switchable yearly/monthly ledgers. Monthly navigation combines a slider, exact year
entry, and previous/next controls. Optional ledger columns expose cash flows, fees,
and today's-dollar values without changing nominal calculation units. The chart
has its own nominal/today's-dollar switch and an exact-data table.
The engine is independent
of the worksheet and can be consumed headlessly. Use the UI foundations button to inspect
the reusable component preview.

Rates are assumptions, not forecasts. Calculations round to cents and approximate fee
timing. See the [calculation contract](docs/growth-engine.md) before interpreting results.
Inputs stay in page memory only; reloading clears them. There is no AI integration,
personal-data persistence, household tax-return modeling, benefit eligibility, or
automatic account-access rules.

## Portfolio and estimated taxes

Open Portfolio & taxes for the standalone taxable-brokerage calculator. Add brokerage
accounts and stock/bond assets with starting market value, pooled cost basis, and
target allocations. Multiple accounts are holdings added together, not alternative
scenarios. Targets total 100% of investments, excluding account cash.

Use the Duplicate/Remove action bars at the bottom of each account or asset block.
Duplicates appear immediately after the original with a "copy" name and independent
editable values. Account copies include all assets and settings. Asset copies preserve
amounts and target weights; adjust weights to total 100% before calculating. Account
copies are still included in combined holdings totals, not treated as alternate plans.

Enter annual price growth separately from dividend or interest yield; do not use a
total-return rate for price growth. Stocks split dividends into qualified and ordinary
shares; bonds pay ordinary interest. Set your own ordinary-income, qualified-dividend,
and realized-gain tax rates. These are estimates, not tax brackets or a tax return.

Choose no rebalancing, December rebalancing, or monthly-checked allocation drift.
Between rebalances, reinvest after-tax distributions or hold them in cash until the
next rebalance. A separate Invest new cash choice defaults new accounts to investing
starting cash and monthly external contributions by target allocation at month-end,
after taxes. Choose Hold until a rebalance to keep the previous cash behavior.
New-cash purchases do not sell existing holdings or count as rebalances.
First-month starting cash earns investment returns only after its month-end purchase.
Every rebalance uses all remaining cash for target-deficit purchases,
including held distributions. Cash earns no interest and does not fund retirement
spending in this version.

Use the information buttons beside portfolio inputs and summary measures for
plain-language explanations and examples. They support click, touch, and keyboard.
Threshold rebalancing checks monthly but does not trade automatically each month.
A single investment with a 100% target never drifts because cash is excluded.

The chart defaults to one named line per account. Choose total value after assessed
taxes, invested assets, uninvested cash, or gross assets. Switch to All holdings
combined to see their sum. Chart controls are independent of the detailed-ledger
account and year selectors. Changing the chart does not recalculate the projection.

Distribution taxes are assessed monthly. Sales remove proportional pooled basis,
and realized losses offset gains within the same account and calendar year.
Estimated net-gain taxes settle in December and in the final projection month,
including a partial year. Available cash pays taxes before purchases; no additional
assets are sold solely to cover tax. Unpaid amounts remain visible liabilities.

Reports separate invested assets, cash, gross assets, pooled basis, and equity.
Equity is gross assets minus unpaid assessed taxes, not an after-liquidation value.
Inspect account and combined calendar-year/monthly ledgers, asset-level sales and
basis, and rebalance/tax-shortage events. Edits clear results until you calculate again.

For a synthetic one-month example, $1,000 with zero price growth, 12% annual yield,
and a 50% qualified share produces $5 qualified and $5 ordinary dividends. At 10%
and 20% respective tax rates, tax is $1.50 and $8.50 remains to reinvest or hold.
Ending gross assets and equity are $1,008.50.

The [portfolio accounting contract](docs/architecture.md#implemented-portfolio-tax-contract)
describes the reusable engine. Limits include one realized-gain rate, no tax lots
or holding-period split, no cross-account loss netting, no loss carryforward, and
no tax on unrealized ending gains. Pre-start year-to-date activity and existing
tax liabilities are not inputs. Live data, retirement-plan integration, and market
stress simulation remain future work.

## Validate changes

```powershell
npm run check
npm run build
```

`check` runs lint, architecture-policy and privacy-ignore regression checks, financial
engine and worksheet-model tests in Vitest, strict
TypeScript validation, and formatting checks. CI runs it and a production build on pushes and pull requests.
Use `npm run format` to apply formatting. `npm run preview` serves the production build.

## Public repository and private data

Keep documentation, examples, fixtures, screenshots, and issues generic and synthetic.
Never commit account details, holdings, financial statements, personal plans, or credentials.
Prefer personal storage outside the repository. If an in-workspace scratch area is needed,
use the ignored `.local/` directory, never `src/` or `public/`.

The [.env.example](.env.example) contains comments only; no environment variables are
currently required. Local environment files are ignored. `VITE_*` variables are public
browser configuration, not a place for secrets.

Git ignores reduce accidental commits; they do not protect tracked files, prevent
force-adds, remove Git history, or stop files from being served or bundled.
See the [privacy policy](docs/privacy.md) for storage conventions and review steps.

## Guides

- [Foundation requirements](docs/foundation-requirements.md)
- [Architecture and responsibility boundaries](docs/architecture.md)
- [Design-system and theming conventions](docs/design-system.md)
- [Product discovery and proposed scope](docs/product-discovery.md)
- [Growth-engine contract and headless use](docs/growth-engine.md)
- [Test-first strategy](docs/test-strategy.md)
- [Public-repository privacy policy](docs/privacy.md)

## Upgrades

Check stable versions and peer dependencies before upgrading React, Fluent components,
or Fluent icons. Some tooling packages publish prereleases under their `latest` tag;
inspect the version string rather than blindly installing that tag. Upgrade in a
dedicated change, regenerate the lockfile, and run all checks plus the browser smoke
check in the design-system guide.
