---
title: Pinned — your Sanity apiVersion is a promise; this agent reads the fine print
published: true
tags: devchallenge, sanitychallenge, sanity, ai
---

*This is a submission for the [Sanity Challenge, Path One: Ship an Agent That Queries Real Content](https://dev.to/challenges/sanity-2026-09-16)*

## What I Built

**Pinned** is a version-aware code reviewer for Sanity. You paste a Sanity client config, and optionally a `package.json` and some GROQ queries. Pinned tells you three things:

1. What your code actually does **today**, at the `apiVersion` you pinned.
2. What **silently changes** if you bump that version.
3. Where **Sanity's own docs disagree with themselves**.

Every claim cites the docs.

The motivating bug is three ordinary lines from many 2024 tutorials:

```ts
export const client = createClient({
  apiVersion: '2024-01-01',
  token: process.env.SANITY_API_READ_TOKEN,
  // perspective: (not set)
})
```

Before API version `2025-02-19` the default perspective is `raw`. Authenticated `raw` queries return `drafts.*` documents alongside published ones, so **unpublished drafts are served to your production site**. Bump the version and the default flips to `published`. The leak stops, but any preview code that relied on it silently goes blank. Nothing in the code changed.

**The thesis:** a Knowledge Base build flags conflicting claims and asks which one is ground truth. For a versioned API, that's the wrong question. "The default perspective is `raw`" and "the default perspective is `published`" are **both true**, on either side of one date. Pinned stores those boundaries as structured data. It uses Knowledge Base Instructions to keep the build from collapsing them. It only calls a claim "wrong" when it's wrong at *every* version.

## Demo

**Live (no login):** https://pinned-snowy.vercel.app
- `/analyze` has six one-click "demo ops", including a full tour, and an **apiVersion time machine**: drag across versions and the rule engine re-runs in your browser.
- `/rules` lists every rule, rendered from the dataset.

{% youtube pyt9albxiP0 %}

## Code

{% github Demiladepy/snowy %}

Stack: Next.js 16 (App Router), Vercel AI SDK 7 with `@ai-sdk/mcp`, `@sanity/client`, `@babel/parser`, Tailwind, and ObsidianUI components. It has 86 unit tests covering the parser, the engine, every rule's positive and negative case, and all 15 eval cases.

## How I Used Sanity

### 1. Rules are structured content, not prompts

Every version boundary is a `rule` document in a public Sanity dataset. Each rule has:

- typed `conditions`, all of which must hold
- a `boundary` (for example `2025-02-19`)
- `nowBehavior`, `afterBumpBehavior` and a `fix`
- references to `source` documents, each carrying a **verbatim quote of 25 words or fewer** and a `retrievedAt` date

Here is the drafts-leak rule:

```
callSite in createClient,withConfig  AND  token present
AND  apiVersion < 2025-02-19  AND  perspective unset
```

A keyword search can find the page about perspectives. It can't *evaluate* that conjunction against your code. Pinned parses your code into an AST and reduces it to typed facts. A deterministic engine then fires a rule only when every condition holds. **The model never decides what's wrong.**

The schema has five types: `rule`, `condition`, `source`, `docsFinding` and `evalCase`. The dataset holds 14 verified rules, 20 sources, 3 docs findings and 15 eval cases. The app loads rules with GROQ, and the "Docs disagree here" badge comes from a join:

```groq
*[_type == "rule" && verified]{
  ..., "sources": sources[]->,
  "docsFindings": *[_type == "docsFinding" && references(^._id)]{_id, title, kind}
}
```

### 2. The Knowledge Base: what I pointed Sanity Context at

The Knowledge Base, *"Pinned — Sanity API behavior by version"*, covers a deliberately narrow slice of Sanity's own docs: 15 pages.

- **Docs pages:** perspectives, API versioning, presenting and previewing content, drafts and versions, the Content Release document flow, the Content Releases cheat sheet, the Live Content API, the API CDN, and GROQ functions.
- **Changelog entries:** v2025-02-19 (Content Releases and new perspective defaults), Studio v3.77, the v2021-03-25 entries, and @sanity/client v3.

The website crawl came back with 0 documents and then failed with a server error. I fell back to a **Files** source instead: the `.md` versions of the same pages, each prefixed with its original URL so entries can cite it.

### 3. The Issues it found, and how I resolved them

The build raised three **Critical conflicts** on its own:

| Issue | What it actually is | Resolution |
|---|---|---|
| "Default perspective as of v2025-02-19 is `published`" vs "before v2025-02-19 it was `raw`" | **Version-scoped.** Both are true. This is the thesis, and the build found it without being told to. | A version-scoped **Instruction**: *"Claims about the default perspective are version-scoped. Before 2025-02-19 the default is raw; from 2025-02-19 it is published. Always state the boundary."* |
| client v3 sends token + `useCdn: true` to the CDN, vs `drafts` needs `useCdn: false` | **Different conditions**, not a conflict | An Instruction explaining that both hold |
| Live Content API needs `v2021-03-25`, vs `geo::` introduced in `v2021-03-25` | **A false positive**: unrelated features share a version date | An Instruction saying a shared version date isn't a conflict |

The Issues UI asks *"Which is correct?"* and requires picking one claim. For version-scoped claims, the honest answer is "both, at different versions", so the Instructions carry that nuance into every future build.

### 4. Context MCP tools, and what the agent does with them

The MCP endpoint serves **only** the Knowledge Base. An endpoint that also has a dataset source switches to GROQ tools and ignores its Knowledge Base, so I keep the two separate: rules are fetched with `@sanity/client`, and explanations come from the KB.

For each finding, the agent:
1. receives the context outline from the `/initial-context` endpoint, inlined into its system prompt
2. calls `knowledge_base_search` to find relevant entries
3. calls `knowledge_base_read` to read them
4. explains in at most 80 words what the finding means **for this user's code**, citing `[kb: path]` and the source URL

The guardrails:
- never state a version boundary that isn't in the rule or an entry it read
- say "not covered by the docs I have" instead of guessing
- never claim to have run the code

Follow-up chat uses the same tools plus a local `get_rules` tool that queries the dataset.

### 5. Eval: three arms over 15 configs

The 15 configs are 5 old tutorials, 4 Studio plugins, 3 correct modern configs and 3 tricky ones (`new Date()` versions, env fallbacks, perspective stacks). Every arm reviews the same configs.

| Arm | Precision | Recall | Exact | Boundary date right | Cited |
|---|---|---|---|---|---|
| A: model alone | 80% | 71% | 10/15 | 5/6 | 0/15 |
| B: model + Knowledge Base | 45% | 82% | 3/15 | 7/7 | 15/15 |
| C: Pinned (rules + engine) | 100% | 100% | 15/15 | 10/10 | 15/15 |

What I learned, reported honestly:

- **The model alone is good.** It never invented a version date.
- **Adding the Knowledge Base made every answer cited** and got every boundary right. It also made the model flag many more issues that weren't real, so its precision dropped.
- **The model misses context:** it flagged a Studio `useClient` plugin for a "drafts leak", but inside Studio, drafts are expected. Structured conditions catch that.
- **Caveat:** I wrote the cases alongside the rules, so arm C's 100% shows the engine matches its documented rules, not held-out accuracy. The eval also found two real engine gaps (`useClient().withConfig()` chains, and `"": author->{…}` projections), and I fixed both before the final run.

### 6. Docs findings I verified on the live pages

These are `docsFinding` documents in the dataset, each linked to the rules it affects:

- **Perspectives page, version-scoped:** a Gotcha says the default changed to `published`, while the `raw` example on the same page still says `// default value, optional`.
- **v2025-02-19 changelog, wrong:** it lists `sanity::partOfRelease(releaseID)`, but its example uses `partOfReleases(...)` and is missing a closing `]`.
- **Sanity Context + Vercel AI SDK guide, stale:** it uses the `system:` option, which AI SDK 7 renamed to `instructions`.

I also checked a fourth candidate, an old `apiVersion` on the Content Releases cheat sheet. It's already fixed on the live page, so it isn't reported. All of this is credit to the product: the Knowledge Base surfaced the first one on its own.

## Sanity Project Details

- **Project ID:** `mttzxmvf` (dataset `production`, public read)
- **Public dataset query:** https://mttzxmvf.api.sanity.io/v2026-10-03/data/query/production?query=*[_type=="rule"]
- **Schema:** `rule` (typed conditions, boundary, behaviors, fix, source references), `condition`, `source` (verbatim evidence, `retrievedAt`), `docsFinding` (two claims, resolution, KB issue, status) and `evalCase`
- **Sanity Context:** Knowledge Base *"Pinned — Sanity API behavior by version"* (15 file sources), MCP endpoint `pinned-sanity` in Knowledge Base mode

## Agent Session

{% agent_session PASTE_YOUR_SESSION_ID_HERE %}

Built with Claude Code. The session covers reading Sanity's docs before writing integration code, the rule engine and its tests, seeding the dataset, the eval, and the UI.
