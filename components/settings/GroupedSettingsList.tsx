'use client'

import type { ReactNode } from 'react'

type SettingsItem = {
  id: string
  label: string
  icon: ReactNode
}

type SettingsGroup = {
  title: string
  items: SettingsItem[]
}

const ChevronIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

type Props = {
  groups: SettingsGroup[]
  onSelect: (id: string) => void
}

// iOS-style grouped chevron-row list — the mobile counterpart to the desktop
// tab strip in SettingsTabs.tsx. Selecting a row opens MobileSettingsPanel
// with that same tab's content.
export default function GroupedSettingsList({ groups, onSelect }: Props) {
  return (
    <div className="mt-5 flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide [color:var(--color-on-glass-muted)]">
            {group.title}
          </p>
          <div className="glass-panel overflow-hidden">
            {group.items.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/10 ${
                  i !== group.items.length - 1 ? 'border-b [border-color:var(--glass-border)]' : ''
                }`}
              >
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/10 [color:var(--color-on-glass)]">
                  {item.icon}
                </span>
                <span className="flex-1 text-sm font-semibold [color:var(--color-on-glass)]">
                  {item.label}
                </span>
                <span className="[color:var(--color-on-glass-subtle)]">{ChevronIcon}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
