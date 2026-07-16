function Block({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-[var(--radius-md)] [background:var(--color-bg-sunken)] ${className}`} />
}

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-5 pb-[calc(var(--bottom-nav-height)+1.5rem)] md:px-8 md:py-7 md:pb-7">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Block className="h-5 w-40" />
          <Block className="h-4 w-64" />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Block key={i} className="h-32" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <Block className="h-80" />
        <Block className="h-80" />
      </div>
    </div>
  )
}
