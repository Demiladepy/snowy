// Deterministic rule engine. Pure: evaluate(facts, rules) -> findings.
// A rule fires when ALL of its conditions hold.
//
// Client-scoped rules (any condition on apiVersion / perspective / token / useCdn, or a callSite
// naming a client kind) are evaluated once per client config found in the code; callSite then
// refers to that client's own call site. Everything else is evaluated once against the whole file.

import semver from 'semver'
import type {ApiVersionFact, ClientFacts, Condition, Facts, Finding, Rule, Severity} from './types'

const CLIENT_FACTS = new Set(['apiVersion', 'perspective', 'token', 'useCdn'])
const CLIENT_CALLSITES = new Set(['createClient', 'withConfig', 'useClient'])

/**
 * Compare a pinned apiVersion against a boundary date.
 * Returns -1/0/1, or null when the version can't be ordered (vX, dynamic without fallback).
 * `v1` and `missing` (which the client resolves to v1) sort before every date.
 */
export function compareApiVersion(v: ApiVersionFact, boundary: string): -1 | 0 | 1 | null {
  if (v.kind === 'v1' || v.kind === 'missing') return -1
  if (v.kind !== 'date') return null
  // Normalized YYYY-MM-DD strings compare correctly as strings.
  return v.value < boundary ? -1 : v.value > boundary ? 1 : 0
}

/** String form of a config value for equals / in: literal value, 'unset', 'dynamic', or 'stack'. */
function valueString(v: ClientFacts['perspective'] | ClientFacts['useCdn']): string {
  if (v.kind === 'unset') return 'unset'
  if (v.kind === 'dynamic') return 'dynamic'
  if (Array.isArray(v.value)) return 'stack'
  return String(v.value)
}

function apiVersionString(v: ApiVersionFact): string {
  switch (v.kind) {
    case 'date':
      return v.value
    case 'dynamic':
      return 'dynamic'
    default:
      return v.kind // 'v1' | 'vX' | 'missing'
  }
}

function safeRegex(pattern: string | undefined): RegExp | null {
  if (!pattern) return null
  try {
    return new RegExp(pattern)
  } catch {
    return null
  }
}

/** "name@range" -> [name, range]; scoped names keep their leading @. */
function splitPackageSpec(spec: string): [string, string] {
  const at = spec.lastIndexOf('@')
  if (at <= 0) return [spec, '*']
  return [spec.slice(0, at), spec.slice(at + 1)]
}

/** The lowest version a package.json range can install (`^6.1.0` -> 6.1.0). */
function installedVersion(range: string): string | null {
  try {
    return semver.minVersion(range)?.version ?? null
  } catch {
    return null
  }
}

export function conditionHolds(c: Condition, facts: Facts, client: ClientFacts | null): boolean {
  switch (c.fact) {
    case 'apiVersion': {
      if (!client) return false
      const v = client.apiVersion
      switch (c.op) {
        case 'lt':
          return compareApiVersion(v, c.value ?? '') === -1
        case 'gte': {
          const cmp = compareApiVersion(v, c.value ?? '')
          return cmp === 0 || cmp === 1
        }
        case 'missing':
          return v.kind === 'missing'
        case 'dynamic':
          return v.kind === 'dynamic' && (!c.value || listValues(c.value).includes(v.source))
        case 'equals':
          return apiVersionString(v) === c.value
        case 'in':
          return listValues(c.value).includes(apiVersionString(v))
        default:
          return false
      }
    }
    case 'perspective':
    case 'useCdn': {
      if (!client) return false
      const v = c.fact === 'perspective' ? client.perspective : client.useCdn
      const s = valueString(v)
      switch (c.op) {
        case 'unset':
          return v.kind === 'unset'
        case 'present':
          return v.kind !== 'unset'
        case 'dynamic':
          return v.kind === 'dynamic'
        case 'equals':
          return s === c.value
        case 'in':
          return listValues(c.value).includes(s)
        case 'matches':
          return safeRegex(c.value)?.test(s) ?? false
        default:
          return false
      }
    }
    case 'token': {
      if (!client) return false
      if (c.op === 'present') return client.token.present
      if (c.op === 'absent') return !client.token.present
      return false
    }
    case 'callSite': {
      const wanted = listValues(c.value)
      const kinds: string[] = client && isClientCallSite(c) ? [client.callSite] : facts.callSites.map((s) => s.kind)
      const any = wanted.some((k) => kinds.includes(k))
      if (c.op === 'equals' || c.op === 'in' || c.op === 'present') return any
      if (c.op === 'absent') return !any
      return false
    }
    case 'query': {
      const re = safeRegex(c.value)
      if (!re) return false
      const any = facts.queries.some((q) => re.test(q.text))
      if (c.op === 'matches' || c.op === 'present') return any
      if (c.op === 'absent') return !any
      return false
    }
    case 'package': {
      if (c.op === 'present') return Boolean(facts.packages[c.value ?? ''])
      if (c.op === 'absent') return !facts.packages[c.value ?? '']
      if (c.op === 'satisfies') {
        const [name, range] = splitPackageSpec(c.value ?? '')
        const declared = facts.packages[name]
        if (!declared) return false
        const v = installedVersion(declared)
        return v ? semver.satisfies(v, range) : false
      }
      return false
    }
    case 'listenOption': {
      // present: some .listen() passes the option; absent: some .listen() omits it.
      if (!facts.listenCalls.length) return false
      const key = c.value ?? ''
      if (c.op === 'present') return facts.listenCalls.some((l) => l.options[key] !== undefined && l.options[key] !== false)
      if (c.op === 'absent') return facts.listenCalls.some((l) => l.options[key] === undefined || l.options[key] === false)
      return false
    }
    default:
      return false
  }
}

function listValues(value: string | undefined): string[] {
  return (value ?? '').split(',').map((v) => v.trim()).filter(Boolean)
}

/** A callSite condition is client-scoped when every kind it names is a client constructor. */
function isClientCallSite(c: Condition): boolean {
  const values = listValues(c.value)
  return values.length > 0 && values.every((v) => CLIENT_CALLSITES.has(v))
}

export function isClientScoped(rule: Rule): boolean {
  return rule.conditions.some((c) => CLIENT_FACTS.has(c.fact) || (c.fact === 'callSite' && isClientCallSite(c)))
}

const SEVERITY_ORDER: Record<Severity, number> = {critical: 0, warning: 1, info: 2}

function toFinding(rule: Rule, lineNo?: number): Finding {
  return {
    ruleId: rule.ruleId,
    severity: rule.severity,
    title: rule.title,
    nowBehavior: rule.nowBehavior,
    afterBumpBehavior: rule.afterBumpBehavior,
    fix: rule.fix,
    sources: rule.sources,
    line: lineNo,
    docsFindings: rule.docsFindings,
  }
}

export function evaluate(facts: Facts, rules: Rule[]): Finding[] {
  const findings: Finding[] = []
  for (const rule of rules) {
    if (!rule.conditions?.length) continue
    if (isClientScoped(rule)) {
      // One finding per rule: report the first client that triggers it.
      const hit = facts.clients.find((client) => rule.conditions.every((c) => conditionHolds(c, facts, client)))
      if (hit) findings.push(toFinding(rule, hit.line))
    } else if (rule.conditions.every((c) => conditionHolds(c, facts, null))) {
      const site = facts.listenCalls[0]?.line
      findings.push(toFinding(rule, rule.conditions.some((c) => c.fact === 'listenOption') ? site : undefined))
    }
  }
  return findings.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || (a.line ?? 0) - (b.line ?? 0),
  )
}
