---
title: Application architecture
description: Dependency direction and separation between financial rules, feature models, views, and reusable UI.
---

## Responsibilities

| Layer                   | Owns                                                      | May depend on                                   |
| ----------------------- | --------------------------------------------------------- | ----------------------------------------------- |
| `app`                   | Provider composition, application state, feature assembly | Public feature entries, public UI, domain       |
| `features/<name>/model` | Use cases, view-model hooks, parsing and orchestration    | Domain, React, its own model modules            |
| `features/<name>/ui`    | Rendering prepared data and callbacks                     | Public UI, its own view components, model types |
| `design-system`         | Styling, accessibility, UI variants, icons, themes        | React, Fluent, other design-system modules      |
| `domain`                | Financial calculations, validation rules, value types     | Other domain modules only                       |

The current `foundation` feature has no business model. The app owns its preview state.
The `growth` feature owns worksheet state, input parsing, and presentation formatting
in `model/`. Its container connects that model to a stateless view, and the model calls
the independent `domain/growth` engine. Do not create placeholder services,
repositories, global stores, or routing before their requirements exist.

## Engines and worksheets

A calculator engine accepts an explicit, validated input contract and returns structured
results or errors. It has no dependency on worksheets, React, persistence, browser APIs,
or AI providers. Its outputs include the assumptions and calculation version needed to
explain results.

Worksheets help assemble inputs and inspect outputs. They do not own formulas.
Future CLI, server, batch, or AI-tool adapters must call the same engine rather than
reimplement financial behavior. AI can suggest scenarios and explain results, but
deterministic code remains authoritative. See the [growth-engine contract](growth-engine.md).

Changing life phases belongs in a later orchestration model with explicit transition
rules. Version one has fixed cash flows and assumptions throughout the projection;
it does not pretend that a single unchanging scenario models a complete life plan.

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
