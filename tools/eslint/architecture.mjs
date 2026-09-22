import path from 'node:path'

const normalize = (value) => value.replaceAll('\\', '/')
const sourceRoot = 'src/'

function resolveSource(source, filename, cwd) {
  if (source === '@ui') return 'src/design-system/index'
  const aliases = {
    '@app/': 'src/app/',
    '@domain/': 'src/domain/',
    '@features/': 'src/features/',
  }
  for (const [alias, target] of Object.entries(aliases)) {
    if (source.startsWith(alias)) return target + source.slice(alias.length)
  }
  if (source.startsWith('.')) {
    return normalize(
      path.relative(cwd, path.resolve(path.dirname(filename), source)),
    )
  }
  return source
}

const featureName = (file) => file.match(/^src\/features\/([^/]+)(?:\/|$)/)?.[1]
const isPublicEntry = (file, folder) =>
  file === folder ||
  new RegExp(`^${folder}/index(?:\\.[cm]?[jt]sx?)?$`).test(file)

export const boundaries = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      boundary: 'Import violates the architecture boundary: {{reason}}.',
      styles:
        'Compose @ui components; style and native-element ownership belongs to the design system.',
      dynamic:
        'Use a static import path so dependency boundaries can be checked.',
    },
  },
  create(context) {
    const cwd = context.cwd
    const filename = context.filename
    const file = normalize(path.relative(cwd, filename))
    if (!file.startsWith(sourceRoot)) return {}
    const inDesignSystem = file.startsWith('src/design-system/')
    const inDomain = file.startsWith('src/domain/')
    const feature = featureName(file)
    const inView = Boolean(feature && file.includes('/ui/'))

    function check(node, source) {
      if (typeof source !== 'string') {
        context.report({ node, messageId: 'dynamic' })
        return
      }
      const target = resolveSource(source, filename, cwd)
      if (file.endsWith('.test.ts') && target === 'vitest') return
      const typeOnly =
        node.importKind === 'type' ||
        node.exportKind === 'type' ||
        (node.specifiers?.length > 0 &&
          node.specifiers.every((specifier) => specifier.importKind === 'type'))
      let reason
      if (/\.(css|scss|sass|less)(?:\?|$)/.test(source)) {
        reason =
          'global resets and palette belong in index.html; component styles use Griffel'
      } else if (inDomain && !target.startsWith('src/domain/')) {
        reason = 'domain modules may depend only on other domain modules'
      } else if (inDesignSystem) {
        if (
          !target.startsWith('src/design-system/') &&
          ![
            'react',
            '@fluentui/react-charts',
            '@fluentui/react-components',
            '@fluentui/react-icons',
          ].includes(target)
        ) {
          reason =
            'the design system cannot depend on app, feature, or domain code'
        }
      } else if (
        target.startsWith('src/design-system/') &&
        !isPublicEntry(target, 'src/design-system')
      ) {
        reason = 'use the @ui public entry, not design-system internals'
      } else if (feature && target.startsWith('src/app/')) {
        reason = 'features cannot import the application composition root'
      } else if (
        feature &&
        featureName(target) &&
        featureName(target) !== feature
      ) {
        reason = 'features cannot import other features; compose them in app'
      } else if (inView && target.startsWith('src/domain/')) {
        reason =
          'views receive prepared values and callbacks; call domain logic from the feature model'
      } else if (
        inView &&
        target.startsWith(`src/features/${feature}/`) &&
        !target.startsWith(`src/features/${feature}/ui/`) &&
        !typeOnly
      ) {
        reason = 'views may import model types, not model implementations'
      } else if (
        feature &&
        !inView &&
        file.includes('/model/') &&
        (target.includes('/ui/') || target.startsWith('src/design-system/')) &&
        !typeOnly
      ) {
        reason =
          'feature models must not depend on presentation implementations'
      } else if (
        !feature &&
        featureName(target) &&
        !isPublicEntry(target, `src/features/${featureName(target)}`)
      ) {
        reason = 'app imports features through their public index'
      } else if (!target.startsWith(sourceRoot)) {
        const allowed =
          (target === 'react' && (!inView || typeOnly)) ||
          (target === 'react-dom/client' && file === 'src/main.tsx')
        if (!allowed)
          reason = 'external dependencies require an explicit layer policy'
      }
      if (reason)
        context.report({ node, messageId: 'boundary', data: { reason } })
    }

    return {
      ImportDeclaration: (node) => check(node, node.source.value),
      ExportNamedDeclaration: (node) => {
        if (node.source) check(node, node.source.value)
      },
      ExportAllDeclaration: (node) => check(node, node.source.value),
      ImportExpression: (node) => check(node, node.source.value),
      CallExpression: (node) => {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'require'
        ) {
          check(node, node.arguments[0]?.value)
        }
      },
      JSXOpeningElement(node) {
        if (
          !inDesignSystem &&
          node.name.type === 'JSXIdentifier' &&
          /^[a-z]/.test(node.name.name)
        ) {
          context.report({ node, messageId: 'styles' })
        }
      },
      JSXAttribute(node) {
        if (
          node.name.name === 'style' ||
          (!inDesignSystem && node.name.name === 'className')
        ) {
          context.report({ node, messageId: 'styles' })
        }
      },
    }
  },
}

