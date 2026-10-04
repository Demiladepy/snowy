# NOTES

Places where the current docs disagreed with the build spec, plus candidate docs findings to verify.
Docs were read on 2026-10-03.

## Spec vs docs: what changed in the build

1. **Initial context comes over HTTP, not from the `initial_context` tool.** The Sanity Context + Vercel AI SDK guide
   (https://www.sanity.io/docs/ai/sanity-context-vercel-ai-sdk) fetches `<mcp-url>/initial-context`, puts it in the
   system prompt, and drops the `initial_context` tool. `lib/mcp.ts` does this and caches the result for 10 minutes.
   The spec's 10-minute cache is kept.
2. **MCP endpoint URL format.** The spec guessed `https://api.sanity.io/v2026-09-01/context/organizations/<orgId>/mcp/<name>`.
   The MCP tools page uses `https://api.sanity.io/v1/context/organizations/$ORGANIZATION_ID/mcp/$MCP_ENDPOINT_NAME`.
   Copy the exact URL from the Context app either way.
3. **Env var name.** Sanity's guide calls the org token `SANITY_ORGANIZATION_TOKEN`. This repo keeps the spec's
   `SANITY_ORG_CONTEXT_TOKEN`.
4. **AI SDK 7 renames.** Installed: `ai@7.0.127`, `@ai-sdk/mcp@2.0.66`. v7 renamed `system` → `instructions`,
   `stepCountIs` → `isStepCount`, `onFinish` → `onEnd`. Sanity's Vercel AI SDK page still passes `system:`, which is
   v6 syntax. That's a candidate docs finding (`stale`).
5. **`drafts-requires-no-cdn` is `warning`, not `critical`.** The perspectives page says the client "will bypass the CDN
   and log a warning" when `useCdn` isn't `false`. Nothing breaks, so critical would overstate it.
6. **`apiVersion-vX` doesn't mention Agent Actions.** The API versioning page doesn't cover Agent Actions' use of `vX`,
   so the rule only cites the "experimental, may change at any time" text.
7. **New rule `apiVersion-unresolved-env`.** The API versioning page says passing `apiVersion: undefined` throws, while
   omitting it falls back to v1. An env var with no fallback is a real failure mode, and it's separate from the
   `new Date()` anti-pattern.
8. **Projection rule confirmed.** The v2025-02-19 changelog describes the empty-key projection fix and gives the `...`
   replacement, so `projection-empty-string` is seeded and verified.
9. **Document IDs use dashes.** IDs like `rule.foo` are sub-paths and aren't readable without auth. Seed IDs are
   `rule-<id>` and `source-<key>`, so the public dataset can serve them.

## Docs findings: verification log (2026-10-04)

Seeded as `docsFinding` documents (see `scripts/findings-data.ts`):
- **Perspectives page, `raw` "default value" example** (versionScoped). Still present on the live page.
- **v2025-02-19 changelog, `partOfReleases`** (wrong). Still present. The GROQ functions spec confirms `partOfRelease`.
- **Context + AI SDK guide uses `system:`** (stale vs `ai@7`). Still present.

Not seeded:
- **Content Releases cheat sheet** with `apiVersion: '2024-08-01'` and `perspective: 'published' //default`. The live page
  now uses `apiVersion: '2025-02-19'` throughout, so it's already fixed. Not reported.

## Original candidate list

- **Perspectives page contradicts itself (versionScoped).** The Gotcha says the default changed from `raw` to
  `published` at 2025-02-19. The `raw` example on the same page still comments `perspective: 'raw', // default value, optional`,
  and the prose says the query uses "the default `raw` perspective". Both are true, but on different sides of the
  boundary. https://www.sanity.io/docs/content-lake/perspectives
- **v2025-02-19 changelog function name.** The function is listed as `sanity::partOfRelease(releaseID)`, but the example
  uses `sanity::partOfReleases("rel-summer")` and is missing a closing `]`. Check against the GROQ functions spec.
  https://www.sanity.io/docs/changelog/676aaa9d-2da6-44fb-abe5-580f28047c10
- **Content Releases cheat sheet (from the spec).** `apiVersion: '2024-08-01'` alongside `perspective: 'published' //default`.
  Not verified yet. https://www.sanity.io/docs/apis-and-sdks/content-releases-cheat-sheet
- **Sanity Context Vercel AI SDK guide uses `system:`** (see item 4 above).
