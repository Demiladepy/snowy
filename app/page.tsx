import Link from 'next/link'
import {DiscoverButton} from '@/components/block/discover-button'
import {FlipText} from '@/components/block/flip-text'
import RuleMarquee from './components/RuleMarquee'
import {Eyebrow, RuleText} from './components/text'
import {loadDocsFindings, loadRules} from '@/lib/rules'
import {publicDatasetUrl} from '@/lib/sanity'
import evalResults from '@/evals/results.json'

export const revalidate = 300

const TUTORIAL = [
  ['', "import {createClient} from 'next-sanity'"],
  ['', ''],
  ['', 'export const client = createClient({'],
  ['', "  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,"],
  ['', "  dataset: 'production',"],
  ['hit', "  apiVersion: '2024-01-01',"],
  ['', '  useCdn: false,'],
  ['hit', '  token: process.env.SANITY_API_READ_TOKEN,'],
  ['miss', '  // perspective: (not set)'],
  ['', '})'],
] as const

function Hero() {
  return (
    <section className="mx-auto max-w-[1200px] px-4 pt-16 text-center md:px-6 md:pt-24">
      <span className="inline-flex items-center gap-2 rounded-full border border-mist bg-linen px-3 py-1 text-[13px] font-medium text-charcoal">
        <span className="h-1.5 w-1.5 rounded-full bg-signal" />
        Sanity Challenge · built on Sanity Context
      </span>
      <h1 className="font-serif mx-auto mt-6 max-w-4xl text-[44px] leading-[1.05] text-graphite md:text-[72px]">
        Your apiVersion is a promise.
        <br />
        Pinned reads the{' '}
        <FlipText className="text-signal" duration={2.6}>
          fine print.
        </FlipText>
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-[18px] leading-[1.55] text-ash md:text-[20px]">
        Paste a Sanity client config. See what it does <em>today</em> at the version you pinned, what silently changes when you bump
        it, and where Sanity’s own docs disagree with themselves, with every claim cited.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <DiscoverButton label="Run the demo ops" href="/analyze" />
        <a href="#problem" className="text-[15px] font-medium text-charcoal underline decoration-fog underline-offset-4 hover:decoration-charcoal">
          Why this exists ↓
        </a>
      </div>
      <ProductPreview />
    </section>
  )
}

