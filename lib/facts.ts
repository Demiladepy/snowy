// Deterministic facts extraction: JS/TS source + package.json -> Facts.
// No LLM involved. Everything the rule engine knows about the user's code comes from here.

import {parse} from '@babel/parser'
import type * as t from '@babel/types'
import type {ApiVersionFact, CallSiteKind, ClientFacts, Facts, ValueFact} from './types'

const DATE_RE = /^v?(\d{4}-\d{2}-\d{2})$/

type Node = t.Node

/** Normalize an apiVersion literal. `v2024-01-01` and `2024-01-01` are the same version. */
export function normalizeApiVersion(raw: string): ApiVersionFact {
  const s = raw.trim()
  const m = DATE_RE.exec(s)
  if (m) return {kind: 'date', value: m[1]}
  if (s === '1' || s === 'v1') return {kind: 'v1'}
  if (s === 'X' || s === 'vX') return {kind: 'vX'}
  return {kind: 'dynamic', expression: JSON.stringify(raw), source: 'expression'}
}

/** Generic AST walk (avoids a dependency on @babel/traverse). */
function walk(node: unknown, visit: (n: Node) => void): void {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit)
    return
  }
  const n = node as Node
  if (typeof n.type !== 'string') return
  visit(n)
  for (const key of Object.keys(n)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key.endsWith('Comments')) continue
    walk((n as unknown as Record<string, unknown>)[key], visit)
  }
}

function line(n: Node): number {
  return n.loc?.start.line ?? 0
}

function sourceOf(code: string, n: Node): string {
  if (n.start == null || n.end == null) return '<expression>'
  const s = code.slice(n.start, n.end)
  return s.length > 80 ? s.slice(0, 77) + '...' : s
}

function propKey(p: t.ObjectProperty | t.ObjectMethod): string | undefined {
  if (p.computed) return undefined
  if (p.key.type === 'Identifier') return p.key.name
  if (p.key.type === 'StringLiteral') return p.key.value
  return undefined
}

function isProcessEnv(n: Node): boolean {
  // process.env.X or process.env['X'] or import.meta.env.X
  if (n.type !== 'MemberExpression') return false
  const obj = n.object
  if (obj.type !== 'MemberExpression') return false
  const base = obj.object
  const prop = obj.property
  const isEnvProp = prop.type === 'Identifier' && prop.name === 'env'
  if (!isEnvProp) return false
  return (base.type === 'Identifier' && base.name === 'process') || base.type === 'MetaProperty'
}

function isDateExpression(code: string, n: Node): boolean {
  return /\bnew\s+Date\b|\bDate\.now\b|toISOString/.test(sourceOf(code, n))
}

/** Per-file analysis context: top-level consts we can resolve, and known client variables. */
interface Ctx {
  code: string
  consts: Map<string, Node>
  importedNames: Set<string>
}

function resolve(ctx: Ctx, n: Node, depth = 0): Node {
  if (depth > 5) return n
  if (n.type === 'Identifier' && ctx.consts.has(n.name)) return resolve(ctx, ctx.consts.get(n.name)!, depth + 1)
  if (n.type === 'TSAsExpression' || n.type === 'TSSatisfiesExpression' || n.type === 'TSNonNullExpression') {
    return resolve(ctx, n.expression, depth + 1)
  }
  return n
}

function stringLiteralValue(ctx: Ctx, n: Node): string | undefined {
  const r = resolve(ctx, n)
  if (r.type === 'StringLiteral') return r.value
  if (r.type === 'TemplateLiteral' && r.expressions.length === 0) return r.quasis[0]?.value.cooked ?? undefined
  return undefined
}

function apiVersionFromNode(ctx: Ctx, n: Node): ApiVersionFact {
  const r = resolve(ctx, n)
  const lit = stringLiteralValue(ctx, r)
  if (lit !== undefined) return normalizeApiVersion(lit)
  // `process.env.X || '2024-01-01'` / `?? '2024-01-01'`: the fallback is what runs when the env var is unset.
  if (r.type === 'LogicalExpression' && (r.operator === '||' || r.operator === '??')) {
    const fallback = stringLiteralValue(ctx, r.right)
    if (fallback !== undefined) {
      const norm = normalizeApiVersion(fallback)
      if (norm.kind === 'date') return {...norm, viaFallback: sourceOf(ctx.code, r.left)}
    }
  }
  if (isDateExpression(ctx.code, r)) return {kind: 'dynamic', expression: sourceOf(ctx.code, r), source: 'date'}
  if (isProcessEnv(r)) return {kind: 'dynamic', expression: sourceOf(ctx.code, r), source: 'env'}
  if (r.type === 'Identifier' && r.name === 'undefined') return {kind: 'dynamic', expression: 'undefined', source: 'undefined'}
  return {kind: 'dynamic', expression: sourceOf(ctx.code, r), source: 'expression'}
}

