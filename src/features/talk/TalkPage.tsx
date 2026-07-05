import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { TALK_THEMES } from '../../data/talk'
import { getSetting } from '../../db/schema'
import { initVoices, jaVoices, speakJa } from '../../lib/tts'

export default function TalkPage() {
  const [themeKey, setThemeKey] = useState(TALK_THEMES[0].key)
  const [showKo, setShowKo] = useState(true)
  const [playingAll, setPlayingAll] = useState(false)
  const [playingIndex, setPlayingIndex] = useState<number | null>(null)
  const [available, setAvailable] = useState(false)
  const [rate, setRate] = useState(0.9)
  const voiceName = useRef<string | undefined>(undefined)
  const stopRef = useRef(false)

  useEffect(() => {
    Promise.all([
      initVoices(),
      getSetting<string | undefined>('ttsVoice', undefined),
      getSetting('ttsRate', 0.9),
    ]).then(([, v, r]) => {
      setAvailable(jaVoices().length > 0)
      voiceName.current = v || undefined
      setRate(r)
    })
    return () => {
      stopRef.current = true
      window.speechSynthesis?.cancel()
    }
  }, [])

  const theme = TALK_THEMES.find((t) => t.key === themeKey)!

  function playOne(index: number) {
    stopRef.current = true
    setPlayingAll(false)
    setPlayingIndex(index)
    speakJa(theme.sentences[index].ja, {
      voiceName: voiceName.current,
      rate,
      onEnd: () => setPlayingIndex(null),
    })
  }

  function playAll(from = 0) {
    stopRef.current = false
    setPlayingAll(true)
    const step = (i: number) => {
      if (stopRef.current || i >= theme.sentences.length) {
        setPlayingAll(false)
        setPlayingIndex(null)
        return
      }
      setPlayingIndex(i)
      speakJa(theme.sentences[i].ja, {
        voiceName: voiceName.current,
        rate,
        // 문장 사이 잠깐 쉼 — 따라 말할 시간
        onEnd: () => setTimeout(() => step(i + 1), 1200),
      })
    }
    step(from)
  }

  function stopAll() {
    stopRef.current = true
    window.speechSynthesis?.cancel()
    setPlayingAll(false)
    setPlayingIndex(null)
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <Link to="/" className="text-xs text-slate-400">
            ← 홈
          </Link>
          <h1 className="text-xl font-bold">회화 듣기</h1>
        </div>
        <button
          type="button"
          onClick={() => setShowKo((v) => !v)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            showKo ? 'bg-white text-slate-500 ring-1 ring-slate-200' : 'bg-slate-800 text-white'
          }`}
        >
          {showKo ? '해석 숨기기' : '해석 보기'}
        </button>
      </header>

      {!available && (
        <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700 ring-1 ring-amber-100">
          일본어 음성을 찾을 수 없어 재생 버튼이 동작하지 않습니다. 설정의 TTS 안내를 확인하세요.
        </p>
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TALK_THEMES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              stopAll()
              setThemeKey(t.key)
            }}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
              themeKey === t.key ? 'bg-rose-600 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200'
            }`}
          >
            {t.icon} {t.name}
          </button>
        ))}
      </div>

      {available && (
        <button
          type="button"
          onClick={() => (playingAll ? stopAll() : playAll())}
          className={`w-full rounded-2xl py-3.5 text-lg font-bold text-white ${
            playingAll ? 'bg-red-500' : 'bg-slate-800'
          }`}
        >
          {playingAll ? '■ 정지' : '▶ 전체 연속 듣기'}
        </button>
      )}

      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
        {theme.sentences.map((s, i) => (
          <li key={s.ja}>
            <button
              type="button"
              onClick={() => available && playOne(i)}
              className={`w-full px-4 py-3 text-left ${playingIndex === i ? 'bg-rose-50' : ''}`}
            >
              <p className="font-ja text-base font-semibold leading-relaxed">
                {playingIndex === i && <span className="mr-1.5">🔊</span>}
                {s.ja}
              </p>
              {showKo && <p className="mt-0.5 text-sm text-slate-400">{s.ko}</p>}
            </button>
          </li>
        ))}
      </ul>

      <p className="text-center text-xs text-slate-400">
        문장을 누르면 재생됩니다 · 연속 듣기 중엔 문장 사이에 따라 말해 보세요
      </p>
    </div>
  )
}
