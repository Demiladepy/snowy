// Seed `source`, `rule`, `docsFinding`, and `evalCase` documents into the Sanity dataset.
// Usage: npm run seed   (needs SANITY_WRITE_TOKEN in .env.local; never deploy that token)
//
// Document IDs use dashes, not dots: IDs containing a dot are sub-paths and are not
// readable without authentication, which would hide them from the public dataset.

import {createClient} from '@sanity/client'
import {EVAL_CASES} from './eval-cases'
import {FINDING_SOURCES, FINDINGS} from './findings-data'
import {RULES, SOURCES} from './rules-data'

const token = process.env.SANITY_WRITE_TOKEN
if (!token) {
  console.error('SANITY_WRITE_TOKEN is not set')
  process.exit(1)
}

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID || 'mttzxmvf',
  dataset: process.env.SANITY_DATASET || 'production',
  apiVersion: '2026-10-03',
  token,
  useCdn: false,
})

const sourceId = (key: string) => `source-${key}`
const ruleId = (id: string) => `rule-${id}`

async function main() {
  const tx = client.transaction()

  for (const [key, s] of Object.entries(SOURCES)) {
    tx.createOrReplace({_id: sourceId(key), _type: 'source', ...s})
  }

  for (const r of RULES) {
    tx.createOrReplace({
      _id: ruleId(r.ruleId),
      _type: 'rule',
      ruleId: {_type: 'slug', current: r.ruleId},
      title: r.title,
      area: r.area,
      severity: r.severity,
      boundary: r.boundary,
      conditions: r.conditions.map((c, i) => ({_key: `c${i}`, _type: 'condition', ...c})),
      nowBehavior: r.nowBehavior,
      afterBumpBehavior: r.afterBumpBehavior,
      fix: r.fix,
      sources: r.sources.map((k) => ({_key: k, _type: 'reference', _ref: sourceId(k)})),
      verified: Boolean(r.verified),
    })
  }

  for (const [key, s] of Object.entries(FINDING_SOURCES)) {
    tx.createOrReplace({_id: sourceId(key), _type: 'source', ...s})
  }

  for (const f of FINDINGS) {
    tx.createOrReplace({
      _id: `docsFinding-${f.id}`,
      _type: 'docsFinding',
      title: f.title,
      kind: f.kind,
      claimA: {source: {_type: 'reference', _ref: sourceId(f.claimA.source)}, text: f.claimA.text},
      claimB: {source: {_type: 'reference', _ref: sourceId(f.claimB.source)}, text: f.claimB.text},
      relatedRules: f.relatedRules.map((id) => ({_key: id, _type: 'reference', _ref: ruleId(id)})),
      resolution: f.resolution,
      kbIssue: f.kbIssue,
      status: f.status,
      reportedVia: f.reportedVia,
    })
  }

  for (const c of EVAL_CASES) {
    tx.createOrReplace({
      _id: `evalCase-${c.id}`,
      _type: 'evalCase',
      name: c.name,
      config: c.config,
      packageJson: c.packageJson,
      expectedRuleIds: c.expectedRuleIds,
      notes: [c.group, c.notes].filter(Boolean).join(': '),
    })
  }

  const res = await tx.commit()
  console.log(
    `Seeded ${Object.keys(SOURCES).length + Object.keys(FINDING_SOURCES).length} sources, ${RULES.length} rules, ` +
      `${FINDINGS.length} docs findings, ${EVAL_CASES.length} eval cases (${res.results.length} mutations).`,
  )

  const verified = await client.fetch<number>('count(*[_type == "rule" && verified])')
  console.log(`GROQ *[_type=="rule" && verified] -> ${verified}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