function perspectiveFromNode(ctx: Ctx, n: Node): ValueFact<string | string[]> {
  const r = resolve(ctx, n)
  const lit = stringLiteralValue(ctx, r)
  if (lit !== undefined) return {kind: 'literal', value: lit}
  if (r.type === 'ArrayExpression') {
    const items = r.elements.map((e) => (e ? stringLiteralValue(ctx, e) : undefined))
    if (items.every((i): i is string => i !== undefined)) return {kind: 'literal', value: items}
  }
  return {kind: 'dynamic', expression: sourceOf(ctx.code, r)}
}

function booleanFromNode(ctx: Ctx, n: Node): ValueFact<boolean> {
  const r = resolve(ctx, n)
  if (r.type === 'BooleanLiteral') return {kind: 'literal', value: r.value}
  return {kind: 'dynamic', expression: sourceOf(ctx.code, r)}
}

function tokenFromNode(ctx: Ctx, n: Node): ClientFacts['token'] {
  const r = resolve(ctx, n)
  const lit = stringLiteralValue(ctx, r)
  if (lit !== undefined) return lit.length > 0 ? {present: true, source: 'literal'} : {present: false}
  if (r.type === 'Identifier' && r.name === 'undefined') return {present: false}
  if (r.type === 'NullLiteral') return {present: false}
  if (isProcessEnv(r)) return {present: true, source: 'env'}
  // `process.env.TOKEN || undefined`, `cond ? token : undefined`, etc: a token can be sent.
  return {present: true, source: 'expression'}
}

/** Collect the properties of an object literal, following same-file spreads. */
function collectProps(ctx: Ctx, obj: t.ObjectExpression, out: Map<string, Node>, unresolvedSpread: {value: boolean}, depth = 0) {
  for (const p of obj.properties) {
    if (p.type === 'SpreadElement') {
      const r = resolve(ctx, p.argument)
      if (r.type === 'ObjectExpression' && depth < 4) collectProps(ctx, r, out, unresolvedSpread, depth + 1)
      else unresolvedSpread.value = true
      continue
    }
    if (p.type !== 'ObjectProperty') continue
    const key = propKey(p)
    if (!key) continue
    // Shorthand `{apiVersion}` -> value is the identifier, resolved later.
    out.set(key, p.value as Node)
  }
}

function clientFromObject(
  ctx: Ctx,
  obj: t.ObjectExpression | undefined,
  callSite: CallSiteKind,
  lineNo: number,
  base?: ClientFacts,
): ClientFacts {
  const props = new Map<string, Node>()
  const spread = {value: false}
  if (obj) collectProps(ctx, obj, props, spread)

  // An unresolved spread (e.g. `...config` imported from another file) could set any key.
  const unknown = (key: string): ValueFact<never> => ({kind: 'dynamic', expression: `...spread (${key})`})

  const apiVersion: ApiVersionFact = props.has('apiVersion')
    ? apiVersionFromNode(ctx, props.get('apiVersion')!)
    : base
      ? base.apiVersion
      : spread.value
        ? {kind: 'dynamic', expression: '...spread (apiVersion)', source: 'expression'}
        : {kind: 'missing'}

  const perspective: ClientFacts['perspective'] = props.has('perspective')
    ? perspectiveFromNode(ctx, props.get('perspective')!)
    : base
      ? base.perspective
      : spread.value
        ? unknown('perspective')
        : {kind: 'unset'}

  const useCdn: ClientFacts['useCdn'] = props.has('useCdn')
    ? booleanFromNode(ctx, props.get('useCdn')!)
    : base
      ? base.useCdn
      : spread.value
        ? unknown('useCdn')
        : {kind: 'unset'}

  const token: ClientFacts['token'] = props.has('token')
    ? tokenFromNode(ctx, props.get('token')!)
    : base
      ? base.token
      : {present: false}

  return {callSite, line: lineNo, apiVersion, perspective, token, useCdn}
}

/**
 * What `x.withConfig()` inherits from: `const client = createClient({...})` in the same file,
 * or a chained `createClient(...)` / `useClient(...)` / `x.withConfig(...)` call.
 */
