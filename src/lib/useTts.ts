import { useEffect, useState } from 'react'
import { getSetting } from '../db/schema'
import { initVoices, jaVoices, speakJa } from './tts'

/** 일본어 TTS 상태 + 발화 함수. ready 전에는 available=false. */
export function useTts() {
  const [ready, setReady] = useState(false)
  const [available, setAvailable] = useState(false)
  const [voiceName, setVoiceName] = useState<string | undefined>(undefined)
  const [rate, setRate] = useState(0.9)

  useEffect(() => {
    let alive = true
    Promise.all([
      initVoices(),
      getSetting<string | undefined>('ttsVoice', undefined),
      getSetting('ttsRate', 0.9),
    ]).then(([, savedVoice, savedRate]) => {
      if (!alive) return
      setAvailable(jaVoices().length > 0)
      setVoiceName(savedVoice)
      setRate(savedRate)
      setReady(true)
    })
    return () => {
      alive = false
    }
  }, [])

  function speak(text: string) {
    speakJa(text, { voiceName, rate })
  }

  return { ready, available, speak, voiceName, rate }
}
