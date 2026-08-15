import { useRef, useState } from 'react'
import type { Grade } from '../../db/schema'

/** 손잡이가 이만큼 밀리면 판정된다 (트랙이 짧아 부담 없이 닿는 거리) */
const THRESHOLD = 44
/** 손잡이가 움직일 수 있는 최대 거리 */
const MAX_DX = 62

interface Props {
  onGrade: (grade: Grade) => void
}

/**
 * 복습 평가 입력.
 *
 * 가운데 짧은 슬라이드로 어려움/좋음을, 양끝 버튼으로 모름/암기완을 고른다.
 * 왼쪽에서 오른쪽으로 갈수록 쉬운 평가이며 FSRS 등급 0→3과 그대로 맞물린다.
 *   모름!(0) ← 어려워요!(1) · 쉬워요!(2) → 암기완!(3)
 */
export default function GradeSlider({ onGrade }: Props) {
  const [dx, setDx] = useState(0)
  const dragFrom = useRef<number | null>(null)

  function onPointerDown(e: React.PointerEvent) {
    dragFrom.current = e.clientX
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (dragFrom.current === null) return
    const raw = e.clientX - dragFrom.current
    setDx(Math.max(-MAX_DX, Math.min(MAX_DX, raw)))
  }

  function onPointerEnd() {
    if (dragFrom.current === null) return
    const d = dx
    dragFrom.current = null
    setDx(0)
    if (d <= -THRESHOLD) onGrade(1)
    else if (d >= THRESHOLD) onGrade(2)
  }

  const leftLit = Math.min(1, Math.max(0, -dx) / THRESHOLD)
  const rightLit = Math.min(1, Math.max(0, dx) / THRESHOLD)

  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={() => onGrade(0)}
        className="shrink-0 rounded-xl bg-red-50 px-4 py-3.5 text-sm font-bold text-red-500 ring-1 ring-red-100"
      >
        모름!
      </button>

      {/* 가운데 짧은 슬라이드 — 좌우로 살짝 밀어 어려움/좋음을 고른다 */}
      <div className="relative h-12 min-w-0 flex-1 select-none rounded-full bg-slate-100">
        <span
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-bold text-amber-600"
          style={{ opacity: 0.35 + leftLit * 0.65 }}
        >
          ← 어려워요!
        </span>
        <span
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-bold text-emerald-600"
          style={{ opacity: 0.35 + rightLit * 0.65 }}
        >
          쉬워요! →
        </span>
        <button
          type="button"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          style={{
            transform: `translate(calc(-50% + ${dx}px), -50%)`,
            transition: dragFrom.current === null ? 'transform 0.15s ease' : 'none',
            touchAction: 'none',
          }}
          className={`absolute left-1/2 top-1/2 h-10 w-14 cursor-grab rounded-full text-lg shadow-md active:cursor-grabbing ${
            leftLit >= 1 ? 'bg-amber-400' : rightLit >= 1 ? 'bg-emerald-500' : 'bg-white'
          }`}
          aria-label="밀어서 평가 — 왼쪽 어려워요, 오른쪽 쉬워요"
        >
          {leftLit >= 1 ? '😥' : rightLit >= 1 ? '👍' : '↔'}
        </button>
      </div>

      <button
        type="button"
        onClick={() => onGrade(3)}
        className="shrink-0 rounded-xl bg-slate-800 px-4 py-3.5 text-sm font-bold text-white"
      >
        암기완!
      </button>
    </div>
  )
}