const structuralValues = {
  display: ['flex', 'grid', 'block', 'inline', 'inline-flex', 'none'],
  gridTemplateColumns: ['max-content max-content'],
  boxSizing: ['border-box'],
  flexDirection: ['row', 'column'],
  flexWrap: ['wrap', 'nowrap'],
  alignItems: ['center', 'start', 'end', 'stretch'],
  justifyContent: ['center', 'space-between', 'start', 'end'],
  flexShrink: [0],
  minWidth: [0],
  width: ['100%'],
  margin: [0],
  marginInline: ['auto'],
  position: ['absolute', 'relative', 'sticky'],
  borderStyle: ['solid'],
  borderTopStyle: ['solid'],
  borderRightStyle: ['solid'],
  borderBottomStyle: ['solid'],
  borderLeftStyle: ['solid'],
  overflowWrap: ['anywhere'],
  overflowX: ['auto'],
  borderCollapse: ['collapse'],
  textAlign: ['start'],
  whiteSpace: ['nowrap'],
  transform: ['translateY(-100%)', 'none'],
}

export const tokenStyles = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      token:
        'Use Fluent tokens or appTokens for visual values; keep literal definitions in theme/.',
      object:
        'Define styles as a static object; spreads and indirect values bypass token checks.',
    },
  },
  create(context) {
    const styleFactories = new Set()
    const tokenBindings = new Set()
    function isToken(node) {
      return (
        node?.type === 'MemberExpression' &&
        !node.computed &&
        node.object.type === 'Identifier' &&
        tokenBindings.has(node.object.name)
      )
    }
    function inspect(node) {
      if (node.type !== 'ObjectExpression') {
        context.report({ node, messageId: 'object' })
        return
      }
      for (const property of node.properties) {
        if (property.type !== 'Property') {
          context.report({ node: property, messageId: 'object' })
          continue
        }
        const value = property.value
        const key = property.key.name ?? property.key.value
        if (value.type === 'ObjectExpression') {
          inspect(value)
        } else if (
          !isToken(value) &&
          !(
            value.type === 'Literal' &&
            structuralValues[key]?.includes(value.value)
          ) &&
          !(
            key === 'gridTemplateColumns' &&
            value.type === 'TemplateLiteral' &&
            value.expressions.length > 0 &&
            value.expressions.every(isToken)
          )
        ) {
          context.report({ node: value, messageId: 'token' })
        }
      }
    }
    return {
      ImportDeclaration(node) {
        for (const specifier of node.specifiers) {
          if (specifier.type !== 'ImportSpecifier') continue
          if (node.source.value === '@fluentui/react-components') {
            if (specifier.imported.name === 'makeStyles')
              styleFactories.add(specifier.local.name)
            if (specifier.imported.name === 'tokens')
              tokenBindings.add(specifier.local.name)
          }
          if (
            specifier.imported.name === 'appTokens' &&
            /\/theme\/tokens$/.test(node.source.value)
          ) {
            tokenBindings.add(specifier.local.name)
          }
        }
      },
      CallExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          styleFactories.has(node.callee.name)
        ) {
          if (node.arguments[0]) inspect(node.arguments[0])
        }
      },
    }
  },
}

export default { rules: { boundaries, 'token-styles': tokenStyles } }
