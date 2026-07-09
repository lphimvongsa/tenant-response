// Hand-rolled inline SVG dual-line area chart (no chart library installed).
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
const PAD_L = 12
const PAD_R = 16
const PAD_T = 28
const PAD_B = 30

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

  // Scale: headroom above the peak so the callout has breathing room.
  const rawMax = data.reduce((m, d) => Math.max(m, d.inbound, d.outbound), 0)
  const maxScale = Math.max(4, Math.ceil((rawMax * 1.25) / 2) * 2)

  const n = data.length
  const xFor = (i: number) => (n <= 1 ? PAD_L + plotW / 2 : PAD_L + (plotW * i) / (n - 1))
  const yFor = (v: number) => PAD_T + plotH - (v / maxScale) * plotH

  const inboundPts: Pt[] = data.map((d, i) => ({ x: xFor(i), y: yFor(d.inbound) }))
  const outboundPts: Pt[] = data.map((d, i) => ({ x: xFor(i), y: yFor(d.outbound) }))

  // Peak inbound point → callout.
  let peakIdx = 0
  for (let i = 1; i < data.length; i++) {
    if (data[i].inbound > data[peakIdx].inbound) peakIdx = i
  }
  const peak = data[peakIdx]
  const peakPt = inboundPts[peakIdx]
  const showCallout = data.length > 0 && peak.inbound > 0

  // Keep the callout box inside the viewBox horizontally.
  const calloutW = 58
  const calloutX = peakPt ? Math.min(Math.max(peakPt.x - calloutW / 2, PAD_L), W - PAD_R - calloutW) : 0
  const calloutY = peakPt ? Math.max(peakPt.y - 40, 2) : 0

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Inbound versus outbound message volume over the last 7 days"
      >
        <defs>
          <linearGradient id="trend-inbound-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1565c0" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#1565c0" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="trend-outbound-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7b809a" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#7b809a" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area fills */}
        <path d={areaPath(outboundPts, baselineY)} fill="url(#trend-outbound-fill)" />
        <path d={areaPath(inboundPts, baselineY)} fill="url(#trend-inbound-fill)" />

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
          strokeWidth="2.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Peak marker + callout */}
        {showCallout && peakPt && (
          <>
            <line
              x1={peakPt.x}
              y1={peakPt.y}
              x2={peakPt.x}
              y2={baselineY}
              stroke="#1565c0"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.4"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={peakPt.x} cy={peakPt.y} r="5" fill="#ffffff" stroke="#1565c0" strokeWidth="2.5" />
            <g>
              <rect
                x={calloutX}
                y={calloutY}
                width={calloutW}
                height="26"
                rx="8"
                fill="#1565c0"
              />
              <text
                x={calloutX + calloutW / 2}
                y={calloutY + 17}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="12"
                fontWeight="700"
              >
                {peak.inbound} in
              </text>
            </g>
          </>
        )}
      </svg>

      {/* X-axis labels */}
      <div className="mt-1 flex justify-between px-1 text-[11px] font-medium text-[#b0b7c3]">
        {data.map((d, i) => (
          <span key={`${d.label}-${i}`}>{d.label}</span>
        ))}
      </div>
    </div>
  )
}
