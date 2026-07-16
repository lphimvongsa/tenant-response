import type { PropertyUnit } from '@/types'

// A ticket is "outstanding" (counts toward the open/maintenance figures) when
// its status is one of these. Kept in one place so the profile card and the
// unit cards agree on the exact definition.
export const OUTSTANDING_STATUSES = ['open', 'in_progress', 'in_review']

export function isOutstanding(status: string): boolean {
  return OUTSTANDING_STATUSES.includes(status)
}

export function countOpenTickets(units: PropertyUnit[]): number {
  return units.reduce(
    (sum, u) =>
      sum + (Array.isArray(u.tickets) ? u.tickets.filter((t) => isOutstanding(t.status)).length : 0),
    0,
  )
}
