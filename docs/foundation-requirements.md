---
title: Foundation requirements
description: Accepted foundation scope, acceptance criteria, and decisions deferred to feature planning.
---

## Accepted scope

- React, Vite, strict TypeScript, and npm in a single application repository
- Current stable React and compatible Fluent UI React v9 with System Icons v2
- An internal design system that can later be extracted into a package
- Centralized tokens, theme variants, and reusable styles
- Composition-only views separated from domain rules and orchestration
- A responsive foundation preview, local developer tasks, formatting, lint, and CI
- A public repository containing only generic documentation and synthetic examples
- Ignored secrets, environment files, personal working data, and generated browser artifacts

## Confirmed planning scope

Initial planning rules target the United States, with explicit jurisdiction and rule-year
versions. State-specific support must be declared, not inferred from federal support.
The first growth-and-scenario milestone is approved; see the
[engine contract](growth-engine.md), [product discovery](product-discovery.md), and
[test-first strategy](test-strategy.md). Later calculators and delivery order remain exploratory.
No personal financial details are required to define the product.

## Acceptance criteria

| Requirement                                            | Evidence                                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Dependencies install without compatibility workarounds | `npm ci` succeeds without force or legacy-peer flags                         |
| Production app compiles                                | Strict typecheck and `npm run build` pass                                    |
| Token and layer policies are executable                | `npm run lint` and `npm run test:architecture` pass                          |
| Consumers cannot style around shared primitives        | No feature-native markup, style props, class names, or direct Fluent imports |
| Retheming is isolated                                  | All preview components change through the root provider and shared palette   |
| Icons work with the chosen React version               | Regular and Filled SVG variants render and toggle in the browser             |
| Layout is usable on narrow screens                     | No horizontal overflow at 375px and 200% desktop zoom                        |
| Basic semantics and keyboard navigation work           | One main landmark, ordered headings, labels, skip link, visible focus        |
| Financial scope remains separate                       | Formulas live in a headless domain engine; views contain no financial logic  |

## Next requirements conversation

Before implementing later calculators, decide:

- Which calculators and user workflows are first
- Authoritative formulas, compounding conventions, and contribution timing
- Number precision, rounding, currency, units, locale, and inflation assumptions
- Validation rules and accessible error presentation
- Data persistence, shareable scenarios, and privacy expectations
- Navigation, supported browsers, and accessibility targets
- Domain example cases, interaction tests, coverage thresholds, and visual regression strategy

Do not infer financial behavior from UI layout. State management libraries, routing,
Storybook, API infrastructure, deployment hosting, and a full browser test stack remain deferred.
The growth milestone has Vitest domain and model coverage in addition to the guardrail checks.
