import {describe, expect, it} from 'vitest'
import {extractCodeFacts, extractFacts, extractPackageFacts, extractQueryFacts, normalizeApiVersion} from '../lib/facts'

const one = (code: string) => {
  const f = extractCodeFacts(code)
  expect(f.clients.length).toBeGreaterThan(0)
  return f.clients[0]
}

describe('normalizeApiVersion', () => {
  it('strips the v prefix from dates', () => {
    expect(normalizeApiVersion('v2024-01-01')).toEqual({kind: 'date', value: '2024-01-01'})
    expect(normalizeApiVersion('2025-02-19')).toEqual({kind: 'date', value: '2025-02-19'})
  })
  it('recognises v1 and vX', () => {
    expect(normalizeApiVersion('v1')).toEqual({kind: 'v1'})
    expect(normalizeApiVersion('1')).toEqual({kind: 'v1'})
    expect(normalizeApiVersion('X')).toEqual({kind: 'vX'})
    expect(normalizeApiVersion('vX')).toEqual({kind: 'vX'})
  })
})

describe('extractCodeFacts: apiVersion', () => {
  it('reads a literal', () => {
    expect(one(`createClient({apiVersion: '2023-05-03'})`).apiVersion).toEqual({kind: 'date', value: '2023-05-03'})
  })
  it('marks a missing apiVersion', () => {
    expect(one(`createClient({projectId: 'x'})`).apiVersion).toEqual({kind: 'missing'})
  })
  it('flags new Date() as dynamic/date', () => {
    const v = one(`createClient({apiVersion: new Date().toISOString().split('T')[0]})`).apiVersion
    expect(v).toMatchObject({kind: 'dynamic', source: 'date'})
  })
  it('flags a bare env var as dynamic/env', () => {
    expect(one(`createClient({apiVersion: process.env.SANITY_API_VERSION})`).apiVersion).toMatchObject({kind: 'dynamic', source: 'env'})
  })
  it('uses the literal fallback of `env || date`', () => {
    const v = one(`createClient({apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2024-03-15'})`).apiVersion
    expect(v).toMatchObject({kind: 'date', value: '2024-03-15', viaFallback: 'process.env.NEXT_PUBLIC_SANITY_API_VERSION'})
  })
  it('resolves shorthand properties through a same-file const', () => {
    const code = `const apiVersion = 'v2022-11-15'\nexport const client = createClient({projectId, dataset, apiVersion})`
    expect(one(code).apiVersion).toEqual({kind: 'date', value: '2022-11-15'})
  })
  it('handles template literals without interpolation and `as const`', () => {
    expect(one('createClient({apiVersion: `2025-03-01` as const})').apiVersion).toEqual({kind: 'date', value: '2025-03-01'})
  })
  it('treats an unresolved spread as unknown, not missing', () => {
    const c = one(`import {config} from './env'\ncreateClient({...config, useCdn: true})`)
    expect(c.apiVersion.kind).toBe('dynamic')
    expect(c.perspective.kind).toBe('dynamic')
  })
  it('follows a same-file spread', () => {
    const c = one(`const base = {apiVersion: '2024-01-01', perspective: 'published'}\ncreateClient({...base})`)
    expect(c.apiVersion).toEqual({kind: 'date', value: '2024-01-01'})
    expect(c.perspective).toEqual({kind: 'literal', value: 'published'})
  })
})

