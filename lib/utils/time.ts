export type BusinessHours = {
  timezone: string   // IANA timezone, e.g. "America/New_York"
  days: number[]     // 0=Sun, 1=Mon ... 6=Sat  e.g. [1,2,3,4,5] for Mon-Fri
  start: string      // "HH:MM" 24-hour, e.g. "09:00"
  end: string        // "HH:MM" 24-hour, e.g. "17:00"
}

const DAY_MAP: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

// Resolves "now" in a given IANA timezone to a weekday index, minutes since
// midnight, and a YYYY-MM-DD date key — shared by isAfterHours below and by
// the EOD digest cron route, which both need to reason about a client's
// local time without string-parsing or locale variance.
export function getLocalParts(
  timezone: string,
  now: Date = new Date(),
): { day: number; minutes: number; dateKey: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''

  return {
    day: DAY_MAP[get('weekday')] ?? -1,
    minutes: parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10),
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
  }
}

// Returns true when the current moment falls outside the configured business hours.
// If business_hours is not configured on the client, always returns false (in-hours).
export function isAfterHours(businessHours: BusinessHours | undefined | null): boolean {
  if (!businessHours?.timezone || !businessHours.days?.length) return false

  const { timezone, days, start, end } = businessHours
  const { day: currentDay, minutes: currentMinutes } = getLocalParts(timezone)

  const [startHour, startMinute] = start.split(':').map(Number)
  const [endHour, endMinute] = end.split(':').map(Number)
  const startMinutes = startHour * 60 + startMinute
  const endMinutes = endHour * 60 + endMinute

  const isDayOpen = days.includes(currentDay)
  const isTimeOpen = currentMinutes >= startMinutes && currentMinutes < endMinutes

  return !(isDayOpen && isTimeOpen)
}

export function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
