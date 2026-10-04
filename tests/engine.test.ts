import {describe, expect, it} from 'vitest'
import {compareApiVersion, evaluate} from '../lib/engine'
import {extractFacts} from '../lib/facts'
import type {Rule} from '../lib/types'
import {RULES, SOURCES} from '../scripts/rules-data'

const rules: Rule[] = RULES.map((r) => ({...r, sources: r.sources.map((k) => SOURCES[k])}))

function ruleIds(code: string, packageJson = '', queries = ''): string[] {
  return evaluate(extractFacts({code, packageJson, queries}), rules).map((f) => f.ruleId)
}

/** Each rule: code that must trigger it, and a near-miss that must not. */
const CASES: Record<string, {pos: string; neg: string; posQueries?: string}> = {
  'drafts-leak-raw-default': {
    pos: `createClient({projectId: 'p', dataset: 'production', apiVersion: '2023-05-03', token: process.env.SANITY_TOKEN, useCdn: false})`,
    neg: `createClient({projectId: 'p', dataset: 'production', apiVersion: '2023-05-03', token: process.env.SANITY_TOKEN, perspective: 'published'})`,
  },
  'bump-hides-drafts': {
    pos: `const c = createClient({apiVersion: '2024-01-01', token: 't0ken'})\nc.fetch('*[_id in path("drafts.**")]')`,
    neg: `const c = createClient({apiVersion: '2025-02-19', token: 't0ken'})\nc.fetch('*[_id in path("drafts.**")]')`,
  },
  'raw-now-includes-versions': {
    pos: `createClient({apiVersion: '2025-06-01', perspective: 'raw'})`,
    neg: `createClient({apiVersion: '2025-06-01', perspective: 'published'})`,
  },
  'raw-bump-adds-versions': {
    pos: `createClient({apiVersion: '2024-06-01', perspective: 'raw'})`,
    neg: `createClient({apiVersion: '2025-02-19', perspective: 'raw'})`,
  },
  'versions-invisible-pre-2025': {
    pos: `const c = createClient({apiVersion: '2024-10-01', perspective: 'published'})\nc.fetch('*[sanity::partOfRelease($id)]')`,
    neg: `const c = createClient({apiVersion: '2025-03-01', perspective: 'published'})\nc.fetch('*[sanity::partOfRelease($id)]')`,
  },
  'previewDrafts-deprecated': {
    pos: `createClient({apiVersion: '2024-01-01', perspective: 'previewDrafts', useCdn: false})`,
    neg: `createClient({apiVersion: '2024-01-01', perspective: 'drafts', useCdn: false})`,
  },
  'drafts-requires-no-cdn': {
    pos: `createClient({apiVersion: '2025-02-19', perspective: 'drafts', useCdn: true})`,
    neg: `createClient({apiVersion: '2025-02-19', perspective: 'drafts', useCdn: false})`,
  },
  'apiVersion-missing': {
    pos: `createClient({projectId: 'p', dataset: 'd'})`,
    neg: `createClient({projectId: 'p', dataset: 'd', apiVersion: '2026-10-01'})`,
  },
  'apiVersion-dynamic': {
    pos: `createClient({apiVersion: new Date().toISOString().slice(0, 10)})`,
    neg: `createClient({apiVersion: '2026-10-01'})`,
  },
  'apiVersion-unresolved-env': {
    pos: `createClient({apiVersion: process.env.SANITY_API_VERSION})`,
    neg: `createClient({apiVersion: process.env.SANITY_API_VERSION || '2026-10-01'})`,
  },
  'apiVersion-vX': {
    pos: `createClient({apiVersion: 'vX'})`,
    neg: `createClient({apiVersion: 'v2026-10-01'})`,
  },
  'useClient-releases': {
    pos: `const client = useClient({apiVersion: '2023-01-01'})`,
    neg: `const client = useClient({apiVersion: '2025-02-19'})`,
  },
  'listen-include-all-versions': {
    pos: `client.listen('*[_type == "post"]', {}, {includeResult: true})`,
    neg: `client.listen('*[_type == "post"]', {}, {includeAllVersions: true})`,
  },
  'projection-empty-string': {
    pos: `const c = createClient({apiVersion: '2024-01-01', perspective: 'published'})\nc.fetch('*[_type == "post"]{"": {"a": title}}')`,
    neg: `const c = createClient({apiVersion: '2024-01-01', perspective: 'published'})\nc.fetch('*[_type == "post"]{... {"a": title}}')`,
  },
}

