// 15 eval cases: 5 old-tutorial configs, 4 Studio/plugin snippets, 3 correct modern configs, 3 tricky ones.
// expectedRuleIds is the ground truth, written by hand from the rules' documented behavior.

export interface EvalCaseData {
  id: string
  name: string
  group: 'tutorial' | 'studio' | 'modern' | 'tricky'
  config: string
  packageJson?: string
  expectedRuleIds: string[]
  notes?: string
}

export const EVAL_CASES: EvalCaseData[] = [
  // --- 5 realistic old-tutorial configs ---
  {
    id: 'tut-nextjs-2023-token',
    name: '2023 Next.js blog client with a read token',
    group: 'tutorial',
    config: `import {createClient} from 'next-sanity'
export const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: '2023-05-03',
  useCdn: false,
  token: process.env.SANITY_API_READ_TOKEN,
})`,
    expectedRuleIds: ['drafts-leak-raw-default'],
    notes: 'The demo case: token + pre-2025-02-19 + no perspective means raw, so drafts leak.',
  },
  {
    id: 'tut-no-apiversion',
    name: 'Old Gatsby-era client with no apiVersion',
    group: 'tutorial',
    config: `const sanityClient = require('@sanity/client')
module.exports = sanityClient.createClient({
  projectId: 'abc123',
  dataset: 'production',
  token: process.env.SANITY_TOKEN,
  useCdn: false,
})`,
    expectedRuleIds: ['apiVersion-missing', 'drafts-leak-raw-default'],
    notes: 'Missing apiVersion falls back to v1, which predates the 2025-02-19 default change.',
  },
  {
    id: 'tut-preview-drafts-cdn',
    name: '2022 preview client using previewDrafts with the CDN on',
    group: 'tutorial',
    config: `import {createClient} from '@sanity/client'
export const previewClient = createClient({
  projectId: 'abc123',
  dataset: 'production',
  apiVersion: '2022-11-15',
  useCdn: true,
  perspective: 'previewDrafts',
  token: process.env.SANITY_PREVIEW_TOKEN,
})`,
    expectedRuleIds: ['previewDrafts-deprecated', 'drafts-requires-no-cdn'],
  },
  {
    id: 'tut-drafts-path-query',
    name: 'Tutorial that queries drafts.** by path',
    group: 'tutorial',
    config: `const client = createClient({projectId: 'abc123', dataset: 'production', apiVersion: '2021-10-21', token: process.env.SANITY_TOKEN})
export const getDraft = (id) => client.fetch('*[_id in path("drafts.**") && _type == "post"][0]', {id})`,
    expectedRuleIds: ['drafts-leak-raw-default', 'bump-hides-drafts'],
  },
  {
    id: 'tut-empty-key-projection',
    name: 'Query relying on the empty-key projection bug',
    group: 'tutorial',
    config: `const client = createClient({projectId: 'abc123', dataset: 'production', apiVersion: '2024-06-01', perspective: 'published', useCdn: true})
export const getPost = (slug) => client.fetch(\`*[_type == "post" && slug.current == $slug][0]{title, "": author->{name, image}}\`, {slug})`,
    expectedRuleIds: ['projection-empty-string'],
  },

  // --- 4 Studio / plugin snippets ---
  {
    id: 'studio-useclient-old',
    name: 'Custom input using useClient with a 2023 apiVersion',
    group: 'studio',
    config: `import {useClient} from 'sanity'
export function RelatedPosts() {
  const client = useClient({apiVersion: '2023-08-01'})
  return null
}`,
    expectedRuleIds: ['useClient-releases'],
  },
  {
    id: 'studio-plugin-versions',
    name: 'Plugin counting versions with versionOf and a listener',
    group: 'studio',
    config: `import {useClient} from 'sanity'
export function Badge({id}) {
  const client = useClient({apiVersion: '2024-03-01'})
  client.fetch('count(*[sanity::versionOf($id)])', {id})
  client.listen('*[_id == $id]', {id}).subscribe(() => {})
  return null
}`,
    expectedRuleIds: ['useClient-releases', 'versions-invisible-pre-2025', 'listen-include-all-versions'],
  },
  {
    id: 'studio-useclient-modern-raw',
    name: 'Release-aware Studio tool on 2025-02-19 with raw',
    group: 'studio',
    config: `import {useClient} from 'sanity'
export function ReleaseTool() {
  const client = useClient({apiVersion: '2025-02-19'}).withConfig({perspective: 'raw'})
  client.listen('*[_type == "post"]', {}, {includeAllVersions: true})
  return null
}`,
    expectedRuleIds: ['raw-now-includes-versions'],
    notes: 'Correct usage per the Studio v3.77 changelog; the only finding is the informational raw/versions warning.',
  },
  {
    id: 'studio-listen-no-option',
    name: 'Document action listening without includeAllVersions',
    group: 'studio',
    config: `export function useWatch(client, id) {
  return client.listen('*[_id == $id]', {id}, {includeResult: true})
}`,
    expectedRuleIds: ['listen-include-all-versions'],
  },

  // --- 3 correct modern configs (expect zero critical findings) ---
  {
    id: 'modern-published',
    name: 'Modern production client, explicit published perspective',
    group: 'modern',
    config: `export const client = createClient({
  projectId: 'abc123', dataset: 'production', apiVersion: '2026-09-01', useCdn: true, perspective: 'published',
})`,
    expectedRuleIds: [],
  },
  {
    id: 'modern-preview-split',
    name: 'Modern published client plus drafts preview client',
    group: 'modern',
    config: `export const client = createClient({projectId: 'abc123', dataset: 'production', apiVersion: '2025-10-01', useCdn: true, perspective: 'published'})
export const previewClient = client.withConfig({perspective: 'drafts', useCdn: false, token: process.env.SANITY_VIEWER_TOKEN})`,
    expectedRuleIds: [],
  },
  {
    id: 'modern-release-stack',
    name: 'Release preview with a perspective stack',
    group: 'modern',
    config: `export const releaseClient = createClient({
  projectId: 'abc123', dataset: 'production', apiVersion: '2025-03-01', useCdn: false,
  perspective: ['rSummer', 'drafts'], token: process.env.SANITY_VIEWER_TOKEN,
})`,
    expectedRuleIds: [],
  },

  // --- 3 tricky ones ---
  {
    id: 'tricky-date-apiversion',
    name: 'apiVersion computed from new Date()',
    group: 'tricky',
    config: `export const client = createClient({
  projectId: 'abc123', dataset: 'production',
  apiVersion: new Date().toISOString().split('T')[0],
  useCdn: true,
})`,
    expectedRuleIds: ['apiVersion-dynamic'],
    notes: 'Can’t be ordered against a boundary, so no perspective rule should fire.',
  },
  {
    id: 'tricky-env-fallback-token',
    name: 'Env apiVersion with an old literal fallback and an env token',
    group: 'tricky',
    config: `const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2023-06-21'
export const client = createClient({
  projectId: 'abc123', dataset: 'production', apiVersion,
  useCdn: false, token: process.env.SANITY_API_READ_TOKEN,
})`,
    expectedRuleIds: ['drafts-leak-raw-default'],
    notes: 'next-sanity template pattern: the fallback date is what runs when the env var is unset.',
  },
  {
    id: 'tricky-env-only-and-raw',
    name: 'Bare env apiVersion with an explicit raw perspective',
    group: 'tricky',
    config: `export const client = createClient({
  projectId: 'abc123', dataset: 'production',
  apiVersion: process.env.SANITY_API_VERSION,
  perspective: 'raw', token: process.env.SANITY_TOKEN, useCdn: false,
})`,
    expectedRuleIds: ['apiVersion-unresolved-env'],
    notes: 'Version unknown, so neither raw rule can fire. Only the env warning should.',
  },
]
