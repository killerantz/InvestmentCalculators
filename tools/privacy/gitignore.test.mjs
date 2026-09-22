import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { ESLint } from 'eslint'

const cwd = fileURLToPath(new URL('../../', import.meta.url))

function ignoredPaths(paths) {
  const result = spawnSync(
    'git',
    ['check-ignore', '--no-index', '--stdin', '-z'],
    { cwd, input: `${paths.join('\0')}\0`, encoding: 'utf8' },
  )
  assert.ifError(result.error)
  assert.ok(
    result.status === 0 || result.status === 1,
    `git check-ignore failed: ${result.stderr}`,
  )
  return result.stdout.split('\0').filter(Boolean)
}

test('secret and personal storage paths are ignored at root and nested locations', () => {
  const paths = [
    '.env',
    '.env.local',
    '.env.production',
    '.env.production.local',
    '.env.backup',
    'service/.env',
    'service/.env.local',
    'service/.env.example',
    'settings.env',
    '.envrc',
    '.direnv/state.json',
    'secrets/provider.json',
    'service/.secrets/provider.json',
    'credentials/private.pem',
    'credentials/private.key',
    'credentials/certificate.p12',
    'credentials/certificate.pfx',
    'credentials/store.jks',
    'credentials/store.keystore',
    'id_rsa',
    'id_ed25519',
    '.netrc',
    '_netrc',
    '.pypirc',
    '.local/scenarios/example.json',
    '.local/exports/example.csv',
    'service/.local/example.json',
    'local-data/example.json',
    'personal-data/example.xlsx',
    'private-data/example.pdf',
    'notes.private.md',
    'scenario.personal.json',
    'settings.local',
    'scenario.db',
    'scenario.db-wal',
    'scenario.db-shm',
    'scenario.db-journal',
    'scenario.db3',
    'scenario.sqlite',
    'scenario.sqlite-wal',
    'scenario.sqlite3',
    'scenario.sqlite3-shm',
    'database.dump',
    'playwright/.auth/session.json',
    'session.har',
    'coverage/index.html',
    'playwright-report/index.html',
    'test-results/screenshot.png',
    '.copilot-tracking/notes.md',
    'logs/session.log',
  ]
  assert.deepEqual(ignoredPaths(paths), paths)
})

test('public examples, source, fixtures, and shared configuration remain trackable', () => {
  const paths = [
    '.env.example',
    '.gitignore',
    '.npmrc',
    'package.json',
    'package-lock.json',
    '.github/workflows/ci.yml',
    '.vscode/tasks.json',
    '.vscode/settings.json',
    '.vscode/extensions.json',
    'src/app/App.tsx',
    'src/domain/taxes.ts',
    'src/storage/index.ts',
    'src/domain/fixtures/synthetic-scenario.json',
    'src/domain/fixtures/synthetic-returns.csv',
    'docs/product-discovery.md',
    'docs/privacy.md',
    'public/favicon.svg',
    'tools/privacy/gitignore.test.mjs',
  ]
  assert.deepEqual(ignoredPaths(paths), [])
})

test('lint excludes local personal code and generated reports', async () => {
  const eslint = new ESLint({ cwd })
  for (const filename of [
    '.local/analysis.ts',
    'service/local-data/analysis.ts',
    'personal-data/analysis.ts',
    'private-data/analysis.ts',
    '.secrets/config.js',
    'secrets/config.js',
    '.auth/session.js',
    '.direnv/config.js',
    'notes.private.ts',
    'notes.personal.ts',
    '.copilot-tracking/analysis.ts',
    'coverage/report.js',
    'playwright-report/report.js',
    'test-results/report.js',
  ]) {
    assert.equal(await eslint.isPathIgnored(filename), true, filename)
  }
  assert.equal(await eslint.isPathIgnored('src/app/App.tsx'), false)
})
