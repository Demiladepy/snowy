# Knowledge Base setup (Dashboard, about 20 minutes)

Pinned's explanations and chat need a Sanity Context Knowledge Base, an MCP endpoint, and an org token. These steps
happen in the Sanity Dashboard; there's no API for them. Everything else is already done (rules, findings, and eval
cases are seeded; the site is live).

## 1. Turn it on
- https://www.sanity.io/manage/org/labs → enable **Context Knowledge Bases** (org admin).
- Check the **Growth Trial end date**. If it ends before **Oct 22**, the live demo dies during judging. Ask in Sanity Discord.

## 2. Create the Knowledge Base
Dashboard → Context → **New knowledge base**

- **Title:** `Pinned — Sanity API behavior by version`
- **Purpose:** `For developers maintaining Sanity apps: what the Content Lake APIs and official clients do at each pinned apiVersion — perspectives, drafts, Content Releases, CDN, listeners, GROQ behavior — and what changes when the version is bumped.`

### Sources (website, most specific URLs)
```
https://www.sanity.io/docs/content-lake/perspectives
https://www.sanity.io/docs/content-lake/api-versioning
https://www.sanity.io/docs/content-lake/presenting-and-previewing-content
https://www.sanity.io/docs/content-lake/drafts-and-versions
https://www.sanity.io/docs/content-lake/content-release-document-flow
https://www.sanity.io/docs/apis-and-sdks/content-releases-cheat-sheet
https://www.sanity.io/docs/content-lake/live-content-api
https://www.sanity.io/docs/content-lake/api-cdn
https://www.sanity.io/docs/specifications/groq-functions
https://www.sanity.io/docs/changelog/676aaa9d-2da6-44fb-abe5-580f28047c10
https://www.sanity.io/docs/changelog/e215973b-784d-46a8-9f5d-6ffac4dc9ace
https://www.sanity.io/docs/changelog/aafa1942-9aec-4453-a94f-a32fef056e9c
https://www.sanity.io/docs/changelog/86e7b7ae-cbdf-4fca-9591-4a30bcedd396
https://www.sanity.io/docs/changelog/2965cfa8-5fe4-4c52-b307-135e13116dc7
https://www.sanity.io/docs/ai/sanity-context-vercel-ai-sdk
```
If a crawl over-ingests, append `.md` to each URL, download them, and upload them as a **Files** source instead.

Build entries and wait for **Entries up to date**.

## 3. Issues → Instructions
Open **Issues**. Expect the perspective-default conflict, among others. Don't pick a winner for version-scoped ones.
Paste this as an Instruction:

```
Claims about the default perspective are version-scoped. Before API version 2025-02-19 the default is raw; from 2025-02-19 it is published. Always state the boundary; never present either claim as universally true.
```

Others, as they come up:
```
Claims about which documents the raw perspective returns are version-scoped. Before 2025-02-19 raw returns published and drafts.** documents; from 2025-02-19 it also returns versions.** documents.
```
```
The GROQ function is sanity::partOfRelease(releaseId). The v2025-02-19 changelog example spelling partOfReleases is a typo.
```
```
previewDrafts and drafts name the same perspective; drafts is current. Treat previewDrafts as a deprecated alias, not a different behavior.
```

Screenshot each Issue before and after (for the post). If an Issue isn't one of the 3 seeded `docsFinding`s, add it in
the Studio (`cd studio && npm run dev`) or tell Claude and it will add it to `scripts/findings-data.ts`. Paste the
Issue text into each finding's `kbIssue` field.

## 4. MCP endpoint + token
- Context app → create an MCP endpoint with **only the Knowledge Base** as its source (no dataset source; a dataset
  source switches it to GROQ mode and the KB is ignored).
- Manage → API → Tokens **at the organization level** → token with **Context Viewer**.
- Smoke test (expect `knowledge_base_read` and `initial_context`):
```sh
curl -X POST "$SANITY_CONTEXT_MCP_URL" -H "Authorization: Bearer $SANITY_ORG_CONTEXT_TOKEN" \
  -H "Accept: application/json, text/event-stream" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## 5. Hand back
Put these in `.env.local` (and Vercel → Settings → Environment Variables):
```
SANITY_CONTEXT_MCP_URL=
SANITY_ORG_CONTEXT_TOKEN=
ANTHROPIC_API_KEY=
```
Then:
```sh
npm run eval        # runs arms A and B and rewrites evals/results.md + results.json
npx vercel deploy --prod
```
