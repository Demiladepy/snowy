'use client'

import Link from 'next/link'
import {DiscoverButton} from '@/components/block/discover-button'
import {useMemo, useRef, useState} from 'react'
import {ModelText, RuleText} from '../components/text'
import {DEMO_OPS, TIME_MACHINE_STOPS, type DemoOp} from '@/lib/demos'
import {evaluate} from '@/lib/engine'
import {extractFacts} from '@/lib/facts'
import type {FactsSummary, StreamEvent} from '@/lib/ndjson'
import {SAMPLES} from '@/lib/samples'
import {readNdjson} from '@/lib/stream-client'
import type {ApiVersionFact, Facts, Finding, Rule, Severity} from '@/lib/types'

interface Explanation {
  text: string
  kbPaths: string[]
  status: 'streaming' | 'done' | 'error'
  error?: string
}
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  kbPaths?: string[]
}
type StageStatus = 'queued' | 'running' | 'ready' | 'skipped' | 'error'
type DemoStatus = 'queued' | 'running' | 'ready'

const SEVERITY_BADGE: Record<Severity, string> = {
  critical: 'text-critical bg-critical-bg border-critical/30',
  warning: 'text-warning bg-warning-bg border-warning/30',
  info: 'text-info bg-info-bg border-info/30',
}
const SEVERITY_TEXT: Record<Severity, string> = {critical: 'text-critical', warning: 'text-warning', info: 'text-info'}
const SEVERITY_DOT: Record<Severity, string> = {critical: 'bg-critical', warning: 'bg-warning', info: 'bg-info'}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/* ---------- status pill (Queued / In progress / Ready) ---------- */

