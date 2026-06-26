import { supabase } from '@/lib/integrations/supabase'
import TicketList from '@/components/maintenance/TicketList'
import type { Ticket } from '@/components/maintenance/TicketList'

export default async function MaintenancePage() {
  const { data, error } = await supabase
    .from('tickets')
    .select('id, category, location, severity, description, status, photo_url, created_at, tenants(id, name, phone)')
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
  const outstanding = tickets.filter((t) => t.status === 'open')
  const completed = tickets.filter((t) => t.status === 'resolved' || t.status === 'closed')

  return (
    <div className="flex-1 overflow-y-auto px-8 py-7">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[#344767]">Maintenance</h1>
        <p className="mt-1 text-sm text-[#7b809a]">Track outstanding and completed maintenance requests.</p>
      </header>

      <TicketList outstanding={outstanding} completed={completed} />
    </div>
  )
}
