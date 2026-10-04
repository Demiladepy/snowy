// Seed data for `rule` and `source` documents.
// Every evidence string is quoted verbatim from the source URL (fetched 2026-10-03).
// `verified: true` means the source was read and supports the rule as written.

import type {Rule, Source} from '../lib/types'

const RETRIEVED = '2026-10-03T12:00:00Z'

const PERSPECTIVES = 'https://www.sanity.io/docs/content-lake/perspectives'
const CHANGELOG_2025_02_19 = 'https://www.sanity.io/docs/changelog/676aaa9d-2da6-44fb-abe5-580f28047c10'
const STUDIO_3_77 = 'https://www.sanity.io/docs/changelog/e215973b-784d-46a8-9f5d-6ffac4dc9ace'
const API_VERSIONING = 'https://www.sanity.io/docs/content-lake/api-versioning'

/** Sources keyed by a stable id; the seed script writes them as `source.<key>`. */
export const SOURCES: Record<string, Source> = {
  'perspectives-default-changed': {
    url: PERSPECTIVES,
    title: 'Perspectives for Content Lake',
    kind: 'docs',
    evidence: 'With the release of API version 2025-02-19, the default perspective changed from `raw` to `published`.',
    retrievedAt: RETRIEVED,
  },
  'perspectives-raw-authenticated': {
    url: PERSPECTIVES,
    title: 'Perspectives for Content Lake',
    kind: 'docs',
    evidence: 'The `raw` perspective returns all drafts, versions, and published content side by side for authenticated requests.',
    retrievedAt: RETRIEVED,
  },
  'perspectives-previewdrafts-renamed': {
    url: PERSPECTIVES,
    title: 'Perspectives for Content Lake',
    kind: 'docs',
    evidence: "The `drafts` perspective used to be called `previewDrafts`. They both work, but if you're using the latest APIs, you should transition to `drafts`.",
    retrievedAt: RETRIEVED,
  },
  'perspectives-drafts-cdn': {
    url: PERSPECTIVES,
    title: 'Perspectives for Content Lake',
    kind: 'docs',
    evidence: 'the client will bypass the CDN and log a warning if `useCdn` is not set to `false`.',
    retrievedAt: RETRIEVED,
  },
  'changelog-default-published': {
    url: CHANGELOG_2025_02_19,
    title: 'Content Lake v2025-02-19: Content Releases APIs and new perspective defaults',
    kind: 'changelog',
    evidence: 'The default perspective has changed from `raw` to `published`.',
    retrievedAt: RETRIEVED,
  },
  'changelog-raw-includes-versions': {
    url: CHANGELOG_2025_02_19,
    title: 'Content Lake v2025-02-19: Content Releases APIs and new perspective defaults',
    kind: 'changelog',
    evidence: 'Raw perspective requests now include `versions.` prefixed documents in addition to `drafts.` and published documents.',
    retrievedAt: RETRIEVED,
  },
  'changelog-versions-not-returned': {
    url: CHANGELOG_2025_02_19,
    title: 'Content Lake v2025-02-19: Content Releases APIs and new perspective defaults',
    kind: 'changelog',
    evidence: '`versions.**` documents are not returned in API versions prior to `2025-02-19`. You must opt-in to this version to query versions-prefixed documents.',
    retrievedAt: RETRIEVED,
  },
  'changelog-empty-key-fix': {
    url: CHANGELOG_2025_02_19,
    title: 'Content Lake v2025-02-19: Content Releases APIs and new perspective defaults',
    kind: 'changelog',
    evidence: 'This version also introduces a fix to a GROQ bug whereby empty keys in projections would expand into the object.',
    retrievedAt: RETRIEVED,
  },
  'changelog-include-all-versions': {
    url: CHANGELOG_2025_02_19,
    title: 'Content Lake v2025-02-19: Content Releases APIs and new perspective defaults',
    kind: 'changelog',
    evidence: 'The following endpoints now include a boolean `includeAllVersions` parameter. Set it to true and use an authenticated request to include all versions.',
    retrievedAt: RETRIEVED,
  },
  'studio-useclient-releases': {
    url: STUDIO_3_77,
    title: 'Sanity Studio v3.77.0: Introducing Content Releases',
    kind: 'changelog',
    evidence: 'Ensure any custom implementations of the client in Studio that make use of `useClient` set the correct apiVersion and perspective (2025-02-19 and raw respectively)',
    retrievedAt: RETRIEVED,
  },
  'studio-listen-include-all-versions': {
    url: STUDIO_3_77,
    title: 'Sanity Studio v3.77.0: Introducing Content Releases',
    kind: 'changelog',
    evidence: "If using `client.listen`, you'll need to forward `includeAllVersions=true` in order to listen for version and draft document changes.",
    retrievedAt: RETRIEVED,
  },
  'apiversioning-missing-v1': {
    url: API_VERSIONING,
    title: 'API Versioning',
    kind: 'docs',
    evidence: 'Omit it and the client issues a deprecation warning, then defaults to `v1` of the API.',
    retrievedAt: RETRIEVED,
  },
  'apiversioning-undefined-throws': {
    url: API_VERSIONING,
    title: 'API Versioning',
    kind: 'docs',
    evidence: 'Passing the property with an undefined value throws an error instead.',
    retrievedAt: RETRIEVED,
  },
  'apiversioning-runtime-date': {
    url: API_VERSIONING,
    title: 'API Versioning',
    kind: 'docs',
    evidence: 'Computing it at runtime (for example from `new Date()`) means your API version changes every day',
    retrievedAt: RETRIEVED,
  },
  'apiversioning-vx': {
    url: API_VERSIONING,
    title: 'API Versioning',
    kind: 'docs',
    evidence: 'This version may change at any time in any way and is used at your own risk.',
    retrievedAt: RETRIEVED,
  },
}

