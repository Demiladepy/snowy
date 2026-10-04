// Small text renderers shared by server and client components.

/** Inline `code` spans in rule text. */
export function RuleText({text}: {text: string}) {
  return (
    <>
      {text.split(/(`[^`]+`)/g).map((p, i) =>
        p.startsWith('`') && p.endsWith('`') ? (
          <code key={i} className="rounded border border-mist bg-linen px-1 text-graphite">
            {p.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}

/** Plain text with bare URLs turned into links. */
export function Linkified({text}: {text: string}) {
  return (
    <>
      {text.split(/(https?:\/\/[^\s)\]]+)/g).map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noreferrer" className="break-all text-signal underline underline-offset-2">
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}

/** Minimal Markdown for model answers: **bold**, `code`, bare URLs, and "- " bullets. */
export function ModelText({text}: {text: string}) {
  const inline = (s: string, k: string) =>
    s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) =>
      p.startsWith('**') && p.endsWith('**') && p.length > 4 ? (
        <strong key={`${k}-${i}`} className="font-semibold text-graphite">
          {p.slice(2, -2)}
        </strong>
      ) : p.startsWith('`') && p.endsWith('`') && p.length > 2 ? (
        <code key={`${k}-${i}`} className="rounded border border-mist bg-paper px-1 text-graphite">
          {p.slice(1, -1)}
        </code>
      ) : (
        <Linkified key={`${k}-${i}`} text={p} />
      ),
    )
  return (
    <>
      {text.split('\n').map((line, i) => {
        const bullet = /^\s*[-*]\s+/.test(line)
        const body = line.replace(/^\s*[-*]\s+/, '').replace(/^#+\s*/, '')
        return (
          <span key={i} className={bullet ? 'block pl-4 -indent-3' : 'block min-h-[0.8em]'}>
            {bullet ? '• ' : ''}
            {inline(body, String(i))}
          </span>
        )
      })}
    </>
  )
}

export function Eyebrow({children}: {children: React.ReactNode}) {
  return <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-ash">{children}</p>
}
