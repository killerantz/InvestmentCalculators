---
title: Design-system conventions
description: Token layering, Fluent UI extension practices, icon compatibility, and browser acceptance checks.
---

## Token layers

1. The palette in [index.html](../index.html) defines the `--cp-*` primitives for light
   and dark modes and sets the initial canvas before React loads.
2. [themes.ts](../src/design-system/theme/themes.ts) maps that palette to Fluent semantic
   roles. Components consume `tokens.colorNeutralForeground1`, not palette values.
3. [tokens.ts](../src/design-system/theme/tokens.ts) defines app-specific layout values
   that Fluent does not provide, such as content width.
4. Design-system components use semantic Fluent tokens and `appTokens` through Griffel
   `makeStyles`. Consumers have no styling API.

The initial theme uses warm neutrals and a rose accent. Change palette values to rebrand,
semantic mappings to change the meaning of a role, and component variants to change
reusable behavior. Do not edit features to retheme the application.

Fluent light and dark base themes supply unmodified tokens. The overrides cover the
current component inventory, not every control in Fluent's catalog. Before exposing
a new control, audit its normal, hover, pressed, selected, disabled, and focus tokens
in both modes; extend the mapping for any remaining default brand colors. Keep
Windows forced-colors support intact rather than replacing system focus styles.

## Styling policy

Use Fluent tokens for color, spacing, typography, shape, strokes, and shadows.
Add product-level dimensions only in `theme/tokens.ts`; do not create local magic numbers.
The token lint rule accepts token references and a narrow list of structural CSS
values such as `display: 'flex'`, `width: '100%'`, and zero resets.
It rejects literal visual values, indirect style objects, and style spreads.
Grid column templates may interpolate layout tokens.

No inline `style` props, feature CSS files, consumer `className`, or direct Fluent imports.
Keep global styling limited to the initial palette and body reset in the HTML entry.
Styles live alongside their design-system components. If two components need the same
layout, reuse `Stack`, `Row`, or `Grid` instead of copying declarations.

This is a collaboration policy, not a security boundary. Lint does not prove arbitrary
CSS expressions safe or prevent all JavaScript-based styling escapes. New styling
mechanisms require review and updates to the policy tests.

## Extending Fluent UI

Wrap selectively, not exhaustively. Own a component when it defines an application
convention, a stable variant, or an accessibility contract. Reuse Fluent's interactive
behavior instead of implementing buttons, selects, focus rings, or keyboard support
from scratch.

Expose explicit props with `Pick` or small domain-neutral interfaces. Avoid exposing
all Fluent props and slots: that would reintroduce `style`, `className`, and arbitrary
rendering escapes. Public APIs currently have no styling overrides. Prop types and lint
are the contract, not runtime sanitization of untyped input.

Use callbacks and render composition instead of business-specific props. Keep the public
entry curated. Add a component example to the foundation preview when adding a reusable
pattern. Extract to a workspace package only when another consumer or independent
release lifecycle justifies it.

## Worksheet primitives

The growth worksheet exercises `NumberField`, `ChoiceField`, `Notice`, and `DataTable`.
These components own labels, error presentation, keyboard behavior, semantic table
markup, and token-based styling. They contain no financial parsing or formulas.
`NumberField` passes text to its caller so unfinished input is not silently coerced to zero.

Tables expose captions and column headers, and scroll inside a labeled focusable region
on narrow screens. The feature model provides formatted strings; the UI does not
round money or assemble annual summaries. Monthly ledgers show one projection year
at a time rather than rendering an entire long-horizon monthly history.

App navigation keeps the worksheet mounted in `ViewPanel` while the foundation preview
is visible. Drafts survive that navigation but are not persisted across reloads.

## Comparison primitives

`SelectionControl` exposes a labeled group of mutually exclusive toggle buttons,
with pressed states rather than tab semantics without associated tab panels.
`Tabs` wraps Fluent's tab list and links each tab to its own panel. It owns keyboard
navigation, selected-state semantics, and a token-based selected background alongside
Fluent's active indicator. The yearly/monthly ledgers use this pattern; chart settings
remain selection groups. Only the selected panel's content is mounted, so keep state
that must survive tab changes in the feature model.
`CheckboxField` exposes a labeled boolean choice. `YearNavigator` combines a
whole-year slider with an exact input and Previous, Next, and Go icon buttons on one
nonwrapping row. The input is sized for three digits and accepts at most three
characters; the reusable navigator supports maxima from 1 to 999 and rejects larger
bounds. The worksheet retains its existing 100-year execution limit. Field labels,
help text, and validation messages remain outside the compact row.
These components manage presentation interactions, not projection or financial rules.

