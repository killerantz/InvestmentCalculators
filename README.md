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
  features/
    growth/
      model/               Input parsing, orchestration, result formatting
      ui/                  Scenario worksheet composition
    foundation/
      ui/                  Stateless component composition
      index.ts             Public feature entry
tools/eslint/              Executable architecture and token policies
docs/                     Requirements and contributor guidance
```

The landing page compares two synthetic growth and cash-flow scenarios with monthly
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
personal-data persistence, tax modeling, or life-phase support yet.

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