function StatusPill({status, label}: {status: StageStatus | DemoStatus; label?: string}) {
  const map: Record<string, {cls: string; text: string; icon: React.ReactNode}> = {
    queued: {cls: 'bg-linen text-ash border-transparent', text: 'Queued', icon: <span className="h-1.5 w-1.5 rounded-full bg-fog" />},
    running: {
      cls: 'bg-info-bg text-info border-transparent',
      text: 'In progress',
      icon: <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-info/30 border-t-info" />,
    },
    ready: {
      cls: 'bg-ok-bg text-ok border-transparent',
      text: 'Ready',
      icon: (
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <circle cx="6" cy="6" r="6" className="fill-ok" />
          <path d="M3.5 6.2l1.6 1.6 3.4-3.6" stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </svg>
      ),
    },
    skipped: {cls: 'bg-linen text-ash border-mist', text: 'Skipped', icon: <span className="h-1.5 w-1.5 rounded-full bg-fog" />},
    error: {cls: 'bg-critical-bg text-critical border-critical/30', text: 'Error', icon: <span className="h-1.5 w-1.5 rounded-full bg-critical" />},
  }
  const s = map[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-medium ${s.cls}`}>
      {s.icon}
      {label ?? s.text}
    </span>
  )
}

/* ---------- finding card ---------- */

function FindingCard({finding, explanation, highlight}: {finding: Finding; explanation?: Explanation; highlight?: 'new' | 'gone'}) {
  const [tab, setTab] = useState<'now' | 'bump' | 'fix'>('now')
  const body = tab === 'now' ? finding.nowBehavior : tab === 'bump' ? finding.afterBumpBehavior : finding.fix
  return (
    <article
      className={`rounded-xl border bg-paper p-4 shadow-[var(--shadow-card)] transition-all md:p-5 ${
        highlight === 'gone' ? 'border-dashed border-fog opacity-50' : highlight === 'new' ? 'border-signal' : 'border-mist'
      }`}
    >
      <header className="flex flex-wrap items-center gap-2">
        <span className={`rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] ${SEVERITY_BADGE[finding.severity]}`}>
          {finding.severity}
        </span>
        {finding.line ? <span className="text-[13px] text-ash">line {finding.line}</span> : null}
        {highlight === 'new' ? <span className="text-[12px] font-medium text-signal">appears at this version</span> : null}
        {highlight === 'gone' ? <span className="text-[12px] font-medium text-ash">gone at this version</span> : null}
        {finding.docsFindings?.length ? (
          <Link
            href="/#docs-findings"
            className="rounded border border-signal/50 px-2 py-0.5 text-[11px] font-medium text-signal"
            title={finding.docsFindings.map((d) => d.title).join('\n')}
          >
            Docs disagree here
          </Link>
        ) : null}
      </header>
      <h3 className="font-serif mt-2 text-[20px] leading-[1.3] text-graphite md:text-[22px]">
        <RuleText text={finding.title} />
      </h3>
      <code className="mt-1 block text-[12px] text-ash">{finding.ruleId}</code>

      <div role="tablist" className="mt-4 inline-flex rounded-lg border border-mist bg-linen p-0.5 text-[13px]">
        {(
          [
            ['now', 'Now'],
            ['bump', 'After bump'],
            ['fix', 'Fix'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`rounded-md px-3 py-1 font-medium transition-colors ${tab === id ? 'bg-paper text-graphite shadow-[var(--shadow-diagram)]' : 'text-ash hover:text-graphite'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-[15px] leading-[1.6] text-charcoal">
        <RuleText text={body} />
      </p>

      {explanation ? (
        <div className="mt-4 border-l-2 border-signal/60 bg-linen px-4 py-3 text-[15px] leading-[1.6]">
          <div className="mb-1 text-[12px] font-medium uppercase tracking-[0.06em] text-ash">
            From the Knowledge Base {explanation.status === 'streaming' ? '· writing…' : ''}
          </div>
          {explanation.text ? (
            <div className="text-charcoal">
              <ModelText text={explanation.text} />
            </div>
          ) : explanation.status === 'streaming' ? (
            <p className="text-ash">Reading entries…</p>
          ) : null}
          {explanation.error ? <p className="mt-1 text-[13px] text-critical">{explanation.error}</p> : null}
          {explanation.kbPaths.length ? (
            <details className="mt-2 text-[13px] text-ash">
              <summary className="cursor-pointer">Entries read ({explanation.kbPaths.length})</summary>
              <ul className="mt-1 list-disc pl-5">
                {explanation.kbPaths.map((p) => (
                  <li key={p}>
                    <code>{p}</code>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 border-t border-mist pt-3 text-[13px] leading-[1.5] text-ash">
        <ul className="space-y-1.5">
          {finding.sources.map((s, i) => (
            <li key={i}>
              <a href={s.url} target="_blank" rel="noreferrer" className="font-medium text-charcoal underline decoration-fog underline-offset-2 hover:decoration-charcoal">
                {s.title ?? s.url}
              </a>
              {s.evidence ? (
                <span>
                  {' '}— “<RuleText text={s.evidence} />”
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}

/* ---------- apiVersion time machine (runs the engine in the browser) ---------- */

function overrideVersion(facts: Facts, stop: string): Facts {
  const v: ApiVersionFact = stop === 'v1' ? {kind: 'v1'} : {kind: 'date', value: stop}
  return {
    ...facts,
    // Only clients with a known, static version are moved; dynamic ones stay unknowable.
    clients: facts.clients.map((c) => (c.apiVersion.kind === 'dynamic' || c.apiVersion.kind === 'vX' ? c : {...c, apiVersion: v})),
  }
}

function pinnedLabel(facts: Facts): string {
  const v = facts.clients[0]?.apiVersion
  if (!v) return 'n/a'
  if (v.kind === 'date') return v.value
  if (v.kind === 'dynamic') return 'dynamic'
  return v.kind
}

function TimeMachine({facts, rules, pinnedFindings, stopIndex, setStopIndex}: {facts: Facts; rules: Rule[]; pinnedFindings: Finding[]; stopIndex: number; setStopIndex: (n: number) => void}) {
  const stop = TIME_MACHINE_STOPS[stopIndex]
  const atStop = useMemo(() => evaluate(overrideVersion(facts, stop), rules), [facts, rules, stop])
  const pinnedIds = new Set(pinnedFindings.map((f) => f.ruleId))
  const stopIds = new Set(atStop.map((f) => f.ruleId))
  const appeared = atStop.filter((f) => !pinnedIds.has(f.ruleId))
  const gone = pinnedFindings.filter((f) => !stopIds.has(f.ruleId))
  const staticVersion = facts.clients.some((c) => c.apiVersion.kind !== 'dynamic' && c.apiVersion.kind !== 'vX')

  return (
    <section className="rounded-xl border border-mist bg-paper p-5 shadow-[var(--shadow-card)] md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-serif text-[27px] tracking-[-0.03em] text-graphite">apiVersion time machine</h3>
        <span className="text-[13px] text-ash">
          pinned at <code className="text-charcoal">{pinnedLabel(facts)}</code>
        </span>
      </div>
      <p className="mt-1 text-[14px] leading-[1.5] text-ash">
        Drag to re-pin every static apiVersion in your code. The rule engine re-runs in your browser, with no server and no LLM.
      </p>
      {!staticVersion ? (
        <p className="mt-4 text-[14px] text-warning">This config’s apiVersion isn’t a static value, so there’s nothing to re-pin. That is the finding.</p>
      ) : (
        <>
          <input
            type="range"
            min={0}
            max={TIME_MACHINE_STOPS.length - 1}
            step={1}
            value={stopIndex}
            onChange={(e) => setStopIndex(Number(e.target.value))}
            aria-label="API version"
            className="mt-5 w-full accent-[#282834]"
          />
          <div className="mt-1 flex justify-between font-mono text-[10px] text-ash md:text-[11px]">
            {TIME_MACHINE_STOPS.map((s, i) => (
              <button
                key={s}
                onClick={() => setStopIndex(i)}
                className={`${i === stopIndex ? 'font-semibold text-graphite' : ''} ${s === '2025-02-19' ? 'text-signal' : ''} ${i % 2 ? 'hidden sm:block' : ''}`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-mist bg-linen p-3">
              <div className="text-[12px] uppercase tracking-[0.06em] text-ash">At {stop}</div>
              <div className="font-serif mt-1 text-[32px] leading-none text-graphite">{atStop.length}</div>
              <div className="text-[12px] text-ash">findings</div>
            </div>
            <div className="rounded-lg border border-mist bg-linen p-3">
              <div className="text-[12px] uppercase tracking-[0.06em] text-ash">Appear</div>
              <div className="font-serif mt-1 text-[32px] leading-none text-signal">{appeared.length}</div>
              <div className="truncate text-[12px] text-ash">{appeared.map((f) => f.ruleId).join(', ') || '—'}</div>
            </div>
            <div className="rounded-lg border border-mist bg-linen p-3">
              <div className="text-[12px] uppercase tracking-[0.06em] text-ash">Go away</div>
              <div className="font-serif mt-1 text-[32px] leading-none text-graphite">{gone.length}</div>
              <div className="truncate text-[12px] text-ash">{gone.map((f) => f.ruleId).join(', ') || '—'}</div>
            </div>
          </div>
          {appeared.length || gone.length ? (
            <div className="mt-4 space-y-3">
              {appeared.map((f) => (
                <FindingCard key={`a-${f.ruleId}`} finding={f} highlight="new" />
              ))}
              {gone.map((f) => (
                <FindingCard key={`g-${f.ruleId}`} finding={f} highlight="gone" />
              ))}
            </div>
          ) : (
            <p className="mt-4 text-[14px] text-ash">Nothing changes between your pinned version and {stop}.</p>
          )}
        </>
      )}
    </section>
  )
}

/* ---------- collapsible input ---------- */

function Collapsible({label, value, onChange, placeholder}: {label: string; value: string; onChange: (v: string) => void; placeholder: string}) {
  return (
    <details className="group rounded-xl border border-mist bg-paper" open={Boolean(value)}>
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[15px] font-medium text-charcoal">
        {label}
        <span className="text-ash transition-transform group-open:rotate-45">+</span>
      </summary>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className="block h-32 w-full resize-y rounded-b-xl border-t border-mist bg-linen p-4 font-mono text-[12px] text-charcoal outline-none"
      />
    </details>
  )
}

/* ---------- workbench ---------- */

const STAGES = [
  ['parse', 'Parse code'],
  ['rules', 'Load rules'],
  ['evaluate', 'Evaluate'],
  ['explain', 'Explain with KB'],
] as const
type StageId = (typeof STAGES)[number][0]

export default function Workbench({rules, rulesOrigin}: {rules: Rule[]; rulesOrigin: string}) {
  const [code, setCode] = useState('')
  const [packageJson, setPackageJson] = useState('')
  const [queries, setQueries] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [findings, setFindings] = useState<Finding[] | null>(null)
  const [facts, setFacts] = useState<FactsSummary | null>(null)
  const [meta, setMeta] = useState<{rulesOrigin: string; rulesCount: number; redactions: number; parseErrors: string[]} | null>(null)
  const [notices, setNotices] = useState<string[]>([])
  const [explanations, setExplanations] = useState<Record<string, Explanation>>({})
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)
  const [stages, setStages] = useState<Record<StageId, StageStatus>>({parse: 'queued', rules: 'queued', evaluate: 'queued', explain: 'queued'})
  const [localFacts, setLocalFacts] = useState<Facts | null>(null)
  const [stopIndex, setStopIndex] = useState(TIME_MACHINE_STOPS.indexOf('2025-02-19'))

  const [demoStatus, setDemoStatus] = useState<Record<string, {status: DemoStatus; summary?: string}>>({})
  const [activeDemo, setActiveDemo] = useState<string | null>(null)
  const [tour, setTour] = useState(false)
  const stopTour = useRef(false)

  const [chat, setChat] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [chatBusy, setChatBusy] = useState(false)
  const resultsRef = useRef<HTMLDivElement>(null)

  function patchExplanation(ruleId: string, patch: (e: Explanation) => Explanation) {
    setExplanations((prev) => ({...prev, [ruleId]: patch(prev[ruleId] ?? {text: '', kbPaths: [], status: 'streaming'})}))
  }

  async function analyze(input = {code, packageJson, queries}): Promise<Finding[]> {
    setBusy(true)
    setError(null)
    setFindings(null)
    setFacts(null)
    setMeta(null)
    setNotices([])
    setExplanations({})
    setElapsedMs(null)
    setStages({parse: 'running', rules: 'queued', evaluate: 'queued', explain: 'queued'})
    try {
      setLocalFacts(extractFacts(input))
    } catch {
      setLocalFacts(null)
    }
    const started = performance.now()
    let result: Finding[] = []
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(input),
      })
      setStages((s) => ({...s, parse: 'ready', rules: 'running'}))
      await readNdjson(res, (e: StreamEvent) => {
        switch (e.type) {
          case 'findings':
            result = e.findings
            setFindings(e.findings)
            setFacts(e.facts)
            setMeta({rulesOrigin: e.rulesOrigin, rulesCount: e.rulesCount, redactions: e.redactions, parseErrors: e.parseErrors})
            setElapsedMs(Math.round(performance.now() - started))
            setStages((s) => ({...s, parse: 'ready', rules: 'ready', evaluate: 'ready', explain: e.findings.length ? 'running' : 'skipped'}))
            break
          case 'explain-start':
            patchExplanation(e.ruleId, (x) => ({...x, status: 'streaming'}))
            break
          case 'text':
            if (e.ruleId) patchExplanation(e.ruleId, (x) => ({...x, text: x.text + e.text}))
            break
          case 'kb-read':
            if (e.ruleId) patchExplanation(e.ruleId, (x) => ({...x, kbPaths: [...new Set([...x.kbPaths, ...e.paths])]}))
            break
          case 'explain-end':
            patchExplanation(e.ruleId, (x) => ({...x, status: x.status === 'error' ? 'error' : 'done'}))
            break
          case 'error':
            if (e.ruleId) patchExplanation(e.ruleId, (x) => ({...x, status: 'error', error: e.message}))
            else setError(e.message)
            break
          case 'notice':
            setNotices((n) => [...n, e.message])
            if (/Explanations are off/.test(e.message)) setStages((s) => ({...s, explain: 'skipped'}))
            break
          case 'done':
            setStages((s) => ({...s, explain: s.explain === 'running' ? 'ready' : s.explain}))
            break
        }
      })
    } catch (err) {
      setError((err as Error).message)
      setStages((s) => ({...s, parse: s.parse === 'running' ? 'error' : s.parse}))
    } finally {
      setBusy(false)
    }
    return result
  }

  async function runDemo(op: DemoOp) {
    setActiveDemo(op.id)
    setCode(op.code)
    setPackageJson(op.packageJson ?? '')
    setQueries('')
    setDemoStatus((d) => ({...d, [op.id]: {status: 'running'}}))
    resultsRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'})
    const found = await analyze({code: op.code, packageJson: op.packageJson ?? '', queries: ''})
    if (op.bumpTo) setStopIndex(TIME_MACHINE_STOPS.indexOf(op.bumpTo))
    const crit = found.filter((f) => f.severity === 'critical').length
    setDemoStatus((d) => ({
      ...d,
      [op.id]: {status: 'ready', summary: found.length ? `${found.length} finding${found.length > 1 ? 's' : ''}${crit ? ` · ${crit} critical` : ''}` : 'no findings'},
    }))
  }

  async function runTour() {
    setTour(true)
    stopTour.current = false
    setDemoStatus(Object.fromEntries(DEMO_OPS.map((d) => [d.id, {status: 'queued' as DemoStatus}])))
    for (const op of DEMO_OPS) {
      if (stopTour.current) break
      await runDemo(op)
      await sleep(2600)
    }
    setTour(false)
  }

  async function ask() {
    const q = question.trim()
    if (!q) return
    const history: ChatMessage[] = [...chat, {role: 'user', content: q}]
    setChat([...history, {role: 'assistant', content: '', kbPaths: []}])
    setQuestion('')
    setChatBusy(true)
    const summary = findings?.map((f) => `- [${f.severity}] ${f.ruleId}: ${f.title}${f.line ? ` (line ${f.line})` : ''}`).join('\n') ?? ''
    const updateLast = (fn: (m: ChatMessage) => ChatMessage) => setChat((c) => [...c.slice(0, -1), fn(c[c.length - 1])])
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({messages: history.map(({role, content}) => ({role, content})), findingsSummary: summary}),
      })
      await readNdjson(res, (e) => {
        if (e.type === 'text') updateLast((m) => ({...m, content: m.content + e.text}))
        else if (e.type === 'kb-read') updateLast((m) => ({...m, kbPaths: [...new Set([...(m.kbPaths ?? []), ...e.paths])]}))
        else if (e.type === 'error') updateLast((m) => ({...m, content: m.content + `\n\n⚠ ${e.message}`}))
      })
    } catch (err) {
      updateLast((m) => ({...m, content: `⚠ ${(err as Error).message}`}))
    } finally {
      setChatBusy(false)
    }
  }

  const counts = findings?.reduce<Record<string, number>>((acc, f) => ({...acc, [f.severity]: (acc[f.severity] ?? 0) + 1}), {})
  const canAnalyze = !busy && Boolean(code.trim() || packageJson.trim() || queries.trim())
  const activeOp = DEMO_OPS.find((d) => d.id === activeDemo)

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pt-12 md:px-6">
      {/* Demo ops */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-ash">Demo ops</p>
            <h1 className="font-serif mt-2 text-[40px] leading-[1.1] tracking-[-0.02em] text-graphite md:text-[48px]">Six configs. One engine. Every claim cited.</h1>
            <p className="mt-3 text-[16px] leading-[1.5] text-ash">
              Run one scenario, or the whole tour. Each one is a real config analyzed live against {rules.length} rules from{' '}
              {rulesOrigin === 'dataset' ? 'the Sanity dataset' : 'the bundled seed'}.
            </p>
          </div>
          <DiscoverButton
            className="is-compact"
            label={tour ? 'Stop the tour' : 'Run the full tour'}
            onClick={() => {
              if (tour) stopTour.current = true
              else void runTour()
            }}
          />
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DEMO_OPS.map((op, i) => {
            const st = demoStatus[op.id]
            return (
              <button
                key={op.id}
                onClick={() => void runDemo(op)}
                disabled={busy}
                className={`group rounded-xl border bg-paper p-4 text-left transition-colors hover:bg-linen disabled:cursor-wait ${
                  activeDemo === op.id ? 'border-graphite ring-1 ring-graphite' : 'border-mist'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[12px] text-ash">0{i + 1}</span>
                  {st ? <StatusPill status={st.status} label={st.status === 'ready' ? st.summary : undefined} /> : null}
                </div>
                <h2 className="font-serif mt-2 text-[22px] leading-[1.2] tracking-[-0.03em] text-graphite">{op.title}</h2>
                <p className="mt-1 text-[14px] leading-[1.5] text-ash">{op.pitch}</p>
              </button>
            )
          })}
        </div>
      </section>

      {/* Workbench */}
      <section ref={resultsRef} className="mt-12 scroll-mt-24 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[18px] font-medium text-graphite">{activeOp ? activeOp.title : 'Your config'}</h2>
            <div className="flex gap-2">
              {SAMPLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setCode(s.code)
                    setPackageJson(s.packageJson ?? '')
                    setQueries(s.queries ?? '')
                    setActiveDemo(null)
                  }}
                  className="hidden text-[12px] text-ash underline-offset-2 hover:text-graphite hover:underline md:block"
                >
                  {s.label.split(' ')[0] === 'Modern' ? 'modern' : s.label.split(' ')[0] === 'Studio' ? 'studio' : 'tutorial'}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              setActiveDemo(null)
            }}
            aria-label="Client config"
            placeholder={`Paste your Sanity client config…\n\nexport const client = createClient({\n  projectId: '…',\n  dataset: 'production',\n  apiVersion: '2024-01-01',\n  token: process.env.SANITY_TOKEN,\n})`}
            spellCheck={false}
            className="block h-80 w-full resize-y rounded-xl border border-mist bg-paper p-4 font-mono text-[12px] leading-[1.6] text-charcoal shadow-[var(--shadow-card)] outline-none placeholder:text-fog focus:border-fog"
          />
          <Collapsible label="package.json" value={packageJson} onChange={setPackageJson} placeholder='{"dependencies": {"next-sanity": "^9.0.0"}}' />
          <Collapsible label="GROQ queries" value={queries} onChange={setQueries} placeholder={'*[_type == "post"]{title}\n\n*[sanity::partOfRelease($id)]'} />
          <button
            onClick={() => void analyze()}
            disabled={!canAnalyze}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-graphite px-4 py-3 text-[15px] font-medium text-white transition-opacity hover:bg-brand disabled:cursor-not-allowed disabled:opacity-30"
          >
            {busy ? 'Analyzing…' : 'Analyze →'}
          </button>
          <p className="text-[13px] leading-[1.4] text-ash">Tokens and long secrets are redacted before anything reaches the LLM. Nothing is stored.</p>
        </div>

        <div className="space-y-4" aria-live="polite">
          {/* pipeline */}
          <ol className="grid grid-cols-2 gap-2 rounded-xl border border-mist bg-linen p-2 sm:grid-cols-4">
            {STAGES.map(([id, label], i) => (
              <li key={id} className="flex min-w-0 flex-col gap-1.5 rounded-lg bg-white px-3 py-2 shadow-[var(--shadow-diagram)]">
                <span className="truncate text-[12px] font-medium text-ash">
                  {i + 1}. {label}
                </span>
                <StatusPill status={stages[id]} />
              </li>
            ))}
          </ol>

          {error ? <div className="rounded-xl border border-critical/40 bg-critical-bg p-4 text-[15px] text-critical">{error}</div> : null}
          {!findings && !error ? (
            <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-mist bg-linen p-8 text-center">
              <p className="font-serif max-w-sm text-[27px] leading-[1.25] tracking-[-0.03em] text-ash">
                {busy ? 'Reading your config…' : 'Pick a demo op above, or paste your own config.'}
              </p>
            </div>
          ) : null}
          {findings ? (
            <>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="font-serif text-[27px] tracking-[-0.03em] text-graphite">
                  {findings.length === 0 ? 'No findings. You’re pinned safely.' : `${findings.length} finding${findings.length === 1 ? '' : 's'}`}
                </span>
                {counts
                  ? (['critical', 'warning', 'info'] as const)
                      .filter((s) => counts[s])
                      .map((s) => (
                        <span key={s} className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${SEVERITY_TEXT[s]}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${SEVERITY_DOT[s]}`} />
                          {counts[s]} {s}
                        </span>
                      ))
                  : null}
              </div>
              <p className="text-[13px] text-ash">
                {meta?.rulesCount} rules from {meta?.rulesOrigin === 'dataset' ? 'the Sanity dataset' : 'the bundled seed'}
                {elapsedMs != null ? ` · ${elapsedMs} ms` : ''}
                {meta?.redactions ? ` · ${meta.redactions} secret-looking value(s) redacted` : ''}
              </p>
              {meta?.parseErrors.length ? <p className="text-[13px] text-warning">Parsed with recovery: {meta.parseErrors[0]}</p> : null}
              {notices.map((n, i) => (
                <p key={i} className="text-[13px] text-ash">
                  {n}
                </p>
              ))}
              {facts && facts.clients.length ? (
                <details className="rounded-xl border border-mist bg-paper text-[13px]">
                  <summary className="cursor-pointer px-4 py-3 font-medium text-charcoal">What Pinned read from your code</summary>
                  <div className="overflow-x-auto border-t border-mist px-4 py-3">
                    <table className="w-full text-left">
                      <thead className="text-ash">
                        <tr>
                          {['line', 'call', 'apiVersion', 'perspective', 'token', 'useCdn'].map((h) => (
                            <th key={h} className="pb-1 pr-4 font-medium">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="font-mono text-[12px] text-charcoal">
                        {facts.clients.map((c, i) => (
                          <tr key={i} className="border-t border-mist">
                            <td className="py-1 pr-4">{c.line}</td>
                            <td className="py-1 pr-4">{c.callSite}</td>
                            <td className="py-1 pr-4">{c.apiVersion}</td>
                            <td className="py-1 pr-4">{c.perspective}</td>
                            <td className="py-1 pr-4">{c.token ? 'yes' : 'no'}</td>
                            <td className="py-1">{c.useCdn}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-2 text-ash">
                      {facts.queries} quer{facts.queries === 1 ? 'y' : 'ies'} · {facts.listenCalls} listener(s)
                      {Object.keys(facts.packages).length ? ' · ' + Object.entries(facts.packages).map(([k, v]) => `${k}@${v}`).join(', ') : ''}
                    </p>
                  </div>
                </details>
              ) : null}
              {findings.map((f) => (
                <FindingCard key={f.ruleId} finding={f} explanation={explanations[f.ruleId]} />
              ))}
              {localFacts && localFacts.clients.length ? (
                <TimeMachine facts={localFacts} rules={rules} pinnedFindings={findings} stopIndex={stopIndex} setStopIndex={setStopIndex} />
              ) : null}
            </>
          ) : null}
        </div>
      </section>

      {/* Follow-up chat */}
      <section className="mt-12 rounded-xl border border-mist bg-paper p-5 shadow-[var(--shadow-card)] md:p-6">
        <h2 className="font-serif text-[27px] tracking-[-0.03em] text-graphite">Ask a follow-up</h2>
        <p className="mt-1 text-[13px] text-ash">Answers come from the Knowledge Base built on Sanity’s docs, and from Pinned’s rules.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {['What exactly changes if I bump to 2025-02-19?', 'Why is previewDrafts deprecated?', 'How do I preview a Content Release?'].map((q) => (
            <button key={q} onClick={() => setQuestion(q)} className="rounded-full border border-mist bg-linen px-3 py-1 text-[13px] text-charcoal hover:border-fog">
              {q}
            </button>
          ))}
        </div>
        {chat.length ? (
          <div className="mt-4 space-y-4">
            {chat.map((m, i) =>
              m.role === 'user' ? (
                <p key={i} className="text-[15px] font-medium text-graphite">
                  {m.content}
                </p>
              ) : (
                <div key={i} className="border-l-2 border-mist pl-4 text-[15px] leading-[1.6] text-charcoal">
                  <div>
                    <ModelText text={m.content || (chatBusy && i === chat.length - 1 ? '…' : '')} />
                  </div>
                  {m.kbPaths?.length ? (
                    <details className="mt-1 text-[13px] text-ash">
                      <summary className="cursor-pointer">Sources read ({m.kbPaths.length})</summary>
                      <ul className="mt-1 list-disc pl-5">
                        {m.kbPaths.map((p) => (
                          <li key={p}>
                            <code>{p}</code>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
              ),
            )}
          </div>
        ) : null}
        <form
          className="mt-4 flex items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            void ask()
          }}
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about perspectives, releases, versions…"
            aria-label="Follow-up question"
            className="min-w-0 flex-1 border-0 border-b border-charcoal bg-linen px-3 py-2.5 text-[15px] text-charcoal outline-none placeholder:text-fog focus:border-twilight"
          />
          <button disabled={chatBusy || !question.trim()} className="rounded-full bg-graphite px-5 py-2.5 transition-colors hover:bg-brand text-[15px] font-medium text-white disabled:opacity-40">
            Ask
          </button>
        </form>
      </section>
    </div>
  )
}
