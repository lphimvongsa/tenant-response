// Single source of truth for the maintenance ticket taxonomy — shared by the AI
// router's tool schema, the manual ticket-creation API, and the dashboard UI so
// the category list can't drift between them.

export const MAINTENANCE_CATEGORIES = [
  'plumbing',
  'electrical',
  'hvac',
  'appliance',
  'cosmetic',
  'security',
  'gas',
  'pest',
  'structural',
  'exterior',
  'safety_devices',
  'other',
] as const

export type MaintenanceCategory = (typeof MAINTENANCE_CATEGORIES)[number]

export const MAINTENANCE_CATEGORY_LABELS: Record<MaintenanceCategory, string> = {
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  hvac: 'HVAC',
  appliance: 'Appliance',
  cosmetic: 'Cosmetic',
  security: 'Security',
  gas: 'Gas',
  pest: 'Pest',
  structural: 'Structural',
  exterior: 'Exterior',
  safety_devices: 'Safety devices',
  other: 'Other',
}

export function isMaintenanceCategory(value: string): value is MaintenanceCategory {
  return (MAINTENANCE_CATEGORIES as readonly string[]).includes(value.toLowerCase())
}

export function maintenanceCategoryLabel(value: string | null | undefined): string {
  if (!value) return 'Other'
  const key = value.toLowerCase()
  return isMaintenanceCategory(key) ? MAINTENANCE_CATEGORY_LABELS[key] : value
}