function baseClient(ctx: Ctx, object: Node, depth = 0): ClientFacts | undefined {
  const init = resolve(ctx, object)
  if (init.type !== 'CallExpression' || depth > 4) return undefined
  const {name, member} = calleeName(init.callee as Node)
  const arg = init.arguments[0] ? resolve(ctx, init.arguments[0] as Node) : undefined
  const obj = arg?.type === 'ObjectExpression' ? arg : undefined
  if (name === 'createClient' || member === 'createClient') return clientFromObject(ctx, obj, 'createClient', line(init))
  if (name === 'useClient') {
    return {...clientFromObject(ctx, obj, 'useClient', line(init)), token: {present: true, source: 'expression'}}
  }
  if (member === 'withConfig' && init.callee.type === 'MemberExpression') {
    return clientFromObject(ctx, obj, 'withConfig', line(init), baseClient(ctx, init.callee.object as Node, depth + 1))
  }
  return undefined
}

function calleeName(callee: Node): {name?: string; member?: string; objectName?: string} {
  if (callee.type === 'Identifier') return {name: callee.name}
  if (callee.type === 'MemberExpression' && !callee.computed && callee.property.type === 'Identifier') {
    const objectName = callee.object.type === 'Identifier' ? callee.object.name : undefined
    return {member: callee.property.name, objectName}
  }
  return {}
}

function templateText(tpl: t.TemplateLiteral): string {
  // Join quasis; interpolations become a placeholder so the query shape is preserved.
  return tpl.quasis.map((q) => q.value.cooked ?? q.value.raw).join('${…}')
}

function queryTextFromNode(ctx: Ctx, n: Node): string | undefined {
  const r = resolve(ctx, n)
  if (r.type === 'StringLiteral') return r.value
  if (r.type === 'TemplateLiteral') return templateText(r)
  if (r.type === 'TaggedTemplateExpression') return templateText(r.quasi)
  if (r.type === 'CallExpression' && r.callee.type === 'Identifier' && r.callee.name === 'defineQuery' && r.arguments[0]) {
    return queryTextFromNode(ctx, r.arguments[0] as Node)
  }
  return undefined
}

function objectLiteralToJson(ctx: Ctx, obj: t.ObjectExpression): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const p of obj.properties) {
    if (p.type !== 'ObjectProperty') continue
    const key = propKey(p)
    if (!key) continue
    const v = resolve(ctx, p.value as Node)
    if (v.type === 'BooleanLiteral' || v.type === 'StringLiteral' || v.type === 'NumericLiteral') out[key] = v.value
    else out[key] = '<expression>'
  }
  return out
}

