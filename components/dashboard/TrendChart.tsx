// Hand-rolled inline SVG triple-line area chart (no chart library installed).
// Pure presentational — receives pre-bucketed data as props, computes geometry
// from props only (no impure calls), so it is safe in a server component.

export type TrendPoint = {
  label: string
  inbound: number
  outbound: number
}

type Pt = { x: number; y: number }

// ── Geometry constants ──────────────────────────────────────────────────────
const W = 640
const H = 240
const PAD_L = 34
const PAD_R = 16
const PAD_T = 18
const PAD_B = 30
const TICKS = 4

// Cardinal-spline smoothing: turn a set of points into a smooth cubic-bezier path.
function smoothPath(points: Pt[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  return d
}

function areaPath(points: Pt[], baselineY: number): string {
  if (points.length === 0) return ''
  const line = smoothPath(points)
  const last = points[points.length - 1]
  const first = points[0]
  return `${line} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`
}

export default function TrendChart({ data }: { data: TrendPoint[] }) {
  const plotW = W - PAD_L - PAD_R
  const plotH = H - PAD_T - PAD_B
  const baselineY = PAD_T + plotH

  const totals = data.map((d) => d.inbound + d.outbound)

  // Scale to a round number divisible by TICKS so gridline labels are clean.
  const rawMax = Math.max(0, ...totals)
  const maxScale = Math.max(TICKS, Math.ceil((rawMax * 1.25) / TICKS) * TICKS)

  const n = data.length
  const xFor = (i: number) => (n <= 1 ? PAD_L + plotW / 2 : PAD_L + (plotW * i) / (n - 1))
  const yFor = (v: number) => PAD_T + plotH - (v / maxScale) * plotH

  const totalPts: Pt[] = data.map((d, i) => ({ x: xFor(i), y: yFor(d.inbound + d.outbound) }))
  const inboundPts: Pt[] = data.map((d, i) => ({ x: xFor(i), y: yFor(d.inbound) }))
  const outboundPts: Pt[] = data.map((d, i) => ({ x: xFor(i), y: yFor(d.outbound) }))

  // Y-axis gridlines at even increments of maxScale.
  const yTicks = Array.from({ length: TICKS + 1 }, (_, i) => (maxScale / TICKS) * i)

  // Thin x-axis labels when there are many points (e.g. a 31-day month view)
  // so timestamps don't overlap. Always keep the first and last.
  const labelStep = n > 12 ? Math.ceil(n / 8) : 1

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Total, inbound, and outbound message volume over time"
      >
        <defs>
          <linearGradient id="trend-total-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#344767" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#344767" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y-axis gridlines + labels */}
        {yTicks.map((v) => {
          const y = yFor(v)
          return (
            <g key={v}>
              <line
                x1={PAD_L}
                y1={y}
                x2={W - PAD_R}
                y2={y}
                stroke="#e3e8ef"
                strokeWidth="1"
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
              />
              <text x={PAD_L - 8} y={y + 3} textAnchor="end" fontSize="10" fill="#b0b7c3">
                {Math.round(v)}
              </text>
            </g>
          )
        })}

        {/* Area fill (total only, to keep the chart from looking cluttered) */}
        <path d={areaPath(totalPts, baselineY)} fill="url(#trend-total-fill)" />

        {/* Lines */}
        <path
          d={smoothPath(outboundPts)}
          fill="none"
          stroke="#7b809a"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="5 5"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={smoothPath(inboundPts)}
          fill="none"
          stroke="#1565c0"
          strokeWidth="2.25"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={smoothPath(totalPts)}
          fill="none"
          stroke="#344767"
          strokeWidth="2.75"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* X-axis timestamps */}
      <div className="mt-1 flex pl-[34px] pr-4 text-[11px] font-medium text-[#b0b7c3]">
        {data.map((d, i) => {
          const show = i % labelStep === 0 || i === n - 1
          const align = i === 0 ? 'text-left' : i === n - 1 ? 'text-right' : 'text-center'
          return (
            <span key={`${d.label}-${i}`} className={`flex-1 ${align}`}>
              {show ? d.label : ' '}
            </span>
          )
        })}
      </div>
    </div>
  )
}