describe('seed rules', () => {
  it('every rule has a positive/negative test case', () => {
    expect(Object.keys(CASES).sort()).toEqual(RULES.map((r) => r.ruleId).sort())
  })
  it('every rule has at least one source with evidence', () => {
    for (const r of rules) {
      expect(r.sources.length, r.ruleId).toBeGreaterThan(0)
      for (const s of r.sources) {
        expect(s?.url, r.ruleId).toMatch(/^https:\/\/www\.sanity\.io\/docs\//)
        expect(s.evidence!.split(/\s+/).length, `${r.ruleId} evidence ≤ 25 words`).toBeLessThanOrEqual(25)
      }
    }
  })

  for (const [ruleId, c] of Object.entries(CASES)) {
    describe(ruleId, () => {
      it('fires on the positive case', () => expect(ruleIds(c.pos)).toContain(ruleId))
      it('does not fire on the negative case', () => expect(ruleIds(c.neg)).not.toContain(ruleId))
    })
  }
})

describe('engine semantics', () => {
  it('orders v1 and missing before every date, and cannot order vX or dynamic', () => {
    expect(compareApiVersion({kind: 'v1'}, '2021-03-25')).toBe(-1)
    expect(compareApiVersion({kind: 'missing'}, '2021-03-25')).toBe(-1)
    expect(compareApiVersion({kind: 'vX'}, '2025-02-19')).toBeNull()
    expect(compareApiVersion({kind: 'dynamic', expression: 'x', source: 'env'}, '2025-02-19')).toBeNull()
    expect(compareApiVersion({kind: 'date', value: '2025-02-19'}, '2025-02-19')).toBe(0)
  })

  it('a missing apiVersion with a token leaks drafts (v1 defaults to raw)', () => {
    expect(ruleIds(`createClient({token: process.env.T})`)).toEqual(
      expect.arrayContaining(['drafts-leak-raw-default', 'apiVersion-missing']),
    )
  })

  it('does not fire drafts-leak for Studio useClient (drafts are expected there)', () => {
    expect(ruleIds(`useClient({apiVersion: '2023-01-01'})`)).not.toContain('drafts-leak-raw-default')
  })

  it('does not guess when the config comes from an unresolved spread', () => {
    expect(ruleIds(`import {cfg} from './cfg'\ncreateClient({...cfg, token: process.env.T})`)).toEqual([])
  })

  it('uses the env-var fallback date for version comparisons', () => {
    expect(ruleIds(`createClient({apiVersion: process.env.V || '2024-01-01', token: process.env.T})`)).toContain(
      'drafts-leak-raw-default',
    )
  })

  it('evaluates a withConfig preview client against its inherited config', () => {
    const code = `const client = createClient({apiVersion: '2025-02-19', useCdn: true, perspective: 'published'})
export const preview = client.withConfig({perspective: 'drafts', token: process.env.T})`
    expect(ruleIds(code)).toContain('drafts-requires-no-cdn')
  })

  it('bump-hides-drafts ignores queries that exclude drafts', () => {
    const code = `const c = createClient({apiVersion: '2024-01-01', token: 't'})\nc.fetch('*[!(_id in path("drafts.**"))]')`
    expect(ruleIds(code)).not.toContain('bump-hides-drafts')
  })

  it('a correct modern config produces no findings', () => {
    const code = `export const client = createClient({
  projectId: 'abc', dataset: 'production', apiVersion: '2026-10-01', useCdn: true, perspective: 'published',
})`
    expect(ruleIds(code)).toEqual([])
  })

  it('sorts critical before warning before info', () => {
    const code = `createClient({token: 'x'})\nclient.listen('*')`
    const f = evaluate(extractFacts({code}), rules)
    const order = f.map((x) => x.severity)
    expect(order).toEqual([...order].sort((a, b) => ['critical', 'warning', 'info'].indexOf(a) - ['critical', 'warning', 'info'].indexOf(b)))
    expect(order[0]).toBe('critical')
  })

  it('ignores rules with an invalid regex instead of throwing', () => {
    const bad: Rule = {...rules[0], ruleId: 'bad', conditions: [{fact: 'query', op: 'matches', value: '('}]}
    expect(() => evaluate(extractFacts({code: `client.fetch('*')`}), [bad])).not.toThrow()
  })

  it('package satisfies uses the minimum version of the declared range', () => {
    const r: Rule = {...rules[0], ruleId: 'pkg', conditions: [{fact: 'package', op: 'satisfies', value: '@sanity/client@<6'}]}
    const f = (range: string) => evaluate(extractFacts({code: '', packageJson: JSON.stringify({dependencies: {'@sanity/client': range}})}), [r])
    expect(f('^5.4.2')).toHaveLength(1)
    expect(f('^6.1.0')).toHaveLength(0)
  })
})

describe('home page samples', async () => {
  const {SAMPLES} = await import('../lib/samples')
  for (const s of SAMPLES) {
    it(`${s.label} produces exactly its expected findings`, () => {
      expect(ruleIds(s.code, s.packageJson ?? '', s.queries ?? '').sort()).toEqual([...s.expectedRuleIds].sort())
    })
  }
})

describe('eval cases (arm C ground truth)', async () => {
  const {EVAL_CASES} = await import('../scripts/eval-cases')
  it('has 15 cases', () => expect(EVAL_CASES).toHaveLength(15))
  for (const c of EVAL_CASES) {
    it(`${c.id}`, () => {
      expect(ruleIds(c.config, c.packageJson ?? '').sort()).toEqual([...c.expectedRuleIds].sort())
    })
  }
})
