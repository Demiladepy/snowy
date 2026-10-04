# Pinned

**Live:** https://pinned-snowy.vercel.app · **Demo ops:** https://pinned-snowy.vercel.app/analyze · **Rules:** https://pinned-snowy.vercel.app/rules
**Sanity project:** `mttzxmvf` · [public dataset query](https://mttzxmvf.api.sanity.io/v2026-10-03/data/query/production?query=*%5B_type%3D%3D%22rule%22%5D)

Paste your Sanity client config, and optionally `package.json` and queries. Pinned tells you what your code does
**today** at the apiVersion you pinned, what silently changes if you bump it, and where Sanity's own docs disagree
with themselves. Every claim is cited to Sanity's docs.

> Example: a token, an apiVersion before `2025-02-19`, and no `perspective` means the default is `raw`, so
> **unpublished drafts are served to your production site**. Bumping the version silently changes that.

## How it works

```
paste config ─▶ lib/facts.ts    Babel AST → typed Facts (apiVersion, perspective, token, useCdn, call sites, queries, packages)
              ─▶ lib/rules.ts    GROQ: *[_type == "rule" && verified] from Sanity project mttzxmvf
              ─▶ lib/engine.ts   pure evaluate(facts, rules) → findings              (deterministic, < 1 s)
              ─▶ lib/agent.ts    LLM explains each finding via Sanity Context MCP (Knowledge Base mode), citing entries
```

- **Rules are structured content.** Each `rule` document has typed `conditions` (`apiVersion lt 2025-02-19`,
  `token present`, `perspective unset`…), a boundary version, now/after-bump behavior, a fix, and `source` references
  with quoted evidence. A keyword search can't evaluate a conjunction like that against your code. The engine can.
- **The LLM explains; it does not decide.** Findings come only from the engine.
- **The MCP endpoint serves only the Knowledge Base.** An endpoint with a dataset source serves GROQ tools and ignores
  KB sources, so rules are loaded with `@sanity/client` directly.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in values
npm run seed                 # writes sources + rules to the dataset (needs SANITY_WRITE_TOKEN)
npm run dev
npm test                     # facts + engine unit tests
```

Studio (schemas for `rule`, `condition`, `source`, `docsFinding`, `evalCase`):

```bash
cd studio && npm install && npm run dev
```

### Environment variables

| Var | Where | Notes |
| --- | --- | --- |
| `SANITY_PROJECT_ID`, `SANITY_DATASET` | server | defaults `mttzxmvf` / `production` |
| `SANITY_WRITE_TOKEN` | local only | seed scripts. **Never deploy.** |
| `SANITY_CONTEXT_MCP_URL` | server | copy from the Context app |
| `SANITY_ORG_CONTEXT_TOKEN` | server | **organization** token with Context Viewer |
| `SANITY_KB_ID` | server | optional; parsed from initial context otherwise |
| `ANTHROPIC_API_KEY`, `PINNED_MODEL` | server | explanations + chat |
| `RATE_LIMIT_PER_HOUR` | server | default 20 per IP |

If the dataset has no verified rules yet, the app falls back to the bundled seed (`scripts/rules-data.ts`) and says
so in the UI. Without an LLM key or Context endpoint, the deterministic findings still work. Only the explanations and
chat are turned off.

## Rules

See `scripts/rules-data.ts`. All 14 seed rules are `verified: true`, and each quotes its source verbatim:

| ruleId | severity | boundary |
| --- | --- | --- |
| drafts-leak-raw-default | critical | 2025-02-19 |
| bump-hides-drafts | warning | 2025-02-19 |
| raw-now-includes-versions | warning | 2025-02-19 |
| raw-bump-adds-versions | info | 2025-02-19 |
| versions-invisible-pre-2025 | warning | 2025-02-19 |
| previewDrafts-deprecated | warning | — |
| drafts-requires-no-cdn | warning | — |
| apiVersion-missing | warning | v1 |
| apiVersion-dynamic | warning | — |
| apiVersion-unresolved-env | warning | — |
| apiVersion-vX | warning | — |
| useClient-releases | warning | 2025-02-19 |
| listen-include-all-versions | info | 2025-02-19 |
| projection-empty-string | warning | 2025-02-19 |

## Pages

- `/`: landing page with the drafts-leak story, the "contradictions are versions" thesis, live docs findings, and the eval table
- `/analyze`: six scripted **demo ops** (run one, or the full tour), a pipeline status strip, findings with Now / After bump / Fix,
  KB explanations, an **apiVersion time machine** (the engine re-runs in the browser as you drag across versions), and follow-up chat
- `/rules`: the rule catalogue, rendered from the dataset

## Dataset

| Type | Count | Notes |
| --- | --- | --- |
| `rule` | 14 | all `verified`, each with ≥ 1 source |
| `source` | 20 | verbatim evidence ≤ 25 words, `retrievedAt` |
| `docsFinding` | 3 | checked on live pages 2026-10-04; linked to rules |
| `evalCase` | 15 | 5 tutorial, 4 Studio, 3 modern, 3 tricky |

`npm run seed` writes all of it idempotently (`createOrReplace`).

## Eval

`npm run eval` runs three arms over the 15 cases and writes `evals/results.md` + `evals/results.json`:
A = model alone, B = model + Knowledge Base (Context MCP), C = Pinned. Arm C needs no keys. A and B need
`ANTHROPIC_API_KEY`, and B also needs the Context endpoint. See `evals/results.md` for the current table and caveats.

The eval cases exposed two engine gaps (chained `useClient().withConfig()` and `"": author->{…}` projections). Both are
fixed and covered by tests.

## Knowledge Base

See [KNOWLEDGE_BASE.md](KNOWLEDGE_BASE.md) for the source list, the Instructions to paste, and the MCP/token steps.

See `NOTES.md` for where the docs disagreed with the original spec.
