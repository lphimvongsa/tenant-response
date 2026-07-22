'use client'

import { useEffect, useRef } from 'react'

const SearchIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

const XIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

type ConversationSearchBarProps = {
  query: string
  onQueryChange: (value: string) => void
  onClose: () => void
}

export default function ConversationSearchBar({
  query,
  onQueryChange,
  onClose,
}: ConversationSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  // This bar is only mounted while search is open, so focusing on mount
  // reproduces the original "focus when search opens" behaviour.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="flex items-center gap-2.5 py-2.5 px-5 [background:var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border-b [border-color:var(--glass-border)] shrink-0 [color:var(--color-on-glass-muted)]">
      {SearchIcon}
      <input
        ref={inputRef}
        className="flex-1 border-none bg-transparent text-base [color:var(--color-on-glass)] outline-none [font-family:inherit] placeholder:[color:var(--color-on-glass-subtle)]"
        type="text"
        placeholder="Search messages…"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
      />
      {query && (
        <button
          className="flex items-center justify-center w-5 h-5 border-none [background:rgba(255,255,255,0.14)] rounded-full [color:var(--color-on-glass-muted)] cursor-pointer shrink-0 hover:[background:rgba(255,255,255,0.24)]"
          aria-label="Clear search"
          type="button"
          onClick={() => onQueryChange('')}
        >
          {XIcon}
        </button>
      )}
      <button
        className="text-xs font-semibold [color:var(--color-on-glass)] border-none bg-transparent cursor-pointer py-1 px-2 rounded-[6px] shrink-0 hover:[background:rgba(255,255,255,0.1)]"
        type="button"
        onClick={onClose}
      >
        Close
      </button>
    </div>
  )
}