function ProductPreview() {
  return (
    <div className="mx-auto mt-14 max-w-5xl overflow-hidden rounded-2xl border border-mist bg-white text-left shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 border-b border-mist bg-linen px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-fog" />
        <span className="h-2.5 w-2.5 rounded-full bg-fog" />
        <span className="h-2.5 w-2.5 rounded-full bg-fog" />
        <span className="ml-3 truncate font-mono text-[12px] text-ash">pinned-snowy.vercel.app/analyze</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2">
        <pre className="overflow-x-auto border-b border-mist p-4 font-mono text-[12px] leading-[1.75] text-charcoal md:border-b-0 md:border-r">
          {TUTORIAL.map(([kind, text], i) => (
            <div key={i} className={`-mx-4 flex px-4 ${kind === 'hit' ? 'bg-warning-bg' : kind === 'miss' ? 'bg-critical-bg text-critical' : ''}`}>
              <span className="mr-4 w-4 select-none text-right text-fog">{i + 1}</span>
              <span>{text || ' '}</span>
            </div>
          ))}
        </pre>
        <div className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {['Parse', 'Rules', 'Evaluate', 'Explain'].map((s) => (
              <span key={s} className="flex items-center justify-between rounded-md bg-ok-bg px-2 py-1 text-[11px] font-medium text-ok">
                {s} <span aria-hidden>✓</span>
              </span>
            ))}
          </div>
          <div className="rounded-lg border border-mist p-3">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="rounded bg-critical-bg px-1.5 py-0.5 font-semibold uppercase text-critical">critical</span>
              <span className="text-ash">line 6</span>
              <span className="ml-auto rounded border border-signal/40 px-1.5 py-0.5 text-signal">Docs disagree here</span>
            </div>
            <div className="mt-2 text-[16px] font-semibold text-graphite">Unpublished drafts are served to your site</div>
            <p className="mt-1 text-[13px] leading-[1.5] text-ash">
              Token + apiVersion before 2025-02-19 + no perspective → default is <code>raw</code>, so <code>drafts.*</code> reach production.
            </p>
          </div>
          <div className="rounded-lg bg-linen p-3">
            <div className="flex items-center justify-between text-[11px] font-medium text-ash">
              <span>apiVersion time machine</span>
              <span className="font-mono text-signal">2025-02-19</span>
            </div>
            <div className="relative mt-2 h-1.5 rounded-full bg-mist">
              <div className="absolute inset-y-0 left-0 w-[62%] rounded-full bg-graphite" />
              <div className="absolute top-1/2 left-[62%] h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-graphite shadow" />
            </div>
            <p className="mt-2 text-[12px] text-charcoal">
              Bump here → <span className="font-semibold">drafts-leak-raw-default</span> goes away
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Problem() {
  return (
    <section id="problem" className="mx-auto mt-24 max-w-[1200px] scroll-mt-24 px-4 md:px-6">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        <div>
          <Eyebrow>The 20-second problem</Eyebrow>
          <h2 className="font-serif mt-3 text-[40px] leading-[1.1] tracking-[-0.02em] text-graphite md:text-[48px]">
            Three ordinary lines. Your unpublished drafts are live.
          </h2>
          <p className="mt-4 text-[16px] leading-[1.5] text-ash">
            This is the client from countless 2024 tutorials. It sends a token, pins a version before <code>2025-02-19</code>, and never
            sets a perspective. At that version the default perspective is <code>raw</code>, and authenticated <code>raw</code> queries return{' '}
            <code>drafts.*</code> documents next to published ones.
          </p>
          <p className="mt-3 text-[16px] leading-[1.5] text-ash">
            Bump the version and the default flips to <code>published</code>. The leak stops, and any preview code built on it silently
            goes blank. Nothing in your code changed.
          </p>
        </div>
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-mist bg-paper shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between border-b border-mist bg-linen px-4 py-2 text-[12px] text-ash">
              <span className="font-mono">sanity/lib/client.ts</span>
              <span className="rounded border border-critical/30 bg-critical-bg px-2 py-0.5 font-semibold uppercase tracking-[0.06em] text-critical">critical</span>
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-[1.7] text-charcoal">
              {TUTORIAL.map(([kind, text], i) => (
                <div key={i} className={`-mx-4 flex px-4 ${kind === 'hit' ? 'bg-warning-bg' : kind === 'miss' ? 'bg-critical-bg text-critical' : ''}`}>
                  <span className="mr-4 w-4 select-none text-right text-fog">{i + 1}</span>
                  <span>{text || ' '}</span>
                </div>
              ))}
            </pre>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-mist bg-paper p-4">
              <div className="text-[12px] font-medium uppercase tracking-[0.06em] text-critical">Now · 2024-01-01</div>
              <p className="mt-1 text-[14px] leading-[1.5] text-charcoal">
                Default <code>raw</code>. Drafts are served to your production site.
              </p>
            </div>
            <div className="rounded-xl border border-mist bg-paper p-4">
              <div className="text-[12px] font-medium uppercase tracking-[0.06em] text-signal">After bump · 2025-02-19</div>
              <p className="mt-1 text-[14px] leading-[1.5] text-charcoal">
                Default <code>published</code>. The leak stops, and drafts vanish from anything that relied on them.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Thesis() {
  return (
    <section className="mx-auto mt-24 max-w-[1200px] px-4 md:px-6">
      <div className="rounded-3xl border border-mist bg-paper p-6 shadow-[var(--shadow-diagram)] md:p-12">
        <Eyebrow>The thesis</Eyebrow>
        <h2 className="font-serif mt-3 max-w-3xl text-[40px] leading-[1.1] tracking-[-0.02em] text-graphite md:text-[48px]">
          Some contradictions in the docs aren’t errors. They’re versions.
        </h2>
        <p className="mt-4 max-w-2xl text-[16px] leading-[1.5] text-ash">
          A Knowledge Base build flags conflicting claims and asks which one is ground truth. For a versioned API that’s the wrong question.
          Both of these are true, on either side of one date:
        </p>
        <div className="relative mt-10">
          <div className="absolute left-0 right-0 top-[18px] h-px bg-mist" />
          <div className="absolute left-1/2 top-0 h-9 w-px bg-signal" />
          <div className="absolute left-1/2 top-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-signal px-2 py-0.5 font-mono text-[12px] text-signal">
            2025-02-19
          </div>
          <div className="grid gap-6 pt-20 md:grid-cols-2">
            <blockquote className="rounded-xl border border-mist bg-linen p-5">
              <p className="font-serif text-[24px] leading-[1.3] tracking-[-0.03em] text-graphite">“The default perspective is raw.”</p>
              <p className="mt-2 text-[13px] text-ash">True for every API version before 2025-02-19.</p>
            </blockquote>
            <blockquote className="rounded-xl border border-mist bg-linen p-5">
              <p className="font-serif text-[24px] leading-[1.3] tracking-[-0.03em] text-graphite">“The default perspective is published.”</p>
              <p className="mt-2 text-[13px] text-ash">True from 2025-02-19 onwards.</p>
            </blockquote>
          </div>
        </div>
        <p className="mt-8 max-w-2xl text-[16px] leading-[1.5] text-ash">
          So Pinned models each boundary as structured data, uses Knowledge Base <strong className="font-medium text-charcoal">Instructions</strong> to
          keep the build from collapsing them, and reserves “wrong” for claims that are wrong at <em>every</em> version.
        </p>
      </div>
    </section>
  )
}

function HowItWorks({rulesCount}: {rulesCount: number}) {
  const steps = [
    ['Parse', 'Your code becomes a Babel AST, then typed facts: apiVersion, perspective, token, useCdn, call sites, queries, packages.'],
    ['Load rules', `${rulesCount} version-change rules live in a public Sanity dataset as documents with typed conditions, boundaries, and quoted sources.`],
    ['Evaluate', 'A deterministic engine fires a rule only when every condition holds. The model never decides what’s wrong.'],
    ['Explain', 'An agent on Sanity Context MCP reads a Knowledge Base built from Sanity’s docs and changelog, and cites the entries it used.'],
  ]
  return (
    <section id="how" className="mx-auto mt-24 grid max-w-[1200px] scroll-mt-24 grid-cols-1 gap-10 px-4 md:grid-cols-2 md:px-6">
      <div>
        <Eyebrow>How it works</Eyebrow>
        <h2 className="font-serif mt-3 text-[40px] leading-[1.1] tracking-[-0.02em] text-graphite md:text-[48px]">
          Rules are content. Findings are computed. The model only explains.
        </h2>
        <p className="mt-4 max-w-lg text-[16px] leading-[1.5] text-ash">A keyword search can find the page about perspectives. It can’t evaluate this against your code:</p>
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {['callSite in createClient,withConfig', 'token is present', 'apiVersion < 2025-02-19', 'perspective is unset'].map((c, i) => (
            <span key={c} className="flex items-center gap-1.5">
              {i > 0 ? <span className="text-[11px] font-medium text-fog">AND</span> : null}
              <code className="rounded-md border border-mist bg-linen px-2 py-0.5 text-[12px] text-charcoal">{c}</code>
            </span>
          ))}
        </div>
        <p className="mt-4 max-w-lg text-[16px] leading-[1.5] text-ash">
          That rule is a document in the dataset. So is every source it quotes.{' '}
          <Link href="/rules" className="text-signal underline underline-offset-2">
            See all rules
          </Link>
          .
        </p>
      </div>
      <div className="rounded-2xl border border-mist bg-white/80 p-3 shadow-[var(--shadow-diagram)]">
        <ol className="divide-y divide-mist">
          {steps.map(([title, body], i) => (
            <li key={title} className="flex gap-4 p-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-twilight/80 font-mono text-[13px] text-twilight">{i + 1}</span>
              <div>
                <h3 className="text-[18px] font-medium leading-[1.3] text-graphite">{title}</h3>
                <p className="mt-1 text-[15px] leading-[1.5] text-ash">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

const KIND_LABEL: Record<string, string> = {versionScoped: 'Version-scoped', stale: 'Stale', wrong: 'Wrong', coverageGap: 'Coverage gap'}

async function DocsFindings() {
  const findings = await loadDocsFindings()
  if (!findings.length) return null
  return (
    <section id="docs-findings" className="mx-auto mt-24 max-w-[1200px] scroll-mt-24 px-4 md:px-6">
      <Eyebrow>Docs findings</Eyebrow>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <h2 className="font-serif text-[40px] leading-[1.1] tracking-[-0.02em] text-graphite md:text-[48px]">Where Sanity’s docs disagree with themselves</h2>
        <p className="self-end text-[16px] leading-[1.5] text-ash">
          Found while building the Knowledge Base and checked by hand on the live pages. Each one is a <code>docsFinding</code> document
          linked to the rules it affects. Version-scoped conflicts get an Instruction rather than a winner.
        </p>
      </div>
      <div className="mt-8 space-y-4">
        {findings.map((f) => (
          <article key={f._id} className="rounded-xl border border-mist bg-paper p-5 shadow-[var(--shadow-card)] md:p-6">
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <span className={`rounded border px-2 py-0.5 font-semibold uppercase tracking-[0.06em] ${f.kind === 'versionScoped' ? 'border-signal/50 text-signal' : f.kind === 'wrong' ? 'border-critical/30 bg-critical-bg text-critical' : 'border-warning/30 bg-warning-bg text-warning'}`}>
                {KIND_LABEL[f.kind] ?? f.kind}
              </span>
              <span className="text-ash">status: {f.status}</span>
              {f.relatedRules?.length ? (
                <span className="text-ash">
                  · affects{' '}
                  {f.relatedRules.map((r, i) => (
                    <span key={r}>
                      {i ? ', ' : ''}
                      <a className="underline decoration-fog underline-offset-2" href={`/rules#${r}`}>
                        <code>{r}</code>
                      </a>
                    </span>
                  ))}
                </span>
              ) : null}
            </div>
            <h3 className="font-serif mt-2 text-[24px] leading-[1.25] tracking-[-0.03em] text-graphite">
              <RuleText text={f.title} />
            </h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[f.claimA, f.claimB].map((c, i) =>
                c ? (
                  <div key={i} className="rounded-lg border border-mist bg-linen p-4 text-[14px] leading-[1.55] text-charcoal">
                    <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-ash">Claim {i ? 'B' : 'A'}</div>
                    <RuleText text={c.text ?? ''} />
                    {c.source ? (
                      <a href={c.source.url} target="_blank" rel="noreferrer" className="mt-2 block text-[12px] text-ash underline decoration-fog underline-offset-2">
                        {c.source.title ?? c.source.url} ↗
                      </a>
                    ) : null}
                  </div>
                ) : null,
              )}
            </div>
            {f.resolution ? (
              <p className="mt-4 border-l-2 border-signal/60 pl-4 text-[14px] leading-[1.55] text-charcoal">
                <span className="font-medium">Resolution · </span>
                <RuleText text={f.resolution} />
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}

type Metrics = {precision: number; recall: number; exactCases: number; cases: number; boundaryCorrect: number; boundaryTotal: number; citedCases: number; falseCriticalsOnModern: number}

function Eval() {
  const arms = (evalResults as {arms: Partial<Record<'A' | 'B' | 'C', {metrics: Metrics}>>}).arms
  const label = {A: 'Model alone', B: 'Model + Knowledge Base', C: 'Pinned (rules + engine)'}
  const pct = (n: number) => `${Math.round(n * 100)}%`
  return (
    <section className="mx-auto mt-24 max-w-[1200px] px-4 md:px-6">
      <Eyebrow>Evaluation</Eyebrow>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <h2 className="font-serif text-[40px] leading-[1.1] tracking-[-0.02em] text-graphite md:text-[48px]">15 configs, three arms</h2>
        <p className="self-end text-[16px] leading-[1.5] text-ash">
          Five old tutorials, four Studio plugins, three correct modern configs, three tricky ones. The same review prompt is given to a model
          alone, to a model with the Knowledge Base, and to Pinned.
        </p>
      </div>
      <div className="mt-8 overflow-x-auto rounded-xl border border-mist bg-paper shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[640px] text-left text-[14px]">
          <thead className="border-b border-mist bg-linen text-[12px] uppercase tracking-[0.06em] text-ash">
            <tr>
              {['Arm', 'Precision', 'Recall', 'Exact', 'Boundary date right', 'Cited', 'False criticals'].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-charcoal">
            {(['A', 'B', 'C'] as const).map((a) => {
              const m = arms[a]?.metrics
              return (
                <tr key={a} className="border-t border-mist">
                  <td className="px-4 py-3 font-medium text-graphite">{label[a]}</td>
                  {m ? (
                    <>
                      <td className="px-4 py-3">{pct(m.precision)}</td>
                      <td className="px-4 py-3">{pct(m.recall)}</td>
                      <td className="px-4 py-3">
                        {m.exactCases}/{m.cases}
                      </td>
                      <td className="px-4 py-3">{m.boundaryTotal ? `${m.boundaryCorrect}/${m.boundaryTotal}` : '—'}</td>
                      <td className="px-4 py-3">
                        {m.citedCases}/{m.cases}
                      </td>
                      <td className="px-4 py-3">{m.falseCriticalsOnModern}</td>
                    </>
                  ) : (
                    <td className="px-4 py-3 text-ash" colSpan={6}>
                      Pending: this arm needs an LLM key and runs with <code>npm run eval</code>.
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 max-w-3xl text-[13px] leading-[1.5] text-ash">
        Honest caveat: the cases were written alongside the rules, so Pinned’s row shows the engine matches its documented rules, not held-out
        accuracy. Boundary dates in Pinned’s row come from rule documents, so they’re correct by construction. Full per-case table in{' '}
        <code>evals/results.md</code>.
      </p>
    </section>
  )
}

function Cta() {
  return (
    <section className="mx-auto mt-24 max-w-[1200px] px-4 md:px-6">
      <div className="rounded-3xl bg-linen px-6 py-14 text-center md:py-20">
        <h2 className="font-serif mx-auto max-w-2xl text-[36px] leading-[1.1] text-graphite md:text-[52px]">Check the client you shipped last year.</h2>
        <p className="mx-auto mt-4 max-w-xl text-[17px] leading-[1.5] text-ash">
          No login. Nothing stored. Findings in under a second, with explanations cited from Sanity’s docs.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <DiscoverButton label="Open Pinned" href="/analyze" />
          <a href={publicDatasetUrl} target="_blank" rel="noreferrer" className="text-[15px] font-medium text-charcoal underline decoration-fog underline-offset-4 hover:decoration-charcoal">
            Query the public dataset ↗
          </a>
        </div>
      </div>
    </section>
  )
}

export default async function Home() {
  const {rules} = await loadRules()
  return (
    <>
      <Hero />
      <section className="mt-20 border-y border-mist bg-linen py-8">
        <p className="mb-5 text-center text-[13px] font-medium text-ash">{rules.length} version-change rules, stored as Sanity documents. Drag to browse.</p>
        <RuleMarquee
          items={rules.map((r) => ({id: r.ruleId, ruleId: r.ruleId, title: r.title, boundary: r.boundary?.apiVersion, severity: r.severity}))}
        />
      </section>
      <Problem />
      <Thesis />
      <HowItWorks rulesCount={rules.length} />
      <DocsFindings />
      <Eval />
      <Cta />
    </>
  )
}
