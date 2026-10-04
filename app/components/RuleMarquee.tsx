'use client'

import {DraggableMarquee} from '@/components/block/draggable-marquee'

interface Item {
  id: string
  ruleId: string
  title: string
  boundary?: string
  severity: string
}

const TAG: Record<string, string> = {
  critical: 'bg-critical-bg text-critical',
  warning: 'bg-warning-bg text-warning',
  info: 'bg-info-bg text-info',
}

/** ObsidianUI DraggableMarquee, rendering rule cards instead of images. Drag it, or use the arrow keys. */
export default function RuleMarquee({items}: {items: Item[]}) {
  if (!items.length) return null
  return (
    <DraggableMarquee
      items={items.map((i) => ({...i, src: ''}))}
      speed={0.6}
      repeatCount={3}
      gapClassName="gap-3"
      pauseOnHover
      label="Rules Pinned evaluates. Drag or use the left and right arrow keys."
      itemClassName="rounded-xl"
      renderItem={(item: {src: string}) => {
        const r = item as unknown as Item
        return (
          <a
            href={`/rules#${r.ruleId}`}
            draggable={false}
            className="block w-[260px] select-none rounded-xl border border-mist bg-white p-4 shadow-[var(--shadow-diagram)] transition-colors hover:bg-linen"
          >
            <div className="flex items-center gap-2 text-[12px]">
              <span className={`rounded px-1.5 py-0.5 font-medium ${TAG[r.severity] ?? TAG.info}`}>{r.severity}</span>
              {r.boundary ? <span className="font-mono text-ash">{r.boundary}</span> : null}
            </div>
            <div className="mt-2 line-clamp-2 text-[15px] font-semibold leading-snug text-graphite">{r.title.replace(/`/g, '')}</div>
            <code className="mt-1 block truncate text-[11px] text-ash">{r.ruleId}</code>
          </a>
        )
      }}
    />
  )
}
