import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db, getSetting, setSetting, type Level } from '../../db/schema'
import {
  DEFAULT_TTS_RATE,
  RATE_PRESETS,
  initVoices,
  jaVoices,
  labelJaVoice,
  shortVoiceName,
  speakJa,
} from '../../lib/tts'
import { downloadBackup, importBackup, resetAll } from '../../lib/backup'
import { LEVEL_DESC, LEVEL_ORDER } from '../../lib/levels'
import { DEFAULT_TARGET_LEVEL } from '../../srs/queue'
import { useAuth } from '../../lib/useAuth'
import { signOut } from '../../lib/supabase'
import { resetSyncCursor, syncNow } from '../../lib/sync'

/** 미리 듣기 문장 — 속도·목소리 차이를 느낄 수 있을 만큼의 길이 */
const SAMPLE_JA = 'こんにちは。今日は日本語を勉強しましょう。'

export default function SettingsPage() {
  const navigate = useNavigate()
  const [targetLevel, setTargetLevel] = useState<Level>(DEFAULT_TARGET_LEVEL)
  const auth = useAuth()
  const [syncMsg, setSyncMsg] = useState('')
  const [syncing, setSyncing] = useState(false)

  async function doSync() {
    setSyncing(true)
    setSyncMsg('')
    try {
      const r = await syncNow()
      setSyncMsg(`✅ 동기화 완료 — 올림 ${r.pushed}건, 받음 ${r.pulled}건`)
    } catch (err) {
      setSyncMsg(`❌ ${err instanceof Error ? err.message : '동기화에 실패했습니다.'}`)
    } finally {
      setSyncing(false)
    }
  }

  async function doSignOut() {
    if (!window.confirm('로그아웃할까요? 이 기기의 학습 기록은 그대로 남습니다.')) return
    await signOut()
    await resetSyncCursor()
    setSyncMsg('로그아웃되었습니다.')
  }
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [ttsReady, setTtsReady] = useState(false)
  const [voiceName, setVoiceName] = useState('')
  const [rate, setRate] = useState(DEFAULT_TTS_RATE)
  const [newLimit, setNewLimit] = useState(10)
  const [reviewLimit, setReviewLimit] = useState(100)
  const [backupMsg, setBackupMsg] = useState('')
  const [showReading, setShowReading] = useState(true)

  useEffect(() => {
    getSetting('showReading', true).then(setShowReading)
    getSetting<Level>('targetLevel', DEFAULT_TARGET_LEVEL).then(setTargetLevel)
  }, [])
  const [examDate, setExamDate] = useState('')
  const [reminderOn, setReminderOn] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const flagged = useLiveQuery(() => db.cards.filter((c) => !!c.flagged).toArray(), [])

  async function toggleReminder() {
    if (!reminderOn) {
      if (typeof Notification === 'undefined') {
        setBackupMsg('❌ 이 브라우저는 알림을 지원하지 않습니다.')
        return
      }
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setBackupMsg('❌ 알림 권한이 거부되었습니다. 브라우저 설정에서 허용해 주세요.')
        return
      }
    }
    const next = !reminderOn
    setReminderOn(next)
    await setSetting('reminderEnabled', next)
  }

  async function copyFlagged() {
    if (!flagged || flagged.length === 0) return
    const text = flagged.map((c) => `${c.id}\t${c.kanji}\t${c.kana}\t${c.ko}`).join('\n')
    await navigator.clipboard.writeText(text)
    setBackupMsg(`✅ 신고 단어 ${flagged.length}개를 클립보드에 복사했습니다.`)
  }

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
      getSetting('ttsRate', DEFAULT_TTS_RATE),
      getSetting('dailyNewLimit', 10),
      getSetting('dailyReviewLimit', 100),
      getSetting('examDate', ''),
      getSetting('reminderEnabled', false),
    ]).then(([, v, r, nl, rl, ed, ro]) => {
      setExamDate(ed)
      setReminderOn(ro && typeof Notification !== 'undefined' && Notification.permission === 'granted')
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

      {/* 계정 */}
      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">계정</h2>
        {auth.loading ? (
          <p className="text-sm text-slate-400">확인 중…</p>
        ) : auth.session ? (
          <>
            <p className="text-sm">
              <b className="text-rose-600">{auth.email}</b> 로 로그인됨
            </p>
            <p className="text-xs leading-relaxed text-slate-400">
              학습 기록이 계정에 저장됩니다. 다른 기기에서 같은 이메일로 로그인하면 이어서 학습할
              수 있어요.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void doSync()}
                disabled={syncing}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {syncing ? '동기화 중…' : '🔄 지금 동기화'}
              </button>
              <button
                type="button"
                onClick={() => void doSignOut()}
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-500 ring-1 ring-slate-200"
              >
                로그아웃
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs leading-relaxed text-slate-400">
              로그인하면 학습 기록이 계정에 저장되어 <b>여러 기기에서 이어서</b> 학습할 수 있습니다.
              지금 이 기기의 기록은 첫 로그인 시 계정으로 합쳐집니다.
            </p>
            <button
              type="button"
              onClick={() => navigate('/auth')}
              className="w-full rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white"
            >
              이메일로 로그인 / 회원가입
            </button>
          </>
        )}
        {syncMsg && <p className="text-sm">{syncMsg}</p>}
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">목표 레벨</h2>
        <p className="text-xs leading-relaxed text-slate-400">
          선택한 레벨까지의 단어·문법만 학습 대상이 됩니다. (예: N3 선택 시 N5·N4·N3)
        </p>
        <div className="flex gap-1.5">
          {LEVEL_ORDER.map((lv) => (
            <button
              key={lv}
              type="button"
              onClick={async () => {
                setTargetLevel(lv)
                await setSetting('targetLevel', lv)
              }}
              className={`flex-1 rounded-xl py-2 text-sm font-extrabold ${
                targetLevel === lv
                  ? 'bg-rose-600 text-white'
                  : 'bg-white text-slate-500 ring-1 ring-slate-200'
              }`}
            >
              {lv}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">{LEVEL_DESC[targetLevel]}</p>
        <button
          type="button"
          onClick={() => navigate('/onboarding')}
          className="w-full rounded-xl bg-white py-2 text-sm font-semibold text-slate-500 ring-1 ring-slate-200"
        >
          📖 사용법 다시 보기
        </button>
      </section>

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
        <label className="flex items-center justify-between text-sm">
          <span>
            카드 앞면에 읽기 표시
            <span className="block text-xs text-slate-400">한자 아래 히라가나를 항상 보여줍니다</span>
          </span>
          <input
            type="checkbox"
            checked={showReading}
            onChange={async (e) => {
              setShowReading(e.target.checked)
              await setSetting('showReading', e.target.checked)
            }}
            className="h-5 w-5 accent-rose-600"
          />
        </label>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">목표</h2>
        <label className="flex items-center justify-between text-sm">
          시험일 (D-day 페이스 계산)
          <input
            type="date"
            value={examDate}
            onChange={async (e) => {
              setExamDate(e.target.value)
              await setSetting('examDate', e.target.value)
            }}
            className="rounded-lg border border-rose-100 px-3 py-1.5"
          />
        </label>
        <label className="flex items-center justify-between text-sm">
          복습 리마인더 (브라우저 알림)
          <button
            type="button"
            onClick={() => void toggleReminder()}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              reminderOn ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {reminderOn ? '켜짐' : '꺼짐'}
          </button>
        </label>
        <p className="text-xs text-slate-400">
          알림은 브라우저가 열려 있을 때 동작합니다. 휴대폰 푸시는 배포 후 지원됩니다.
        </p>
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
            <div className="space-y-1.5">
              <p className="text-sm">목소리</p>
              {/* 이름만으로는 남녀를 알 수 없어 성별을 붙이고, 각 줄에서 바로 들어볼 수 있게 한다 */}
              {[{ name: '', label: '자동 (권장)' }, ...voices.map((v) => ({ name: v.name, label: '' }))].map(
                (opt) => {
                  const v = voices.find((x) => x.name === opt.name)
                  const meta = v ? labelJaVoice(v) : null
                  const selected = voiceName === opt.name
                  return (
                    <div
                      key={opt.name || 'auto'}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
                        selected ? 'bg-rose-600 text-white' : 'bg-white ring-1 ring-slate-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={async () => {
                          setVoiceName(opt.name)
                          await setSetting('ttsVoice', opt.name)
                          speakJa(SAMPLE_JA, { voiceName: opt.name || undefined, rate })
                        }}
                        className="flex flex-1 items-center gap-2 text-left text-sm font-semibold"
                      >
                        <span>{v ? shortVoiceName(v) : opt.label}</span>
                        {meta?.gender && (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                              selected
                                ? 'bg-white/20'
                                : meta.gender === '여성'
                                  ? 'bg-rose-50 text-rose-600'
                                  : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {meta.gender}
                          </span>
                        )}
                        {meta?.natural && (
                          <span className={`text-[11px] ${selected ? 'opacity-80' : 'text-slate-400'}`}>
                            고품질
                          </span>
                        )}
                      </button>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={() => speakJa(SAMPLE_JA, { voiceName: opt.name || undefined, rate })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') speakJa(SAMPLE_JA, { voiceName: opt.name || undefined, rate })
                        }}
                        className="shrink-0 rounded-full px-2 py-1 text-base"
                        aria-label="미리 듣기"
                      >
                        🔊
                      </span>
                    </div>
                  )
                },
              )}
            </div>

            <div className="space-y-1.5">
              <p className="text-sm">말하기 속도</p>
              <div className="flex gap-1.5">
                {RATE_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={async () => {
                      setRate(p.value)
                      await setSetting('ttsRate', p.value)
                      speakJa(SAMPLE_JA, { voiceName: voiceName || undefined, rate: p.value })
                    }}
                    className={`flex-1 rounded-xl py-2 text-xs font-bold ${
                      Math.abs(rate - p.value) < 0.01
                        ? 'bg-rose-600 text-white'
                        : 'bg-white text-slate-500 ring-1 ring-slate-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <input
                type="range"
                min="0.5"
                max="1.3"
                step="0.05"
                value={rate}
                onChange={async (e) => {
                  const v = Number(e.target.value)
                  setRate(v)
                  await setSetting('ttsRate', v)
                }}
                onMouseUp={() => speakJa(SAMPLE_JA, { voiceName: voiceName || undefined, rate })}
                onTouchEnd={() => speakJa(SAMPLE_JA, { voiceName: voiceName || undefined, rate })}
                className="w-full accent-rose-600"
              />
              <p className="text-xs text-slate-400">현재 {rate.toFixed(2)}배속</p>
            </div>
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
          {(flagged?.length ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => void copyFlagged()}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-amber-600 shadow-sm ring-1 ring-amber-100"
            >
              🚩 신고 단어 {flagged!.length}개 복사
            </button>
          )}
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
          있을 수 있습니다. 피치 악센트:{' '}
          <a className="underline" href="https://github.com/mifunetoshiro/kanjium" target="_blank" rel="noreferrer">
            kanjium
          </a>{' '}
          (CC BY-SA 4.0).
        </p>
      </section>
    </div>
  )
}
