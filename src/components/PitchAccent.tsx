import { useEffect, useState } from 'react'

// id → 피치 번호(0=평판, 1=두고, n=n모라 뒤 하강). 처음 필요할 때 한 번만 로드.
let cache: Record<string, number> | null = null
let loading: Promise<Record<string, number>> | null = null

function loadPitch(): Promise<Record<string, number>> {
  if (cache) return Promise.resolve(cache)
  if (!loading) {
    loading = import('../data/pitch.json').then((m) => {
      cache = m.default as unknown as Record<string, number>
      return cache
    })
  }
  return loading
}

const SMALL = 'ゃゅょゎャュョヮぁぃぅぇぉァィゥェォ'

/** 가나 문자열을 모라 단위로 분할 (작은 가나는 앞 글자에 붙음) */
function toMora(kana: string): string[] {
  const out: string[] = []
  for (const ch of kana) {
    if (SMALL.includes(ch) && out.length > 0) out[out.length - 1] += ch
    else out.push(ch)
  }
  return out
}

function accentType(pitch: number, m: number): string {
  if (pitch === 0) return '평판형'
  if (pitch === 1) return '두고형'
  if (pitch === m) return '미고형'
  return '중고형'
}

interface Props {
  /** 카드 id (pitch.json 조회 키) */
  id: string
  /** 표시할 가나 (첫 변형만) */
  kana: string
}

/** 단어의 피치 악센트를 시각 억양선으로 표시 (데이터 없으면 아무것도 안 그림) */
export default function PitchAccent({ id, kana }: Props) {
  const [map, setMap] = useState<Record<string, number> | null>(cache)

  useEffect(() => {
    if (!cache) void loadPitch().then(setMap)
  }, [])

  if (!map || !(id in map)) return null
  const pitch = map[id]
  const mora = toMora(kana)
  const m = mora.length
  if (m === 0) return null

  // 각 모라의 high 여부 (1-based)
  const isHigh = (i: number): boolean => {
    if (pitch === 0) return i >= 2
    if (pitch === 1) return i === 1
    return i >= 2 && i <= pitch
  }

  return (
    <span
      className="inline-flex items-end font-ja text-lg"
      aria-label={`억양 ${accentType(pitch, m)}`}
      title={`억양: ${accentType(pitch, m)}`}
    >
      {mora.map((mo, idx) => {
        const i = idx + 1
        const high = isHigh(i)
        const nextLow = high && i < m && !isHigh(i + 1)
        // 마지막 모라가 high인데 뒤(조사)가 low로 떨어지는 두고/미고형은 오른쪽 하강 힌트
        const dropAfterEnd = high && i === m && pitch !== 0
        return (
          <span
            key={idx}
            className="relative px-[1px]"
            style={{
              borderTop: high ? '2px solid #f2401f' : '2px solid transparent',
              borderRight: nextLow || dropAfterEnd ? '2px solid #f2401f' : undefined,
              marginTop: '3px',
            }}
          >
            {mo}
          </span>
        )
      })}
    </span>
  )
}
