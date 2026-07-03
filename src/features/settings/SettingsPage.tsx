import { useEffect, useRef, useState } from 'react'
import { getSetting, setSetting } from '../../db/schema'
import { initVoices, jaVoices, speakJa } from '../../lib/tts'
import { downloadBackup, importBackup, resetAll } from '../../lib/backup'

export default function SettingsPage() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [ttsReady, setTtsReady] = useState(false)
  const [voiceName, setVoiceName] = useState('')
  const [rate, setRate] = useState(0.9)
  const [newLimit, setNewLimit] = useState(10)
  const [reviewLimit, setReviewLimit] = useState(100)
  const [backupMsg, setBackupMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function onImportFile(file: File) {
    try {
      const text = await file.text()
      const result = await importBackup(text)
      setBackupMsg(`✅ 복원 완료: 카드 ${result.cards}장, 학습 기록 ${result.reviews}건`)
    } catch (err) {
      setBackupMsg(`❌ ${err instanceof Error ? err.message : '복원에 실패했습니다.'}`)
    }
  }

  useEffect(() => {
    let alive = true
    Promise.all([
      initVoices(),
      getSetting('ttsVoice', ''),
      getSetting('ttsRate', 0.9),
      getSetting('dailyNewLimit', 10),
      getSetting('dailyReviewLimit', 100),
    ]).then(([, v, r, nl, rl]) => {
      if (!alive) return
      setVoices(jaVoices())
      setVoiceName(v)
      setRate(r)
      setNewLimit(nl)
      setReviewLimit(rl)
      setTtsReady(true)
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">설정</h1>

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">학습량</h2>
        <label className="flex items-center justify-between text-sm">
          하루 새 단어
          <select
            value={newLimit}
            onChange={async (e) => {
              const v = Number(e.target.value)
              setNewLimit(v)
              await setSetting('dailyNewLimit', v)
            }}
            className="rounded-lg border border-rose-100 px-3 py-1.5"
          >
            {[5, 10, 20, 30, 50].map((n) => (
              <option key={n} value={n}>
                {n}개
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center justify-between text-sm">
          하루 복습 한도
          <select
            value={reviewLimit}
            onChange={async (e) => {
              const v = Number(e.target.value)
              setReviewLimit(v)
              await setSetting('dailyReviewLimit', v)
            }}
            className="rounded-lg border border-rose-100 px-3 py-1.5"
          >
            {[50, 100, 200, 500].map((n) => (
              <option key={n} value={n}>
                {n}장
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">발음 (TTS)</h2>
        {ttsReady && voices.length === 0 && (
          <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
            <p className="font-semibold">일본어 음성을 찾을 수 없습니다.</p>
            <p className="mt-1 text-xs leading-relaxed">
              · <b>Microsoft Edge</b>에서 열면 고품질 음성을 바로 사용할 수 있습니다.
              <br />· 또는 Windows 설정 → 시간 및 언어 → 음성에서 <b>일본어 음성 팩</b>을
              설치하세요. 받아쓰기 퀴즈는 음성이 있어야 표시됩니다.
            </p>
          </div>
        )}
        {voices.length > 0 && (
          <>
            <label className="block text-sm">
              음성
              <select
                value={voiceName}
                onChange={async (e) => {
                  setVoiceName(e.target.value)
                  await setSetting('ttsVoice', e.target.value)
                }}
                className="mt-1 w-full rounded-lg border border-rose-100 px-3 py-2"
              >
                <option value="">자동 (권장)</option>
                {voices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              속도: {rate.toFixed(1)}
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.1"
                value={rate}
                onChange={async (e) => {
                  const v = Number(e.target.value)
                  setRate(v)
                  await setSetting('ttsRate', v)
                }}
                className="mt-1 w-full accent-rose-600"
              />
            </label>
            <button
              type="button"
              onClick={() => speakJa('こんにちは、はなびです。', { voiceName: voiceName || undefined, rate })}
              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
            >
              🔊 테스트 재생
            </button>
          </>
        )}
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">데이터</h2>
        <p className="text-xs leading-relaxed text-slate-400">
          학습 기록은 이 브라우저에만 저장됩니다. 주기적으로 백업 파일을 내려받아 두세요.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void downloadBackup().then(() => setBackupMsg('✅ 백업 파일을 내려받았습니다.'))}
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
          >
            백업 내보내기
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-rose-600 shadow-sm ring-1 ring-rose-100"
          >
            백업 가져오기
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('모든 학습 기록이 삭제됩니다. 계속할까요?')) void resetAll()
            }}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-red-500 shadow-sm ring-1 ring-red-100"
          >
            데이터 초기화
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onImportFile(f)
            e.target.value = ''
          }}
        />
        {backupMsg && <p className="text-sm">{backupMsg}</p>}
      </section>

      <section className="rounded-2xl bg-white p-4 text-xs leading-relaxed text-slate-400 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-slate-600">정보</h2>
        <p>
          하나비 — JLPT 단어 학습 (개인용). 단어 목록:{' '}
          <a className="underline" href="https://www.tanos.co.uk/jlpt/" target="_blank" rel="noreferrer">
            Jonathan Waller, JLPT Resources (tanos.co.uk)
          </a>{' '}
          — CC BY. JLPT 공식 목록이 아닌 학습용 참고 자료입니다. 한국어 뜻은 자동 생성되어 오류가
          있을 수 있습니다.
        </p>
      </section>
    </div>
  )
}
