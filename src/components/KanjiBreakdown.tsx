import { useEffect, useState } from 'react'

interface KanjiInfo {
  hun: string
  parts: string
}

// 1,974자 데이터는 처음 필요할 때 한 번만 동적 로드 (카드 플립을 가볍게)
let cache: Record<string, KanjiInfo> | null = null
let loading: Promise<Record<string, KanjiInfo>> | null = null

function loadKanjiInfo(): Promise<Record<string, KanjiInfo>> {
  if (cache) return Promise.resolve(cache)
  if (!loading) {
    loading = import('../data/kanjiInfo.json').then((m) => {
      cache = m.default as unknown as Record<string, KanjiInfo>
      return cache
    })
  }
  return loading
}

/** 단어 속 한자를 분해해 한국 훈음 + 구성 요소를 보여준다 (이로이로식) */
export default function KanjiBreakdown({ word }: { word: string }) {
  const [info, setInfo] = useState<Record<string, KanjiInfo> | null>(cache)

  useEffect(() => {
    if (!cache) void loadKanjiInfo().then(setInfo)
  }, [])

  if (!info) return null
  const chars = [...new Set([...word])].filter((ch) => info[ch])
  if (chars.length === 0) return null

  return (
    <div className="mx-auto max-w-xs space-y-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left">
      {chars.map((ch) => {
        const k = info[ch]
        return (
          <div key={ch} className="flex items-start gap-2.5">
            <span className="font-ja-display text-2xl leading-none">{ch}</span>
            <span className="min-w-0 pt-0.5">
              <span className="block text-sm font-bold text-slate-700">{k.hun}</span>
              {k.parts && <span className="block font-ja text-xs text-slate-400">{k.parts}</span>}
            </span>
          </div>
        )
      })}
    </div>
  )
}
