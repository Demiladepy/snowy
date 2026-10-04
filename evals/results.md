# Eval results

Generated 2026-10-04T18:27:11.864Z · model `claude-sonnet-5-5` · 15 cases (5 tutorial, 4 Studio, 3 modern, 3 tricky).

- Rules: 14 from dataset.
- Caveat: the cases and their expected rule IDs were written by the same author as the rules, and two engine gaps they exposed were fixed before this run. Arm C’s score shows the engine matches its documented rules, not held-out accuracy.

| Arm | Precision | Recall | Exact cases | Boundary correct | Cited | False criticals on modern configs | Errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A — model alone | 86% | 71% | 10/15 | 5/6 | 0/15 | 0 | 1 |
| C — Pinned (engine) | 100% | 100% | 15/15 | 10/10 | 15/15 | 0 | 0 |

- **Precision / recall** are over expected rule IDs. Free-text answers from A and B are mapped to rule IDs by a fixed judge prompt (`evals/judge.ts`). Spot-check 20% of mappings by hand before quoting them.
- **Boundary correct** counts true positives that stated the exact boundary date. Arm C takes boundaries from the rule documents, so it's correct by construction. The interesting comparison is between A and B.
- **Cited:** for B, the model called `knowledge_base_read`. For C, every finding carries at least one source with quoted evidence.

## Per case

| Case | Expected | A | B | C |
| --- | --- | --- | --- | --- |
| tut-nextjs-2023-token | drafts-leak-raw-default | ✓ drafts-leak-raw-default | — | ✓ drafts-leak-raw-default |
| tut-no-apiversion | apiVersion-missing, drafts-leak-raw-default | ✓ apiVersion-missing, drafts-leak-raw-default | — | ✓ drafts-leak-raw-default, apiVersion-missing |
| tut-preview-drafts-cdn | previewDrafts-deprecated, drafts-requires-no-cdn | ✓ previewDrafts-deprecated, drafts-requires-no-cdn | — | ✓ drafts-requires-no-cdn, previewDrafts-deprecated |
| tut-drafts-path-query | drafts-leak-raw-default, bump-hides-drafts | ✗ bump-hides-drafts, drafts-requires-no-cdn | — | ✓ drafts-leak-raw-default, bump-hides-drafts |
| tut-empty-key-projection | projection-empty-string | ✓ projection-empty-string | — | ✓ projection-empty-string |
| studio-useclient-old | useClient-releases | ✗ drafts-leak-raw-default | — | ✓ useClient-releases |
| studio-plugin-versions | useClient-releases, versions-invisible-pre-2025, listen-include-all-versions | ✗ versions-invisible-pre-2025, listen-include-all-versions | — | ✓ useClient-releases, versions-invisible-pre-2025, listen-include-all-versions |
| studio-useclient-modern-raw | raw-now-includes-versions | ✓ raw-now-includes-versions | — | ✓ raw-now-includes-versions |
| studio-listen-no-option | listen-include-all-versions | ✗ (none) | — | ✓ listen-include-all-versions |
| modern-published | (none) | ✓ (none) | — | ✓ (none) |
| modern-preview-split | (none) | ✓ (none) | — | ✓ (none) |
| modern-release-stack | (none) | ✓ (none) | — | ✓ (none) |
| tricky-date-apiversion | apiVersion-dynamic | ✓ apiVersion-dynamic | — | ✓ apiVersion-dynamic |
| tricky-env-fallback-token | drafts-leak-raw-default | error | — | ✓ drafts-leak-raw-default |
| tricky-env-only-and-raw | apiVersion-unresolved-env | ✓ apiVersion-unresolved-env | — | ✓ apiVersion-unresolved-env |
