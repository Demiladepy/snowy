import type {Metadata} from 'next'
import {RuleText} from '../components/text'
import {loadRules} from '@/lib/rules'
import {publicDatasetUrl} from '@/lib/sanity'
import type {Condition, Severity} from '@/lib/types'

export const revalidate = 300
export const metadata: Metadata = {title: 'Rules · Pinned'}

const OP_LABEL: Record<Condition['op'], string> = {
  lt: '<',
  gte: '≥',
  missing: 'is missing',
  dynamic: 'is computed',
  equals: '=',
  in: 'in',
  unset: 'is unset',
  present: 'is present',
  absent: 'is absent',
  matches: 'matches',
  satisfies: 'satisfies',
}

const DOT: Record<Severity, string> = {critical: 'bg-critical', warning: 'bg-warning', info: 'bg-info'}

export default async function RulesPage() {
  const {rules, origin} = await loadRules()
  const areas = [...new Set(rules.map((r) => r.area ?? 'other'))]

  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-12 md:px-6">
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-ash">Rule catalogue</p>
          <h1 className="font-serif mt-3 text-[40px] leading-[1.1] tracking-[-0.02em] text-graphite md:text-[54px]">
            Every version boundary, written down as data.
          </h1>
        </div>
        <div className="self-end text-[16px] leading-[1.5] text-ash">
          <p>
            Each rule is a Sanity document with typed conditions, the version where behavior changes, what happens now and after a
            bump, and a verbatim quote from the doc that proves it. The engine fires a rule only when <em>every</em> condition holds.
          </p>
          <p className="mt-3 text-[13px]">
            {rules.length} verified rules · loaded from {origin === 'dataset' ? 'the Sanity dataset' : 'the bundled seed'} ·{' '}
            <a href={publicDatasetUrl} target="_blank" rel="noreferrer" className="text-signal underline underline-offset-2">
              query it yourself ↗
            </a>
          </p>
        </div>
      </div>

      <nav className="mt-10 flex flex-wrap gap-2" aria-label="Rule areas">
        {areas.map((a) => (
          <a key={a} href={`#area-${a}`} className="rounded-lg border border-twilight/70 px-3 py-[5px] text-[13px] font-medium text-twilight hover:border-twilight">
            {a}
          </a>
        ))}
      </nav>

      {areas.map((area) => (
        <section key={area} id={`area-${area}`} className="mt-12 scroll-mt-24">
          <h2 className="border-b border-mist pb-2 text-[18px] font-medium text-graphite">{area}</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {rules
              .filter((r) => (r.area ?? 'other') === area)
              .map((r) => (
                <article key={r.ruleId} id={r.ruleId} className="scroll-mt-24 rounded-xl border border-mist bg-paper p-4 shadow-[var(--shadow-card)] md:p-5">
                  <div className="flex items-center gap-2 text-[13px] text-ash">
                    <span className={`h-1.5 w-1.5 rounded-full ${DOT[r.severity]}`} />
                    {r.severity}
                    {r.boundary?.apiVersion ? <span>· boundary {r.boundary.apiVersion}</span> : null}
                  </div>
                  <h3 className="font-serif mt-2 text-[24px] leading-[1.2] tracking-[-0.03em] text-graphite">
                    <RuleText text={r.title} />
                  </h3>
                  <code className="text-[12px] text-ash">{r.ruleId}</code>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {r.conditions.map((c, i) => (
                      <span key={i} className="flex items-center gap-1.5">
                        {i > 0 ? <span className="text-[11px] font-medium text-fog">AND</span> : null}
                        <code className="rounded-md border border-mist bg-linen px-2 py-0.5 text-[12px] text-charcoal">
                          {c.fact} {OP_LABEL[c.op]}
                          {c.value && c.fact !== 'query' ? ` ${c.value}` : c.value ? ' /…/' : ''}
                        </code>
                      </span>
                    ))}
                  </div>

                  <dl className="mt-4 space-y-2 text-[14px] leading-[1.55]">
                    <div>
                      <dt className="text-[12px] font-medium uppercase tracking-[0.06em] text-ash">Now</dt>
                      <dd className="text-charcoal">
                        <RuleText text={r.nowBehavior} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[12px] font-medium uppercase tracking-[0.06em] text-ash">After bump</dt>
                      <dd className="text-charcoal">
                        <RuleText text={r.afterBumpBehavior} />
                      </dd>
                    </div>
                  </dl>

                  <ul className="mt-4 space-y-1 border-t border-mist pt-3 text-[13px] text-ash">
                    {r.sources.map((s, i) => (
                      <li key={i}>
                        <a href={s.url} target="_blank" rel="noreferrer" className="text-charcoal underline decoration-fog underline-offset-2">
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
                </article>
              ))}
          </div>
        </section>
      ))}
    </div>
  )
}
