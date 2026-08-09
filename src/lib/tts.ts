let voices: SpeechSynthesisVoice[] = []
let initPromise: Promise<SpeechSynthesisVoice[]> | null = null

/**
 * 음성 목록 초기화. getVoices()는 첫 호출에 빈 배열을 반환할 수 있어
 * voiceschanged 이벤트 + 폴링으로 보완한다.
 */
export function initVoices(): Promise<SpeechSynthesisVoice[]> {
  if (initPromise) return initPromise
  initPromise = new Promise((resolve) => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
    if (!synth) {
      resolve([])
      return
    }
    let settled = false
    const collect = () => {
      const v = synth.getVoices()
      if (v.length > 0 && !settled) {
        settled = true
        voices = v
        resolve(v)
      }
      return settled
    }
    if (collect()) return
    synth.addEventListener('voiceschanged', () => collect())
    let tries = 0
    const iv = setInterval(() => {
      if (collect() || ++tries >= 15) {
        clearInterval(iv)
        if (!settled) {
          settled = true
          resolve(voices)
        }
      }
    }, 200)
  })
  return initPromise
}

/** ja-JP / ja_JP 등 표기 차이를 흡수해 일본어 음성만 반환 */
export function jaVoices(): SpeechSynthesisVoice[] {
  return voices.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('ja'))
}

export function ttsAvailable(): boolean {
  return jaVoices().length > 0
}

/** 목소리 이름으로 성별 추정 (Windows/Edge·macOS·Android 기본 일본어 음성 기준) */
const FEMALE_NAMES = [
  'Nanami', 'Ayumi', 'Haruka', 'Kyoko', 'Mayu', 'Sayaka', 'Shiori', 'Aoi', 'Hina',
  'Mio', 'O-ren', 'Oren',
]
const MALE_NAMES = ['Keita', 'Ichiro', 'Otoya', 'Daichi', 'Naoki', 'Masaru', 'Hattori']

export interface VoiceLabel {
  gender: '여성' | '남성' | null
  /** Edge 신경망(Natural) 등 고품질 음성 여부 */
  natural: boolean
}

export function labelJaVoice(v: SpeechSynthesisVoice): VoiceLabel {
  const name = v.name
  // 안드로이드 음성은 이름에 female/male이 직접 들어간다
  const gender = /female/i.test(name)
    ? '여성'
    : /\bmale/i.test(name)
      ? '남성'
      : FEMALE_NAMES.some((n) => name.includes(n))
        ? '여성'
        : MALE_NAMES.some((n) => name.includes(n))
          ? '남성'
          : /google/i.test(name)
            ? '여성' // 구글 일본어 기본 음성은 여성
            : null
  return { gender, natural: /natural|neural/i.test(name) }
}

/** 목록에 보여줄 짧은 이름 — 'Microsoft Nanami Online (Natural) - Japanese (Japan)' → 'Nanami' */
export function shortVoiceName(v: SpeechSynthesisVoice): string {
  const known = [...FEMALE_NAMES, ...MALE_NAMES].find((n) => v.name.includes(n))
  if (known) return known
  if (/google/i.test(v.name)) return '구글 일본어'
  return (
    v.name
      .replace(/^Microsoft\s*/i, '')
      .replace(/\s*(Online\s*)?\(.*?\)\s*/g, ' ')
      .replace(/\s*-\s*Japanese.*$/i, '')
      .trim() || v.name
  )
}

/** 선호 이름 → Natural(Edge 신경망) → Google → 아무 일본어 음성 순으로 선택 */
export function pickJaVoice(preferredName?: string): SpeechSynthesisVoice | null {
  const ja = jaVoices()
  if (ja.length === 0) return null
  if (preferredName) {
    const found = ja.find((v) => v.name === preferredName)
    if (found) return found
  }
  return (
    ja.find((v) => v.name.includes('Natural')) ??
    ja.find((v) => v.name.includes('Google')) ??
    ja[0]
  )
}

/** 학습용 기본 속도 — 원어민 속도(1.0)는 초급자에게 빨라서 조금 낮춘다 */
export const DEFAULT_TTS_RATE = 0.85

/** 설정 화면에서 고를 수 있는 속도 프리셋 */
export const RATE_PRESETS: { value: number; label: string }[] = [
  { value: 0.6, label: '아주 느리게' },
  { value: 0.75, label: '느리게' },
  { value: 0.85, label: '보통' },
  { value: 1, label: '원어민' },
]

export interface SpeakOptions {
  rate?: number
  voiceName?: string
  /** 발화가 끝났을 때 (연속 재생용) */
  onEnd?: () => void
}

// cancel() 직후 speak()가 무시되는 브라우저 버그 대응용 상태
let pendingTimer: ReturnType<typeof setTimeout> | null = null
// GC로 발화가 중간에 끊기는 Chrome 버그 방지용 참조 유지
let currentUtter: SpeechSynthesisUtterance | null = null
export function _keepAlive() {
  return currentUtter
}

/** 일본어 텍스트 발화. 음성이 없으면 조용히 무시. */
export function speakJa(text: string, opts: SpeakOptions = {}): void {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
  if (!synth) return
  const voice = pickJaVoice(opts.voiceName)
  if (!voice) return

  const utter = new SpeechSynthesisUtterance(text)
  utter.voice = voice
  utter.lang = voice.lang
  utter.rate = opts.rate ?? DEFAULT_TTS_RATE
  if (opts.onEnd) utter.onend = opts.onEnd
  currentUtter = utter

  if (pendingTimer) clearTimeout(pendingTimer)

  const speakNow = () => {
    pendingTimer = null
    // Edge 온라인 음성이 일시정지 상태로 남는 경우 방지
    synth.resume()
    synth.speak(utter)
  }

  if (synth.speaking || synth.pending) {
    // cancel이 정리될 시간을 준 뒤 발화 (즉시 speak하면 무시되는 버그)
    synth.cancel()
    pendingTimer = setTimeout(speakNow, 80)
  } else {
    speakNow()
  }
}
