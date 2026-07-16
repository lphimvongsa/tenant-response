'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import styles from './MassTextModal.module.css'

// UI-only derived shapes (not DB entities) — colocated here on purpose,
// mirroring how ThreadMessage lives in MessageThread.tsx.
export type Recipient = { id: string; name: string | null; phone: string }
export type RecipientGroup = { key: string; label: string; tenants: Recipient[] }

type MassTextRecipientPickerProps = {
  groups: RecipientGroup[]
  selectedIds: Set<string>
  onToggleTenant: (id: string) => void
  onToggleGroup: (groupKey: string) => void
}

const ChevronIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

type GroupSectionProps = {
  group: RecipientGroup
  selectedIds: Set<string>
  onToggleTenant: (id: string) => void
  onToggleGroup: (groupKey: string) => void
}

function GroupSection({ group, selectedIds, onToggleTenant, onToggleGroup }: GroupSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const masterRef = useRef<HTMLInputElement>(null)

  const total = group.tenants.length
  const selectedCount = group.tenants.reduce((n, t) => (selectedIds.has(t.id) ? n + 1 : n), 0)
  const allSelected = total > 0 && selectedCount === total

  // Native checkboxes have no JSX `indeterminate` prop — set it imperatively.
  useLayoutEffect(() => {
    if (masterRef.current) {
      masterRef.current.indeterminate = selectedCount > 0 && selectedCount < total
    }
  }, [selectedCount, total])

  const countLabel = selectedCount > 0 ? `${selectedCount}/${total}` : String(total)

  return (
    <div className={styles.group}>
      <div className={styles.groupHeader}>
        <input
          ref={masterRef}
          type="checkbox"
          className={styles.checkbox}
          checked={allSelected}
          disabled={total === 0}
          onChange={() => onToggleGroup(group.key)}
          aria-label={`Select all tenants in ${group.label}`}
        />
        <button
          type="button"
          className={styles.groupToggle}
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
        >
          <span className={styles.groupLabel}>{group.label}</span>
          <span className={styles.groupCount}>{countLabel}</span>
          <span className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}>
            {ChevronIcon}
          </span>
        </button>
      </div>

      {expanded && (
        total === 0 ? (
          <p className={styles.groupEmpty}>No tenants in this property.</p>
        ) : (
          <div className={styles.tenantList}>
            {group.tenants.map((t) => (
              <label key={t.id} className={styles.tenantRow}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={selectedIds.has(t.id)}
                  onChange={() => onToggleTenant(t.id)}
                />
                <span className={styles.tenantInfo}>
                  <span className={styles.tenantName}>{t.name ?? t.phone}</span>
                  {t.name && <span className={styles.tenantPhone}>{t.phone}</span>}
                </span>
              </label>
            ))}
          </div>
        )
      )}
    </div>
  )
}

export default function MassTextRecipientPicker({
  groups,
  selectedIds,
  onToggleTenant,
  onToggleGroup,
}: MassTextRecipientPickerProps) {
  if (groups.length === 0) {
    return <p className={styles.pickerEmpty}>No tenants found for this account.</p>
  }

  return (
    <div className={styles.groups}>
      {groups.map((group) => (
        <GroupSection
          key={group.key}
          group={group}
          selectedIds={selectedIds}
          onToggleTenant={onToggleTenant}
          onToggleGroup={onToggleGroup}
        />
      ))}
    </div>
  )
}
