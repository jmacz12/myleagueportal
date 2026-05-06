'use client'

/**
 * Small circular indicator: determinate arc (0–1) or indeterminate spinning ring.
 */
export function InlineCircularProgress({
  progress,
  indeterminate,
  size = 22,
  color = 'currentColor',
  'aria-label': ariaLabel = 'Loading',
}: {
  progress?: number | null
  /** When true, ignores progress and shows a spinning segment */
  indeterminate?: boolean
  size?: number
  color?: string
  'aria-label'?: string
}) {
  const stroke = 2.75
  const cx = size / 2
  const cy = size / 2
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const spin = indeterminate === true || progress === null || progress === undefined

  if (spin) {
    return (
      <svg
        className="animate-spin"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-label={ariaLabel}
        role="status"
      >
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={stroke} opacity={0.14} />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${c * 0.24} ${c}`}
          strokeLinecap="round"
        />
      </svg>
    )
  }

  const p = Math.min(1, Math.max(0, progress))
  const dashOffset = c * (1 - p)

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={ariaLabel}
      role="progressbar"
      aria-valuenow={Math.round(p * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={stroke} opacity={0.12} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    </svg>
  )
}
