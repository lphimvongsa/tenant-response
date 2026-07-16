const COLUMN_LABELS = ['New', 'In Progress', 'In Review', 'Resolved']

function Block({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-[var(--radius-md)] [background:var(--color-bg-sunken)] ${className}`} />
}

export default function Loading() {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-7">
      <header className="mb-5">
        <h1 className="text-lg font-bold [color:var(--color-text-primary)]">Maintenance</h1>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {COLUMN_LABELS.map((label) => (
          <div key={label} className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide [color:var(--color-text-muted)]">
              {label}
            </p>
            <Block className="h-24" />
            <Block className="h-24" />
          </div>
        ))}
      </div>
    </div>
  )
}
