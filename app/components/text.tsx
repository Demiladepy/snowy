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

export function Eyebrow({children}: {children: React.ReactNode}) {
  return <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-ash">{children}</p>
}
