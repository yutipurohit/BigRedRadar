'use client'

import { CATEGORIES } from '@/lib/categories'

type Props = {
  counts: Map<string, number>
  picks: Set<string>
  onToggle: (key: string) => void
  allCount?: number
  extra?: { key: string; label: string; count: number }[]
}

export default function CategoryPills({ counts, picks, onToggle, allCount, extra = [] }: Props) {
  return (
    <div className="pills">
      <button className={`pill ${picks.size ? '' : 'on'}`} onClick={() => onToggle('all')}>
        All{allCount !== undefined && <span className="n">{allCount}</span>}
      </button>

      {extra.map((x) => (
        <button
          key={x.key}
          className={`pill ${picks.has(x.key) ? 'on' : ''}`}
          onClick={() => onToggle(x.key)}
        >
          {x.label}<span className="n">{x.count}</span>
        </button>
      ))}

      {CATEGORIES.map(([key, label]) => {
        const n = counts.get(key) ?? 0
        if (!n) return null

        return (
          <button
            key={key}
            className={`pill ${picks.has(key) ? 'on' : ''}`}
            onClick={() => onToggle(key)}
          >
            {label}{allCount !== undefined && <span className="n">{n}</span>}
          </button>
        )
      })}
    </div>
  )
}
