interface Props {
  /** 0~1 */
  progress: number
  size?: number
  stroke?: number
  children?: React.ReactNode
}

export default function ProgressRing({ progress, size = 120, stroke = 8, children }: Props) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#fecdd3" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#e11d48"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          style={{ transition: 'stroke-dashoffset 0.3s linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}