/** Rules reference sources by key; the seed script turns them into references. */
export type SeedRule = Omit<Rule, 'sources'> & {sources: (keyof typeof SOURCES)[]}

const BOUNDARY = '2025-02-19'

export const RULES: SeedRule[] = [
  {
    ruleId: 'drafts-leak-raw-default',
    title: 'Unpublished drafts are served to your site',
    area: 'perspective',
    severity: 'critical',
    boundary: {apiVersion: BOUNDARY},
    conditions: [
      {fact: 'callSite', op: 'in', value: 'createClient,withConfig'},
      {fact: 'token', op: 'present'},
      {fact: 'apiVersion', op: 'lt', value: BOUNDARY},
      {fact: 'perspective', op: 'unset'},
    ],
    nowBehavior:
      'Your client sends a token and pins an API version before 2025-02-19 without setting a perspective, so the default is `raw`. Authenticated `raw` queries return draft documents (`drafts.*`) next to published ones, so unpublished edits can reach production.',
    afterBumpBehavior:
      'From 2025-02-19 the default perspective is `published`. Bumping the version silently stops returning drafts, which fixes the leak but changes what any preview code built on it sees.',
    fix: "Set the perspective explicitly: `perspective: 'published'` for production clients. For preview, use a separate client with `perspective: 'drafts'` and `useCdn: false`.",
    sources: ['perspectives-default-changed', 'perspectives-raw-authenticated', 'changelog-default-published'],
    verified: true,
  },
  {
    ruleId: 'bump-hides-drafts',
    title: 'Queries for drafts.* stop returning drafts after a version bump',
    area: 'perspective',
    severity: 'warning',
    boundary: {apiVersion: BOUNDARY},
    conditions: [
      {fact: 'token', op: 'present'},
      {fact: 'apiVersion', op: 'lt', value: BOUNDARY},
      {fact: 'perspective', op: 'unset'},
      // `_id in path("drafts.**")`, but not the common `!(_id in path("drafts.**"))` exclusion.
      {fact: 'query', op: 'matches', value: `(?<!!\\s*\\(\\s*)_id\\s+in\\s+path\\(\\s*["']drafts\\.`},
    ],
    nowBehavior:
      'Your queries reference `drafts.` IDs and depend on the pre-2025-02-19 default perspective (`raw`), which returns draft documents to authenticated requests.',
    afterBumpBehavior:
      'From 2025-02-19 the default perspective is `published`, which excludes drafts. The same queries will silently return no draft documents.',
    fix: "Set `perspective: 'raw'` to keep today's behavior, or switch to `perspective: 'drafts'` and drop the `drafts.` path filters.",
    sources: ['changelog-default-published', 'perspectives-default-changed'],
    verified: true,
  },
  {
    ruleId: 'raw-now-includes-versions',
    title: '`raw` also returns Content Release versions',
    area: 'releases',
    severity: 'warning',
    boundary: {apiVersion: BOUNDARY},
    conditions: [
      {fact: 'perspective', op: 'equals', value: 'raw'},
      {fact: 'apiVersion', op: 'gte', value: BOUNDARY},
    ],
    nowBehavior:
      'At API version 2025-02-19 or later, `raw` returns `versions.*` documents (Content Release versions) in addition to `drafts.*` and published documents. Code that only expects two kinds of IDs may show duplicates.',
    afterBumpBehavior: 'This already applies at your pinned version.',
    fix: 'Use a named perspective (`published`, `drafts`, or a release stack) instead of filtering by ID prefix, or exclude `versions.**` paths explicitly.',
    sources: ['changelog-raw-includes-versions'],
    verified: true,
  },
  {
    ruleId: 'raw-bump-adds-versions',
    title: 'Bumping adds Content Release versions to `raw` results',
    area: 'releases',
    severity: 'info',
    boundary: {apiVersion: BOUNDARY},
    conditions: [
      {fact: 'perspective', op: 'equals', value: 'raw'},
      {fact: 'apiVersion', op: 'lt', value: BOUNDARY},
    ],
    nowBehavior: 'Before 2025-02-19, `raw` returns published and `drafts.*` documents only. `versions.*` documents are not returned.',
    afterBumpBehavior:
      'From 2025-02-19, `raw` also returns `versions.*` documents, so result sets can grow and include unreleased content.',
    fix: 'Before bumping, check every consumer of this client for ID-prefix assumptions, or move to a named perspective.',
    sources: ['changelog-raw-includes-versions', 'changelog-versions-not-returned'],
    verified: true,
  },
  {
    ruleId: 'versions-invisible-pre-2025',
    title: 'Release queries return nothing at this API version',
    area: 'releases',
    severity: 'warning',
    boundary: {apiVersion: BOUNDARY},
    conditions: [
      {fact: 'query', op: 'matches', value: 'sanity::(partOfRelease|versionOf)|releases::all|versions\\.'},
      {fact: 'apiVersion', op: 'lt', value: BOUNDARY},
    ],
    nowBehavior:
      'Your queries look for Content Release versions, but API versions before 2025-02-19 never return `versions.**` documents.',
    afterBumpBehavior: 'From 2025-02-19 the version documents become visible to these queries.',
    fix: "Pin `apiVersion: '2025-02-19'` or later for the client that runs release queries.",
    sources: ['changelog-versions-not-returned'],
    verified: true,
  },
  {
    ruleId: 'previewDrafts-deprecated',
    title: '`previewDrafts` was renamed to `drafts`',
    area: 'perspective',
    severity: 'warning',
    conditions: [{fact: 'perspective', op: 'equals', value: 'previewDrafts'}],
    nowBehavior: '`previewDrafts` still works and behaves like `drafts`.',
    afterBumpBehavior: 'The docs say both names work, but recommend `drafts` on the latest APIs.',
    fix: "Replace `perspective: 'previewDrafts'` with `perspective: 'drafts'`.",
    sources: ['perspectives-previewdrafts-renamed'],
    verified: true,
  },
  {
    ruleId: 'drafts-requires-no-cdn',
    title: '`drafts` perspective with the CDN not disabled',
    area: 'cdn',
    severity: 'warning',
    conditions: [
      {fact: 'perspective', op: 'in', value: 'drafts,previewDrafts'},
      {fact: 'useCdn', op: 'in', value: 'true,unset'},
    ],
    nowBehavior:
      'Draft queries are not cached in the CDN. Because `useCdn` is not `false`, the client bypasses the CDN anyway and logs a warning on every request.',
    afterBumpBehavior: 'No change from bumping. This applies at every API version.',
    fix: 'Set `useCdn: false` on any client that uses the `drafts` perspective.',
    sources: ['perspectives-drafts-cdn'],
    verified: true,
  },
  {
    ruleId: 'apiVersion-missing',
    title: 'No apiVersion: client falls back to v1',
    area: 'apiVersion',
    severity: 'warning',
    conditions: [
      {fact: 'callSite', op: 'in', value: 'createClient,withConfig'},
      {fact: 'apiVersion', op: 'missing'},
    ],
    nowBehavior: 'With no `apiVersion`, the JS client logs a deprecation warning and uses `v1`, the original API version.',
    afterBumpBehavior:
      'Setting a current date changes several defaults at once, including the perspective (from 2025-02-19 the default is `published`, not `raw`).',
    fix: "Add a static date string, for example `apiVersion: '2026-10-03'`, then test your queries.",
    sources: ['apiversioning-missing-v1', 'perspectives-default-changed'],
    verified: true,
  },
  {
    ruleId: 'apiVersion-dynamic',
    title: 'apiVersion is computed from the current date',
    area: 'apiVersion',
    severity: 'warning',
    conditions: [{fact: 'apiVersion', op: 'dynamic', value: 'date'}],
    nowBehavior:
      'Your API version moves forward every day, so a new API release can change your app without a deploy. For example, the default perspective changed on 2025-02-19.',
    afterBumpBehavior: 'There is no single pinned version to bump. Behavior follows whatever version is current today.',
    fix: "Replace the computed value with a literal date string, for example `apiVersion: '2026-10-03'`.",
    sources: ['apiversioning-runtime-date'],
    verified: true,
  },
  {
    ruleId: 'apiVersion-unresolved-env',
    title: 'apiVersion comes from an env var with no fallback',
    area: 'apiVersion',
    severity: 'warning',
    conditions: [{fact: 'apiVersion', op: 'dynamic', value: 'env,undefined'}],
    nowBehavior:
      'Pinned can’t see which version this resolves to. If the variable is unset at runtime, the client receives `apiVersion: undefined`, which throws instead of falling back.',
    afterBumpBehavior: 'Depends on the value in each environment. Make sure every environment sets it.',
    fix: "Add a literal fallback (`process.env.SANITY_API_VERSION || '2026-10-03'`) or hardcode the date.",
    sources: ['apiversioning-undefined-throws'],
    verified: true,
  },
  {
    ruleId: 'apiVersion-vX',
    title: 'Experimental API version `vX`',
    area: 'apiVersion',
    severity: 'warning',
    conditions: [{fact: 'apiVersion', op: 'equals', value: 'vX'}],
    nowBehavior: '`vX` is the experimental version and can change at any time without notice.',
    afterBumpBehavior: 'Pinning a date makes behavior stable again.',
    fix: 'Use a dated apiVersion unless you need a specific experimental feature, and isolate that client.',
    sources: ['apiversioning-vx'],
    verified: true,
  },
  {
    ruleId: 'useClient-releases',
    title: 'Studio useClient can’t see Content Releases',
    area: 'studio',
    severity: 'warning',
    boundary: {apiVersion: BOUNDARY},
    conditions: [
      {fact: 'callSite', op: 'equals', value: 'useClient'},
      {fact: 'apiVersion', op: 'lt', value: BOUNDARY},
    ],
    nowBehavior:
      'This Studio client pins an API version before 2025-02-19, so it never sees `versions.**` documents. Plugins and custom inputs built on it will ignore Content Releases.',
    afterBumpBehavior: 'At 2025-02-19 with `perspective: raw`, the client sees drafts, published documents, and release versions.',
    fix: "useClient({apiVersion: '2025-02-19'}) and set `perspective: 'raw'` where the code needs every version.",
    sources: ['studio-useclient-releases', 'changelog-versions-not-returned'],
    verified: true,
  },
  {
    ruleId: 'listen-include-all-versions',
    title: '`listen()` without `includeAllVersions`',
    area: 'listen',
    severity: 'info',
    conditions: [
      {fact: 'callSite', op: 'equals', value: 'listen'},
      {fact: 'listenOption', op: 'absent', value: 'includeAllVersions'},
    ],
    nowBehavior: 'This listener doesn’t pass `includeAllVersions`, so it won’t get change events for Content Release version documents.',
    afterBumpBehavior: 'The parameter is available from API version 2025-02-19 and needs an authenticated request.',
    fix: 'Pass `{includeAllVersions: true}` in the listen options if the listener must see draft and version changes.',
    sources: ['studio-listen-include-all-versions', 'changelog-include-all-versions'],
    verified: true,
  },
  {
    ruleId: 'projection-empty-string',
    title: 'Empty-string projection key changes meaning',
    area: 'groq',
    severity: 'warning',
    boundary: {apiVersion: BOUNDARY},
    conditions: [
      {fact: 'query', op: 'matches', value: `(""|'')\\s*:`},
      {fact: 'apiVersion', op: 'lt', value: BOUNDARY},
    ],
    nowBehavior:
      'Before 2025-02-19, a projection key of `""` incorrectly spreads its object into the parent, and your query depends on that.',
    afterBumpBehavior: 'From 2025-02-19 the bug is fixed and the result keeps a literal `""` key, so the response shape changes.',
    fix: 'Replace `"": {...}` with the spread operator `... {...}` before bumping. It returns the same shape at every version.',
    sources: ['changelog-empty-key-fix'],
    verified: true,
  },
]
