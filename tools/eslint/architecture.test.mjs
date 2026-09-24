import path from 'node:path'
import { describe, it } from 'node:test'
import { RuleTester } from 'eslint'
import tseslint from 'typescript-eslint'
import { boundaries, tokenStyles } from './architecture.mjs'

RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})
const file = (name) => path.resolve(name)
const view = file('src/features/example/ui/Page.tsx')
const design = file('src/design-system/Example.tsx')
const domain = file('src/domain/calculate.ts')
const boundaryError = { messageId: 'boundary' }

tester.run('boundaries', boundaries, {
  valid: [
    {
      filename: file('src/features/example/model/useExample.ts'),
      code: "import { formatMoney } from '../../../shared/numbers'",
    },
    { filename: view, code: "import { Button } from '@ui'" },
    { filename: view, code: "import type { Result } from '../model/types'" },
    { filename: view, code: "import type { ReactNode } from 'react'" },
    { filename: domain, code: "import { round } from './round'" },
    {
      filename: file('src/domain/growth/growth.test.ts'),
      code: "import { expect } from 'vitest'",
    },
    {
      filename: design,
      code: "import { tokens } from '@fluentui/react-components'",
    },
    {
      filename: design,
      code: "import { LineChart } from '@fluentui/react-charts'",
    },
    {
      filename: file('src/app/App.tsx'),
      code: "import { Example } from '@features/example'",
    },
    {
      filename: file('src/features/example/model/useExample.ts'),
      code: "import { calculate } from '@domain/calculate'",
    },
  ],
  invalid: [
    {
      filename: view,
      code: "import { formatMoney } from '../../../shared/numbers'",
      errors: [boundaryError],
    },
    {
      filename: file('src/shared/numbers.ts'),
      code: "import { Example } from '@features/example'",
      errors: [boundaryError],
    },
    {
      filename: file('src/shared/numbers.ts'),
      code: "import { useState } from 'react'",
      errors: [boundaryError],
    },
    {
      filename: view,
      code: "import { LineChart } from '@fluentui/react-charts'",
      errors: [boundaryError],
    },
    {
      filename: domain,
      code: "import { LineChart } from '@fluentui/react-charts'",
      errors: [boundaryError],
    },
    {
      filename: file('src/features/example/model/useExample.ts'),
      code: "import { LineChart } from '@fluentui/react-charts'",
      errors: [boundaryError],
    },
    {
      filename: domain,
      code: "import { expect } from 'vitest'",
      errors: [boundaryError],
    },
    {
      filename: view,
      code: "import { Button } from '@fluentui/react-components'",
      errors: [boundaryError],
    },
    {
      filename: view,
      code: "import { tokens } from '../../../design-system/theme/tokens'",
      errors: [boundaryError],
    },
    {
      filename: view,
      code: "import { x } from '@domain/calculate'",
      errors: [boundaryError],
    },
    {
      filename: view,
      code: "import { x } from '../model/useExample'",
      errors: [boundaryError],
    },
    {
      filename: view,
      code: "import { useState } from 'react'",
      errors: [boundaryError],
    },
    {
      filename: view,
      code: "import { x } from '@features/other'",
      errors: [boundaryError],
    },
    {
      filename: view,
      code: "export { x } from '@fluentui/react-icons'",
      errors: [boundaryError],
    },
    {
      filename: view,
      code: "export * from '@fluentui/react-components'",
      errors: [boundaryError],
    },
    {
      filename: view,
      code: "import('@fluentui/react-icons')",
      errors: [boundaryError],
    },
    {
      filename: view,
      code: 'import(name)',
      errors: [{ messageId: 'dynamic' }],
    },
    {
      filename: view,
      code: "require('@fluentui/react-icons')",
      errors: [boundaryError],
    },
    { filename: view, code: "import './page.css'", errors: [boundaryError] },
    {
      filename: view,
      code: 'const x = <div />',
      errors: [{ messageId: 'styles' }],
    },
    {
      filename: view,
      code: 'const x = <Button className="red" />',
      errors: [{ messageId: 'styles' }],
    },
    {
      filename: design,
      code: 'const x = <div style={{ color: "red" }} />',
      errors: [{ messageId: 'styles' }],
    },
    {
      filename: domain,
      code: "import { useState } from 'react'",
      errors: [boundaryError],
    },
    {
      filename: design,
      code: "import { x } from '@domain/calculate'",
      errors: [boundaryError],
    },
    {
      filename: file('src/app/App.tsx'),
      code: "import { Example } from '@features/example/ui/Page'",
      errors: [boundaryError],
    },
  ],
})

const imports = `
  import { makeStyles, tokens } from '@fluentui/react-components'
  import { appTokens } from './theme/tokens'
`
tester.run('token-styles', tokenStyles, {
  valid: [
    `${imports} makeStyles({ root: { display: 'grid', alignContent: 'start' } })`,
    `${imports} makeStyles({ root: { color: tokens.colorNeutralForeground1, padding: tokens.spacingHorizontalM, maxWidth: appTokens.contentWidth, display: 'flex', margin: 0 } })`,
    `${imports} makeStyles({ root: { ':hover': { color: tokens.colorBrandForeground1 } } })`,
    "import { makeStyles as styles, tokens as t } from '@fluentui/react-components'; styles({ root: { color: t.colorNeutralForeground1 } })",
  ],
  invalid: [
    {
      code: `${imports} makeStyles({ root: { color: '#fff' } })`,
      errors: [{ messageId: 'token' }],
    },
    {
      code: `${imports} makeStyles({ root: { padding: '16px' } })`,
      errors: [{ messageId: 'token' }],
    },
    {
      code: `${imports} makeStyles({ root: { fontSize: 14 } })`,
      errors: [{ messageId: 'token' }],
    },
    {
      code: `${imports} makeStyles({ root: { ':hover': { color: 'red' } } })`,
      errors: [{ messageId: 'token' }],
    },
    {
      code: `${imports} makeStyles({ root: { color: customColor } })`,
      errors: [{ messageId: 'token' }],
    },
    {
      code: `${imports} makeStyles({ root: { ...customStyles } })`,
      errors: [{ messageId: 'object' }],
    },
    {
      code: `${imports} makeStyles(customStyles)`,
      errors: [{ messageId: 'object' }],
    },
  ],
})
