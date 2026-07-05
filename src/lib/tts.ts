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

export interface SpeakOptions {
  rate?: number
  voiceName?: string
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
  utter.rate = opts.rate ?? 0.9
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
