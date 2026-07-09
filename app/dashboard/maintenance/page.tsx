import { redirect } from 'next/navigation'
import { supabase } from '@/lib/integrations/supabase'
import { getCurrentManager } from '@/lib/integrations/supabase-auth'
import TicketBoard from '@/components/maintenance/TicketList'
import type { Ticket } from '@/components/maintenance/TicketList'

export default async function MaintenancePage() {
  const manager = await getCurrentManager()
  if (!manager) {
    // proxy.ts already gates /dashboard/**; this is a defensive fallback.
    redirect('/')
  }

  const { data, error } = await supabase
    .from('tickets')
    .select(
      'id, title, category, location, severity, description, status, photo_url, assigned_to, created_at, unit_id, tenants(id, name, phone), units(id, unit_number, properties(id, name))',
    )
    .eq('client_id', manager.clientId)
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md rounded-xl border border-[#fecaca] bg-[#fef2f2] p-6 text-center">
          <p className="text-sm font-semibold text-[#b91c1c]">Unable to load maintenance tickets</p>
          <p className="mt-1 text-sm text-[#7f1d1d]">{error.message}</p>
        </div>
      </div>
    )
  }

  const tickets = (data ?? []) as unknown as Ticket[]

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-7">
      <header className="mb-5">
        <h1 className="text-lg font-bold text-[#1e293b]">Maintenance</h1>
        {/* Tabs — "Recurring" is an inactive placeholder for now. */}
        <nav className="mt-3 flex items-center gap-6 border-b border-[rgba(52,71,103,0.10)]">
          <span className="-mb-px border-b-2 border-[#1565c0] pb-2 text-sm font-semibold text-[#1565c0]">
            Requests Board
          </span>
          <span
            className="-mb-px cursor-not-allowed border-b-2 border-transparent pb-2 text-sm font-semibold text-[#b0b7c3]"
            aria-disabled="true"
          >
            Recurring
          </span>
        </nav>
      </header>

      <TicketBoard tickets={tickets} />
    </div>
  )
}