describe('extractCodeFacts: perspective, token, useCdn', () => {
  it('reads perspective literals and stacks', () => {
    expect(one(`createClient({perspective: 'previewDrafts'})`).perspective).toEqual({kind: 'literal', value: 'previewDrafts'})
    expect(one(`createClient({perspective: ['rel-a', 'rel-b']})`).perspective).toEqual({kind: 'literal', value: ['rel-a', 'rel-b']})
  })
  it('marks an unset perspective', () => {
    expect(one(`createClient({apiVersion: '2024-01-01'})`).perspective).toEqual({kind: 'unset'})
  })
  it('detects env-var tokens', () => {
    expect(one(`createClient({token: process.env.SANITY_API_READ_TOKEN})`).token).toEqual({present: true, source: 'env'})
  })
  it('treats empty and undefined tokens as absent', () => {
    expect(one(`createClient({token: ''})`).token.present).toBe(false)
    expect(one(`createClient({token: undefined})`).token.present).toBe(false)
    expect(one(`createClient({})`).token.present).toBe(false)
  })
  it('reads useCdn booleans and unset', () => {
    expect(one(`createClient({useCdn: false})`).useCdn).toEqual({kind: 'literal', value: false})
    expect(one(`createClient({})`).useCdn).toEqual({kind: 'unset'})
    expect(one(`createClient({useCdn: process.env.NODE_ENV === 'production'})`).useCdn.kind).toBe('dynamic')
  })
})

describe('extractCodeFacts: call sites', () => {
  it('withConfig inherits from a same-file createClient', () => {
    const code = `const client = createClient({apiVersion: '2024-01-01', token: 'abc', useCdn: true})
export const previewClient = client.withConfig({perspective: 'drafts'})`
    const f = extractCodeFacts(code)
    const preview = f.clients.find((c) => c.callSite === 'withConfig')!
    expect(preview.apiVersion).toEqual({kind: 'date', value: '2024-01-01'})
    expect(preview.token.present).toBe(true)
    expect(preview.useCdn).toEqual({kind: 'literal', value: true})
    expect(preview.perspective).toEqual({kind: 'literal', value: 'drafts'})
  })
  it('useClient is an authenticated Studio client', () => {
    const c = one(`const client = useClient({apiVersion: '2023-01-01'})`)
    expect(c.callSite).toBe('useClient')
    expect(c.token.present).toBe(true)
  })
  it('records listen calls with their options', () => {
    const f = extractCodeFacts(`client.listen('*[_type == "post"]', {}, {includeResult: false})`)
    expect(f.listenCalls).toEqual([{line: 1, options: {includeResult: false}}])
    expect(f.queries[0].text).toBe('*[_type == "post"]')
  })
  it('records defineLive', () => {
    expect(extractCodeFacts(`export const {sanityFetch} = defineLive({client})`).callSites.map((c) => c.kind)).toContain('defineLive')
  })
})

describe('extractCodeFacts: queries', () => {
  it('collects groq tagged templates, defineQuery, and fetch strings', () => {
    const code = `
const a = groq\`*[_type == "post"]{title}\`
const b = defineQuery(\`*[_type == "author"]\`)
client.fetch('*[_id in path("drafts.**")]')
`
    const texts = extractCodeFacts(code).queries.map((q) => q.text)
    expect(texts).toContain('*[_type == "post"]{title}')
    expect(texts).toContain('*[_type == "author"]')
    expect(texts).toContain('*[_id in path("drafts.**")]')
  })
  it('keeps interpolations as placeholders', () => {
    const q = extractCodeFacts('const q = groq`*[_type == "${t}"]`').queries[0].text
    expect(q).toBe('*[_type == "${…}"]')
  })
})

describe('extractPackageFacts / extractQueryFacts / extractFacts', () => {
  it('reads tracked packages from all dependency fields', () => {
    const pkg = JSON.stringify({dependencies: {'next-sanity': '^9.0.0'}, devDependencies: {sanity: '^3.20.0', react: '^18'}})
    expect(extractPackageFacts(pkg).packages).toEqual({'next-sanity': '^9.0.0', sanity: '^3.20.0'})
  })
  it('reports invalid package.json without throwing', () => {
    expect(extractPackageFacts('{nope').error).toMatch(/package.json/)
  })
  it('splits raw GROQ blocks', () => {
    expect(extractQueryFacts('*[_type=="a"]\n\n*[_type=="b"]').map((q) => q.text)).toEqual(['*[_type=="a"]', '*[_type=="b"]'])
  })
  it('survives syntax errors', () => {
    const f = extractFacts({code: 'createClient({apiVersion: "2024-01-01"', packageJson: ''})
    expect(f.parseErrors.length).toBeGreaterThanOrEqual(0)
  })
})