`ComparisonChart` wraps React-19-compatible `@fluentui/react-charts` v9.
Only the design system may import that package. Its public API accepts labels,
numeric points, and a value formatter, not Fluent styling props or financial inputs.
Chart colors, dimensions, and line treatments belong to the design-system tokens.
The two series use distinct line treatments as well as labels; color alone is not
the identifier. The chart implementation loads lazily with a visible loading state.
The worksheet supplies an optional exact-data table as an accessible alternative.
An error boundary isolates chart-load or rendering failures, logs the error, and
shows an alert without removing the surrounding financial tables.

Fluent Charts 9.3.26 renders an unkeyed fragment for singleton series. The wrapper
uses a keyed SVG point plot for that case, preserving coordinates, token styling,
legends, and accessible tooltips without inventing another data point. Multi-point
comparisons use Fluent's line chart. Revisit this compatibility path during upgrades.

Keep page layout dimensions on the provider's inner layout wrapper, not on
`FluentProvider` itself: Fluent propagates provider classes to portal roots.
Viewport-height styling on those roots can turn a closed tooltip into an invisible
overlay that blocks unrelated controls. Portal colors and fonts still come from
the provider theme.

Do not compute growth, deltas, inflation adjustments, or annual groups in chart
components. The engine supplies financial values; the feature model builds cumulative
series and formatted table rows. The foundation preview exercises these primitives
using synthetic non-financial values.

## Icons

Use [Icon.tsx](../src/design-system/Icon.tsx) as the icon registry.
The full Fluent System Icons collection is available in the dependency; the application
ships only explicitly imported icons. Add a semantic name and named Regular/Filled imports
to expose another icon. Use `bundleIcon` to switch variants with the `filled` prop.

The project uses v2 SVG icons, with explicit 24px variants. Do not add font registration,
legacy MDL2 packages, namespace imports, or dynamic catalog lookups. Avoid Color variants
because their multicolor fills complicate contrast and forced-colors support.

Icons are decorative and hidden from assistive technology. Pair them with visible text,
or use `IconButton`, which requires an accessible label and supplies a matching tooltip.
Year navigation uses curated previous, next, and enter-arrow icons. Disabled icons
use the disabled foreground token. Test icon-button names, keyboard activation,
disabled boundaries, and tooltip behavior when adding new uses.

## Appearance behavior

Appearance defaults to the operating system and updates when the system preference changes.
Choosing light or dark overrides it for the current page session. The optional
`?clawpilotTheme=light` or `?clawpilotTheme=dark` query sets the initial selection.
An unrecognized query value falls back to the system preference when React initializes.
Preferences are not persisted; persistence is a future product decision.

## Browser smoke check

- Verify the page and icon SVGs render without console errors.
- Toggle light, dark, and system appearance, including a live OS-preference change.
- Toggle filled icons and verify the pressed state matches the rendered variant.
- Check primary, disabled, focus, hover, and selected control states.
- Tab through the skip link, appearance selector, and enabled button.
- Confirm the skip link moves focus to the main landmark.
- Check 375px and desktop widths plus 200% zoom for overflow and clipping.
- Review contrast and Windows forced-colors behavior when expanding the component set.
- Calculate the synthetic scenarios and inspect annual and monthly ledger values.
- Submit invalid fields and verify labeled errors and the error announcement.
- Change an assumption and verify old results disappear until recalculation.
- Switch to UI foundations and back; verify in-memory worksheet inputs are retained.
- Switch the chart measure and dollar basis; verify matching exact-data values.
- Inspect a negative-growth path and a zero-month projection.
- Switch ledger interval and optional columns without changing the calculation.
- Test year navigation by slider, keyboard, exact entry, and previous/next buttons.
- Check one-year, partial-final-year, and 100-year horizons, including invalid year input.
- Verify line and text contrast in both themes and distinguish the series without color.

Passing this smoke check is not a full WCAG audit. Automated accessibility checks and
assistive-technology testing belong in the feature test strategy.

## References

- [Fluent React v9 documentation](https://react.fluentui.dev/)
- [Fluent System Icons React usage](https://github.com/microsoft/fluentui-system-icons/tree/main/packages/react-icons)
- [React documentation](https://react.dev/)
- [Vite documentation](https://vite.dev/)
