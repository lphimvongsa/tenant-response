'use client'

// Owns the week/month/year toggle for the whole trends section and re-renders
// BOTH charts below it against whichever pre-bucketed dataset is active. All
// three periods are computed server-side and handed down as props — switching
// period is a pure client-side state flip, no refetch.

import { useState } from 'react'
import TrendChart, { type TrendPoint } from './TrendChart'
import ResponseChart, { type ResponseTotals } from './ResponseChart'

export type Period = 'week' | 'month' | 'year'

export type PeriodData = {
  volume: TrendPoint[]
  responses: ResponseTotals
}

const PERIODS: Period[] = ['week', 'month', 'year']

const PERIOD_LABELS: Record<Period, string> = {
  week: 'Week',
  month: 'Month',
  year: 'Year',
}

const PERIOD_SUFFIX: Record<Period, string> = {
  week: 'this week',
  month: 'this month',
  year: 'this year',
}

export default function DashboardTrends({ data }: { data: Record<Period, PeriodData> }) {
  const [period, setPeriod] = useState<Period>('week')
  const { volume, responses } = data[period]

  const totalVolume = volume.reduce((sum, p) => sum + p.inbound + p.outbound, 0)

  return (
    <div className="flex flex-col gap-4">
      {/* Shared period toggle — controls both charts below */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold [color:var(--color-text-primary)]">Messaging trends</h2>
        <div className="flex items-center gap-0.5 rounded-full [background:var(--color-bg-sunken)] p-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              aria-pressed={period === p}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                period === p
                  ? '[background:var(--color-bg-surface)] [color:var(--color-text-primary)] shadow-[var(--shadow-card)]'
                  : '[color:var(--color-text-muted)] hover:[color:var(--color-text-secondary)]'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Message volume chart */}
        <div className="rounded-[var(--radius-lg)] [background:var(--color-bg-surface)] p-5 shadow-[var(--shadow-card)]">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold [color:var(--color-text-secondary)]">Message volume</p>
              <p className="mt-1 text-2xl font-bold tabular-nums [color:var(--color-text-primary)]">
                {totalVolume.toLocaleString()}
                <span className="ml-1 text-sm font-medium [color:var(--color-text-muted)]">{PERIOD_SUFFIX[period]}</span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="flex items-center gap-1.5 text-xs font-semibold [color:var(--color-ink)]">
                <span className="h-2.5 w-2.5 rounded-full [background:var(--color-ink)]" />
                Total
              </span>
              <span className="flex items-center gap-1.5 text-xs font-semibold [color:var(--color-text-secondary)]">
                <span className="h-2.5 w-2.5 rounded-full [background:var(--color-text-secondary)]" />
                Inbound
              </span>
              <span className="flex items-center gap-1.5 text-xs font-semibold [color:var(--color-text-muted)]">
                <span className="h-2.5 w-2.5 rounded-full [background:var(--color-text-muted)]" />
                Outbound
              </span>
            </div>
          </div>
          <TrendChart data={volume} />
        </div>

        {/* AI vs. manual response comparison */}
        <div className="rounded-[var(--radius-lg)] [background:var(--color-bg-surface)] p-5 shadow-[var(--shadow-card)]">
          <p className="mb-4 text-sm font-semibold [color:var(--color-text-secondary)]">AI vs. manual responses</p>
          {/* Totals are laid out in the same two-column split as the bars/labels
              below (px-6 + flex-1 matches ResponseChart's PAD_L/PAD_R), so each
              total sits directly above its bar. */}
          <div className="mb-2 flex px-6">
            <div className="flex-1 text-center">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold [color:var(--color-ink)]">
                <span className="h-2.5 w-2.5 rounded-full [background:var(--color-ink)]" />
                LLM response
              </span>
              <p className="mt-1 text-2xl font-bold tabular-nums [color:var(--color-text-primary)]">{responses.ai.toLocaleString()}</p>
            </div>
            <div className="flex-1 text-center">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold [color:var(--color-text-secondary)]">
                <span className="h-2.5 w-2.5 rounded-full [background:var(--color-text-secondary)]" />
                Manual response
              </span>
              <p className="mt-1 text-2xl font-bold tabular-nums [color:var(--color-text-primary)]">{responses.manual.toLocaleString()}</p>
            </div>
          </div>
          <ResponseChart data={responses} />
        </div>
      </div>
    </div>
  )
}
