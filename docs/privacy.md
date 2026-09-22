---
title: Public-repository privacy
description: Rules for keeping secrets and personal financial data out of source control, builds, and shared artifacts.
---

## Public content

The repository describes general investment and retirement use cases. Documentation,
tests, fixtures, examples, screenshots, issue reports, and pull requests must use
invented data that cannot identify a real person or household.

Do not commit personal account identifiers, balances, holdings, transactions, dates of
birth, tax returns, benefit statements, provider credentials, personal goals, or account
exports. Removing a name from a real financial record does not make it synthetic.

## Local storage conventions

Prefer a private location outside the repository and its build context. No runtime
persistence mechanism is implemented or selected yet.

If local working files must be kept in the workspace, `.local/` is the designated
ignored scratch directory. For example:

```text
.local/
  imports/
  scenarios/
  exports/
  notes/
```

These are conventions, not pre-created directories or an implemented storage API.
The ignore rules also cover `local-data/`, `personal-data/`, `private-data/`, files
named `*.private.*` or `*.personal.*`, and common local database formats and journals.
Ordinary JSON and CSV files are deliberately not ignored globally so synthetic
fixtures can be reviewed and committed.

Do not place real data in `src/`, `public/`, fixtures, or documentation. Vite can ship
imported source data and public assets even when Git ignores them. Ignored directories
are not encrypted, access-controlled, or automatically excluded from every hosting,
backup, development-server, editor, or AI tool.

Review an AI tool's file-access behavior before opening personal files in the workspace.
An ignored file is not automatically excluded from an assistant's context.

## Environment files and secrets

Only the root `.env.example` is intended for source control. It contains explanations
and, when needed, fake placeholders only. `.env`, `.env.*`, `*.env`, `.envrc`, and
local environment directories are ignored, including nested environment files.

Keep credentials in a secret manager or a future server-side environment. Never put
secrets in `VITE_*` variables: Vite exposes these to browser clients. An ignored
environment file does not make its bundled values private. Keep the committed
`.npmrc` free of registry authentication tokens.

Common key containers, `secrets/`, `.secrets/`, browser authentication state, HAR
recordings, and generated test reports are ignored. A secret under an arbitrary
filename can still be committed; file patterns are not content scanning.

## Before publishing

1. Use synthetic data in all examples and captures.
2. Review the staged file list and diff locally.
3. Confirm private paths are ignored with `git check-ignore -v -- .local/example.json`.
4. Run `npm run test:privacy` to check the ignore policy.
5. Review generated build and deployment inputs separately from the Git diff.
6. Enable GitHub secret scanning and push protection where available.

Secret scanning and push protection are recommendations, not configured by this change.
They do not reliably detect personal financial information.

Git ignore rules do not affect already tracked files and can be bypassed with a
force-add. If a credential is exposed, revoke or rotate it immediately. Removing a file
in a later commit does not remove it from history, forks, caches, or downloaded artifacts.
Coordinate any history cleanup separately rather than assuming the ignore file repairs it.

## Future application privacy requirements

- Choose browser-local, encrypted file, or hosted persistence before implementing saves.
- Define data export, deletion, retention, backup, and recovery behavior.
- Keep personal values out of URLs, analytics, console logs, errors, and shared links.
- Require explicit approval before sending selected scenario data to an AI provider.
- Send the minimum necessary data and explain what leaves the device.
- Review provider retention and training terms before enabling AI features.
- Keep provider credentials server-side; do not add browser API keys as a shortcut.

Browser-local storage is not a security guarantee. Same-origin scripts and people with
access to the browser profile may be able to read it. Encryption and access-control
requirements must follow an explicit threat model, not an assumption that local means safe.
