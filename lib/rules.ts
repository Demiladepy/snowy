// Load rules from the Sanity dataset with GROQ. Cached in memory for a few minutes.

import type {Rule} from './types'
import {readClient} from './sanity'
import {RULES, SOURCES} from '../scripts/rules-data'

export const RULES_QUERY = `*[_type == "rule" && verified == true]{
  "ruleId": ruleId.current,
  title, area, severity, boundary,
  conditions[]{fact, op, value},
  nowBehavior, afterBumpBehavior, fix, verified,
  "sources": sources[]->{_id, url, title, kind, evidence, retrievedAt},
  "docsFindings": *[_type == "docsFinding" && references(^._id)]{_id, title, kind}
}`

export interface LoadedRules {
  rules: Rule[]
  /** 'dataset' normally; 'bundled-seed' only if the dataset is empty or unreachable (shown in the UI). */
  origin: 'dataset' | 'bundled-seed'
  error?: string
}

const TTL_MS = 5 * 60 * 1000
let cache: {at: number; value: LoadedRules} | null = null

function bundledSeed(error?: string): LoadedRules {
  return {
    rules: RULES.filter((r) => r.verified).map((r) => ({...r, sources: r.sources.map((k) => SOURCES[k])})),
    origin: 'bundled-seed',
    error,
  }
}

export async function loadRules(): Promise<LoadedRules> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value
  let value: LoadedRules
  try {
    const rules = await readClient.fetch<Rule[]>(RULES_QUERY)
    value = rules.length ? {rules, origin: 'dataset'} : bundledSeed('Dataset returned no verified rules')
  } catch (err) {
    value = bundledSeed((err as Error).message)
  }
  cache = {at: Date.now(), value}
  return value
}

export interface DocsFindingView {
  _id: string
  title: string
  kind: 'versionScoped' | 'stale' | 'wrong' | 'coverageGap'
  status: string
  resolution?: string
  claimA?: {text?: string; source?: {url: string; title?: string}}
  claimB?: {text?: string; source?: {url: string; title?: string}}
  relatedRules?: string[]
}

export const FINDINGS_QUERY = `*[_type == "docsFinding"] | order(kind asc){
  _id, title, kind, status, resolution,
  claimA{text, "source": source->{url, title}},
  claimB{text, "source": source->{url, title}},
  "relatedRules": relatedRules[]->ruleId.current
}`

export async function loadDocsFindings(): Promise<DocsFindingView[]> {
  try {
    return await readClient.fetch<DocsFindingView[]>(FINDINGS_QUERY)
  } catch {
    return []
  }
}