export function extractCodeFacts(code: string): Omit<Facts, 'packages'> {
  const facts: Omit<Facts, 'packages'> = {clients: [], callSites: [], queries: [], listenCalls: [], parseErrors: []}
  if (!code.trim()) return facts

  let ast: t.File
  try {
    ast = parse(code, {
      sourceType: 'unambiguous',
      plugins: ['typescript', 'jsx'],
      errorRecovery: true,
    }) as unknown as t.File
  } catch (err) {
    facts.parseErrors.push((err as Error).message)
    return facts
  }
  for (const e of (ast as unknown as {errors?: {message: string}[]}).errors ?? []) facts.parseErrors.push(e.message)

  const ctx: Ctx = {code, consts: new Map(), importedNames: new Set()}

  // Pass 1: collect const declarations (any scope; names in config files are rarely shadowed).
  walk(ast.program, (n) => {
    if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.init) {
      ctx.consts.set(n.id.name, n.init)
    }
    if (n.type === 'ImportSpecifier' || n.type === 'ImportDefaultSpecifier') ctx.importedNames.add(n.local.name)
  })

  const queryLines = new Set<string>()
  const addQuery = (text: string, lineNo: number) => {
    const key = `${lineNo}:${text}`
    if (queryLines.has(key)) return
    queryLines.add(key)
    facts.queries.push({text, line: lineNo})
  }

  // Pass 2: find calls, in source order.
  walk(ast.program, (n) => {
    if (n.type === 'TaggedTemplateExpression' && n.tag.type === 'Identifier' && n.tag.name === 'groq') {
      addQuery(templateText(n.quasi), line(n))
      return
    }
    if (n.type !== 'CallExpression') return
    const {name, member} = calleeName(n.callee as Node)
    const firstArg = n.arguments[0] as Node | undefined
    const firstObj = firstArg ? resolve(ctx, firstArg) : undefined
    const objArg = firstObj?.type === 'ObjectExpression' ? firstObj : undefined

    if (name === 'createClient' || member === 'createClient') {
      const client = clientFromObject(ctx, objArg, 'createClient', line(n))
      facts.clients.push(client)
      facts.callSites.push({kind: 'createClient', line: line(n)})
      return
    }
    if (member === 'withConfig') {
      const base = n.callee.type === 'MemberExpression' ? baseClient(ctx, n.callee.object as Node) : undefined
      facts.clients.push(clientFromObject(ctx, objArg, 'withConfig', line(n), base))
      facts.callSites.push({kind: 'withConfig', line: line(n)})
      return
    }
    if (name === 'useClient') {
      // Studio's useClient returns the user's authenticated client.
      const c = clientFromObject(ctx, objArg, 'useClient', line(n))
      facts.clients.push({...c, token: {present: true, source: 'expression'}})
      facts.callSites.push({kind: 'useClient', line: line(n)})
      return
    }
    if (name === 'defineLive') {
      facts.callSites.push({kind: 'defineLive', line: line(n)})
      return
    }
    if (member === 'listen') {
      facts.callSites.push({kind: 'listen', line: line(n)})
      if (firstArg) {
        const q = queryTextFromNode(ctx, firstArg)
        if (q !== undefined) addQuery(q, line(n))
      }
      const optsNode = n.arguments[2] ? resolve(ctx, n.arguments[2] as Node) : undefined
      const options = optsNode?.type === 'ObjectExpression' ? objectLiteralToJson(ctx, optsNode) : {}
      facts.listenCalls.push({line: line(n), options})
      return
    }
    if (member === 'fetch' || name === 'sanityFetch' || member === 'sanityFetch') {
      facts.callSites.push({kind: 'fetch', line: line(n)})
      // client.fetch(query, ...) or sanityFetch({query, ...})
      if (firstArg) {
        const q = queryTextFromNode(ctx, firstArg)
        if (q !== undefined) addQuery(q, line(n))
        else if (objArg) {
          const qp = objArg.properties.find((p) => p.type === 'ObjectProperty' && propKey(p) === 'query') as t.ObjectProperty | undefined
          const qt = qp ? queryTextFromNode(ctx, qp.value as Node) : undefined
          if (qt !== undefined) addQuery(qt, line(n))
        }
      }
      return
    }
    if (name === 'defineQuery' && firstArg) {
      const q = queryTextFromNode(ctx, firstArg)
      if (q !== undefined) addQuery(q, line(n))
    }
  })

  return facts
}

const TRACKED_PACKAGES = ['@sanity/client', 'next-sanity', 'sanity', '@sanity/preview-kit', '@sanity/react-loader']

export function extractPackageFacts(packageJson: string): {packages: Record<string, string>; error?: string} {
  if (!packageJson.trim()) return {packages: {}}
  try {
    const pkg = JSON.parse(packageJson) as Record<string, Record<string, string> | undefined>
    const all = {...pkg.devDependencies, ...pkg.peerDependencies, ...pkg.dependencies}
    const packages: Record<string, string> = {}
    for (const name of TRACKED_PACKAGES) if (all[name]) packages[name] = all[name]
    return {packages}
  } catch (err) {
    return {packages: {}, error: `package.json: ${(err as Error).message}`}
  }
}

/** Extra queries pasted separately (one per blank-line-separated block, or as JS). */
export function extractQueryFacts(queries: string): {text: string; line: number}[] {
  if (!queries.trim()) return []
  // If it looks like JS, parse it; otherwise treat each blank-line-separated block as a raw GROQ query.
  if (/\b(groq|defineQuery|const|export)\b/.test(queries)) return extractCodeFacts(queries).queries
  let lineNo = 1
  const out: {text: string; line: number}[] = []
  for (const block of queries.split(/\n\s*\n/)) {
    if (block.trim()) out.push({text: block.trim(), line: lineNo})
    lineNo += block.split('\n').length + 1
  }
  return out
}

export function extractFacts(input: {code: string; packageJson?: string; queries?: string}): Facts {
  const code = extractCodeFacts(input.code)
  const pkg = extractPackageFacts(input.packageJson ?? '')
  const extraQueries = extractQueryFacts(input.queries ?? '')
  return {
    ...code,
    queries: [...code.queries, ...extraQueries],
    packages: pkg.packages,
    parseErrors: pkg.error ? [...code.parseErrors, pkg.error] : code.parseErrors,
  }
}
