# Eval results

Generated 2026-10-04T19:17:32.114Z · model `claude-sonnet-5-5` · 15 cases (5 tutorial, 4 Studio, 3 modern, 3 tricky).

- Rules: 14 from dataset.
- Caveat: the cases and their expected rule IDs were written by the same author as the rules, and two engine gaps they exposed were fixed before this run. Arm C’s score shows the engine matches its documented rules, not held-out accuracy.

| Arm | Precision | Recall | Exact cases | Boundary correct | Cited | False criticals on modern configs | Errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A — model alone | 80% | 71% | 10/15 | 5/6 | 0/15 | 0 | 0 |
| B — model + KB | 45% | 82% | 3/15 | 7/7 | 15/15 | 0 | 0 |
| C — Pinned (engine) | 100% | 100% | 15/15 | 10/10 | 15/15 | 0 | 0 |

- **Precision / recall** are over expected rule IDs. Free-text answers from A and B are mapped to rule IDs by a fixed judge prompt (`evals/judge.ts`). Spot-check 20% of mappings by hand before quoting them.
- **Boundary correct** counts true positives that stated the exact boundary date. Arm C takes boundaries from the rule documents, so it's correct by construction. The interesting comparison is between A and B.
- **Cited:** for B, the model called `knowledge_base_read`. For C, every finding carries at least one source with quoted evidence.

**Example of a boundary arm A made up** (studio-listen-no-option): “`includeResult: true` is explicit and probably unnecessary. Sanity's listener moved to the mendoza effect format and result-less events by default in newer API versions. It is also more expensive, because every event carries the full document, so use `includeResult: false` with `visibility`/`effectFormat: 'mendoza'` unless the full result is needed. Behavior depends on the client's configured apiVersion, and none is pinned here.” → `2021-03-25`, which matches no documented boundary.

## Per case

| Case | Expected | A | B | C |
| --- | --- | --- | --- | --- |
| tut-nextjs-2023-token | drafts-leak-raw-default | ✓ drafts-leak-raw-default | ✗ drafts-leak-raw-default, versions-invisible-pre-2025, projection-empty-string | ✓ drafts-leak-raw-default |
| tut-no-apiversion | apiVersion-missing, drafts-leak-raw-default | ✗ apiVersion-missing | ✗ apiVersion-missing, raw-now-includes-versions | ✓ drafts-leak-raw-default, apiVersion-missing |
| tut-preview-drafts-cdn | previewDrafts-deprecated, drafts-requires-no-cdn | ✓ previewDrafts-deprecated, drafts-requires-no-cdn | ✗ drafts-requires-no-cdn, previewDrafts-deprecated, useClient-releases | ✓ drafts-requires-no-cdn, previewDrafts-deprecated |
| tut-drafts-path-query | drafts-leak-raw-default, bump-hides-drafts | ✗ bump-hides-drafts, drafts-requires-no-cdn | ✗ bump-hides-drafts, drafts-leak-raw-default, versions-invisible-pre-2025, drafts-requires-no-cdn | ✓ drafts-leak-raw-default, bump-hides-drafts |
| tut-empty-key-projection | projection-empty-string | ✓ projection-empty-string | ✗ projection-empty-string, versions-invisible-pre-2025, drafts-requires-no-cdn | ✓ projection-empty-string |
| studio-useclient-old | useClient-releases | ✗ drafts-leak-raw-default | ✗ drafts-leak-raw-default, versions-invisible-pre-2025, projection-empty-string | ✓ useClient-releases |
| studio-plugin-versions | useClient-releases, versions-invisible-pre-2025, listen-include-all-versions | ✗ versions-invisible-pre-2025, drafts-leak-raw-default, listen-include-all-versions | ✗ versions-invisible-pre-2025, listen-include-all-versions | ✓ useClient-releases, versions-invisible-pre-2025, listen-include-all-versions |
| studio-useclient-modern-raw | raw-now-includes-versions | ✓ raw-now-includes-versions | ✗ listen-include-all-versions, raw-now-includes-versions | ✓ raw-now-includes-versions |
| studio-listen-no-option | listen-include-all-versions | ✗ (none) | ✗ listen-include-all-versions, apiVersion-missing | ✓ listen-include-all-versions |
| modern-published | (none) | ✓ (none) | ✓ (none) | ✓ (none) |
| modern-preview-split | (none) | ✓ (none) | ✓ (none) | ✓ (none) |
| modern-release-stack | (none) | ✓ (none) | ✓ (none) | ✓ (none) |
| tricky-date-apiversion | apiVersion-dynamic | ✓ apiVersion-dynamic | ✗ apiVersion-dynamic, drafts-requires-no-cdn | ✓ apiVersion-dynamic |
| tricky-env-fallback-token | drafts-leak-raw-default | ✓ drafts-leak-raw-default | ✗ apiVersion-unresolved-env, drafts-leak-raw-default, versions-invisible-pre-2025 | ✓ drafts-leak-raw-default |
| tricky-env-only-and-raw | apiVersion-unresolved-env | ✓ apiVersion-unresolved-env | ✗ apiVersion-unresolved-env, raw-bump-adds-versions | ✓ apiVersion-unresolved-env |
