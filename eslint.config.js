import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import architecture from './tools/eslint/architecture.mjs'

export default defineConfig(
  globalIgnores([
    'dist',
    'node_modules',
    '**/.local/**',
    '**/local-data/**',
    '**/personal-data/**',
    '**/private-data/**',
    '**/secrets/**',
    '**/.secrets/**',
    '**/.auth/**',
    '**/.direnv/**',
    '**/*.private.*',
    '**/*.personal.*',
    '.copilot-tracking',
    'coverage',
    'playwright-report',
    'test-results',
  ]),
  {
    files: ['**/*.{js,mjs}'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    plugins: { architecture },
    rules: {
      'architecture/boundaries': 'error',
      'architecture/token-styles': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'ImportDeclaration[source.value=/^@fluentui\\//] ImportNamespaceSpecifier',
          message: 'Use named Fluent imports to keep bundles tree-shakable.',
        },
        {
          selector:
            'ImportSpecifier[imported.name=/^(makeResetStyles|makeStaticStyles|shorthands)$/]',
          message:
            'Use token-checked makeStyles objects for component styling.',
        },
      ],
    },
  },
)
