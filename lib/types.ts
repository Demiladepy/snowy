// Shared types for the facts parser, rule engine, and UI.

export type FactName =
  | 'apiVersion'
  | 'perspective'
  | 'token'
  | 'useCdn'
  | 'callSite'
  | 'query'
  | 'package'
  | 'listenOption'

export type ConditionOp =
  | 'lt'
  | 'gte'
  | 'missing'
  | 'dynamic'
  | 'equals'
  | 'in'
  | 'unset'
  | 'present'
  | 'absent'
  | 'matches'
  | 'satisfies'

export interface Condition {
  fact: FactName
  op: ConditionOp
  /** 'in' = comma-separated, 'matches' = regex, 'satisfies' = semver range, 'package' = "name@range" */
  value?: string
}

export type Severity = 'critical' | 'warning' | 'info'

export interface Source {
  _id?: string
  url: string
  title?: string
  kind?: 'docs' | 'changelog' | 'reference' | 'cheatsheet' | 'blog' | 'learn'
  evidence?: string
  retrievedAt?: string
}

export interface Rule {
  ruleId: string
  title: string
  area?: string
  severity: Severity
  boundary?: {apiVersion?: string; package?: string; packageRange?: string}
  conditions: Condition[]
  nowBehavior: string
  afterBumpBehavior: string
  fix: string
  sources: Source[]
  verified?: boolean
  /** Ids of docsFinding documents that reference this rule (joined at query time). */
  docsFindings?: {_id: string; title: string; kind: string}[]
}

/** How the apiVersion was written in the code. */
export type ApiVersionFact =
  /** normalized YYYY-MM-DD; viaFallback is set for `process.env.X || '2024-01-01'` */
  | {kind: 'date'; value: string; viaFallback?: string}
  | {kind: 'v1'}
  | {kind: 'vX'}
  | {kind: 'missing'}
  | {kind: 'dynamic'; expression: string; source: DynamicSource}

/** 'date' = computed from the clock (new Date()), 'env' = env var with no fallback. */
export type DynamicSource = 'date' | 'env' | 'undefined' | 'expression'

/** Value of a config key: a literal, an expression we can't resolve, or not set at all. */
export type ValueFact<T> =
  | {kind: 'literal'; value: T}
  | {kind: 'dynamic'; expression: string}
  | {kind: 'unset'}

export type CallSiteKind = 'createClient' | 'withConfig' | 'useClient' | 'defineLive' | 'listen' | 'fetch'

export interface ClientFacts {
  /** Where the client config came from. */
  callSite: CallSiteKind
  line: number
  apiVersion: ApiVersionFact
  /** string, or string[] for a release stack */
  perspective: ValueFact<string | string[]>
  token: {present: boolean; source?: 'literal' | 'env' | 'expression'}
  useCdn: ValueFact<boolean>
}

export interface Facts {
  clients: ClientFacts[]
  callSites: {kind: CallSiteKind; line: number}[]
  queries: {text: string; line: number}[]
  listenCalls: {line: number; options: Record<string, unknown>}[]
  packages: Record<string, string>
  parseErrors: string[]
}

export interface Finding {
  ruleId: string
  severity: Severity
  title: string
  nowBehavior: string
  afterBumpBehavior: string
  fix: string
  sources: Source[]
  /** Line of the client/call that triggered the finding (1-based), if known. */
  line?: number
  docsFindings?: Rule['docsFindings']
}
