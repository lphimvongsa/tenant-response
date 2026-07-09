// Hand-rolled inline SVG two-bar comparison (no chart library installed).
// Pure presentational — receives the period's AI vs. manual totals as props.
// Unlike the message-volume line chart this isn't a time series, so there's
// no y-axis/gridlines — just two bars side by side, one per response type.

export type ResponseTotals = {
  ai: number
  manual: number
}

const W = 640
const H = 220
const PAD_L = 24
const PAD_R = 24
const PAD_T = 20
const PAD_B = 30

export default function ResponseChart({ data }: { data: ResponseTotals }) {
  const plotW = W - PAD_L - PAD_R
  const plotH = H - PAD_T - PAD_B
  const baselineY = PAD_T + plotH

  const maxVal = Math.max(4, data.ai, data.manual)
  const yFor = (v: number) => PAD_T + plotH - (v / maxVal) * plotH

  const slotW = plotW / 2
  const barW = Math.min(120, slotW * 0.45)

  const aiX = PAD_L + slotW / 2 - barW / 2
  const manualX = PAD_L + slotW + slotW / 2 - barW / 2

  const aiY = yFor(data.ai)
  const manualY = yFor(data.manual)
  const aiH = Math.max(0, baselineY - aiY)
  const manualH = Math.max(0, baselineY - manualY)

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="LLM response total versus manual response total"
      >
        <line x1={PAD_L} y1={baselineY} x2={W - PAD_R} y2={baselineY} stroke="#d7dce5" strokeWidth="1" vectorEffect="non-scaling-stroke" />

        {aiH > 0 && <rect x={aiX} y={aiY} width={barW} height={aiH} rx="6" fill="#7c3aed" fillOpacity="0.9" />}
        {manualH > 0 && <rect x={manualX} y={manualY} width={barW} height={manualH} rx="6" fill="#0f9d58" fillOpacity="0.85" />}
      </svg>

      {/* X-axis category labels */}
      <div className="mt-1 flex px-6 text-[11px] font-medium text-[#7b809a]">
        <span className="flex-1 text-center">LLM response</span>
        <span className="flex-1 text-center">Manual response</span>
      </div>
    </div>
  )
}
