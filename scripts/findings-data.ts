// Docs findings: places where Sanity's docs disagree with themselves or with a dependency.
// Each one was checked on the live page on 2026-10-04. Claims quote the page verbatim.
// `kbIssue` stays empty until the Knowledge Base build surfaces the same conflict in its Issues panel.

import type {Source} from '../lib/types'

const RETRIEVED = '2026-10-04T08:00:00Z'

/** Extra sources used only by docs findings (rule sources live in rules-data.ts). */
export const FINDING_SOURCES: Record<string, Source> = {
  'perspectives-raw-example-default': {
    url: 'https://www.sanity.io/docs/content-lake/perspectives',
    title: 'Perspectives for Content Lake',
    kind: 'docs',
    evidence: "perspective: 'raw', // default value, optional",
    retrievedAt: RETRIEVED,
  },
  'changelog-partofreleases-example': {
    url: 'https://www.sanity.io/docs/changelog/676aaa9d-2da6-44fb-abe5-580f28047c10',
    title: 'Content Lake v2025-02-19: Content Releases APIs and new perspective defaults',
    kind: 'changelog',
    evidence: 'fetch all the version documents in release `rel-summer` using `*[sanity::partOfReleases("rel-summer")`.',
    retrievedAt: RETRIEVED,
  },
  'groq-functions-partofrelease': {
    url: 'https://www.sanity.io/docs/specifications/groq-functions',
    title: 'GROQ functions reference',
    kind: 'reference',
    evidence: 'sanity::versionOf and sanity::partOfRelease require API version `2025-02-19` or later.',
    retrievedAt: RETRIEVED,
  },
  'context-ai-sdk-system': {
    url: 'https://www.sanity.io/docs/ai/sanity-context-vercel-ai-sdk',
    title: 'Connect Sanity Context with Vercel AI SDK',
    kind: 'docs',
    evidence: 'const {text} = await generateText({ model: anthropic(...), system: systemPrompt, tools, ... })',
    retrievedAt: RETRIEVED,
  },
  'ai-sdk-7-instructions': {
    url: 'https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0',
    title: 'AI SDK: Migrate 6.x to 7.0',
    kind: 'reference',
    evidence: 'The top-level prompt option for system instructions has been renamed from `system` to `instructions`.',
    retrievedAt: RETRIEVED,
  },
}

export interface SeedFinding {
  id: string
  title: string
  kind: 'versionScoped' | 'stale' | 'wrong' | 'coverageGap'
  /** Source keys: from FINDING_SOURCES or rules-data SOURCES */
  claimA: {source: string; text: string}
  claimB: {source: string; text: string}
  relatedRules: string[]
  resolution: string
  kbIssue?: string
  status: 'triaged' | 'reported' | 'acknowledged' | 'fixed'
  reportedVia?: string
}

export const FINDINGS: SeedFinding[] = [
  {
    id: 'perspectives-raw-default-example',
    title: 'Perspectives page calls `raw` the default after saying the default changed',
    kind: 'versionScoped',
    claimA: {
      source: 'perspectives-raw-example-default',
      text: "The `raw` example is annotated `perspective: 'raw', // default value, optional`, and the prose says the query uses “the default `raw` perspective (explicitly set in this example but can safely be omitted)”.",
    },
    claimB: {
      source: 'perspectives-default-changed',
      text: 'A Gotcha at the top of the same page: “With the release of API version 2025-02-19, the default perspective changed from `raw` to `published`.”',
    },
    relatedRules: ['drafts-leak-raw-default', 'bump-hides-drafts', 'apiVersion-missing'],
    kbIssue:
      'Conflict (Critical) raised by the Knowledge Base build: "The default perspective as of v2025-02-19 is `published`" vs "The default perspective before v2025-02-19 was `raw`". Resolved with a version-scoped Instruction instead of picking a winner.',
    resolution:
      'Claims about the default perspective are version-scoped. Before API version 2025-02-19 the default is raw; from 2025-02-19 it is published. Always state the boundary; never present either claim as universally true. Suggested docs fix: annotate the example `// default before v2025-02-19` and note that omitting it now returns published content only.',
    status: 'triaged',
  },
  {
    id: 'changelog-partofreleases-typo',
    title: 'v2025-02-19 changelog example uses `partOfReleases` (and is missing a `]`)',
    kind: 'wrong',
    claimA: {
      source: 'changelog-partofreleases-example',
      text: 'The function is listed as `sanity::partOfRelease(releaseID)`, but its example is `*[sanity::partOfReleases("rel-summer")`, which has an extra “s” and no closing bracket.',
    },
    claimB: {
      source: 'groq-functions-partofrelease',
      text: 'The GROQ functions reference documents the function as `sanity::partOfRelease`.',
    },
    relatedRules: ['versions-invisible-pre-2025'],
    resolution:
      'The function is `sanity::partOfRelease(releaseId)`. Treat the changelog example as a typo; copying it fails to parse. Suggested fix: `*[sanity::partOfRelease("rel-summer")]`.',
    status: 'triaged',
  },
  {
    id: 'context-ai-sdk-guide-system',
    title: 'Sanity Context + Vercel AI SDK guide uses the pre-v7 `system` option',
    kind: 'stale',
    claimA: {
      source: 'context-ai-sdk-system',
      text: 'The guide installs the latest `ai` package and passes `system: systemPrompt` to `generateText`.',
    },
    claimB: {
      source: 'ai-sdk-7-instructions',
      text: 'AI SDK 7 renamed the top-level `system` option to `instructions` (a codemod `rename-system-to-instructions` exists).',
    },
    relatedRules: [],
    resolution:
      'Version-scoped by package, not API: `system` is correct for `ai@6`, `instructions` for `ai@7`. Suggested fix: pin the install to a major version in the guide, or update the example to `instructions`.',
    status: 'triaged',
  },
]
