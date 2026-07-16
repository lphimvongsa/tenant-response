import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { supabase } from '@/lib/integrations/supabase'
import { getCurrentManager } from '@/lib/integrations/supabase-auth'
import { TICKETS_TAG } from '@/lib/cache-tags'
import TicketBoard from '@/components/maintenance/TicketList'
import type { Ticket } from '@/components/maintenance/TicketList'

const getCachedTickets = unstable_cache(
  async (clientId: string) => {
    const { data, error } = await supabase
      .from('tickets')
      .select(
        'id, title, category, location, severity, description, status, photo_url, assigned_to, created_at, unit_id, tenants(id, name, phone), units(id, unit_number, properties(id, name))',
      )
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    return { data, error: error ? error.message : null }
  },
  ['maintenance-tickets'],
  { revalidate: 30, tags: [TICKETS_TAG] },
)

export default async function MaintenancePage() {
  const manager = await getCurrentManager()
  if (!manager) {
    // proxy.ts already gates /dashboard/**; this is a defensive fallback.
    redirect('/')
  }

  const { data, error } = await getCachedTickets(manager.clientId)

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md rounded-[var(--radius-lg)] border [border-color:var(--color-danger)] [background:var(--color-danger-bg)] p-6 text-center">
          <p className="text-sm font-semibold [color:var(--color-danger)]">Unable to load maintenance tickets</p>
          <p className="mt-1 text-sm [color:var(--color-danger)]">{error}</p>
        </div>
      </div>
    )
  }

  const tickets = (data ?? []) as unknown as Ticket[]

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-7">
      <header className="mb-5">
        <h1 className="text-lg font-bold [color:var(--color-text-primary)]">Maintenance</h1>
      </header>

      <TicketBoard tickets={tickets} />
    </div>
  )
}
