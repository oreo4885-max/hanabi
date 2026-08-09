import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setSetting, type Level } from '../../db/schema'
import { LEVEL_DESC, LEVEL_ORDER } from '../../lib/levels'
import { markOnboarded } from '../../lib/onboarding'

const MENUS = [
  { icon: '🔁', name: '복습', desc: '오늘 볼 카드를 자동으로 골라줍니다. 매일 여기부터 시작하세요.' },
  { icon: '⚡', name: '26초 스피드', desc: '짧게 훑기. 카드를 좌우로 밀어 안다/모른다만 판정합니다.' },
  { icon: '✏️', name: '퀴즈', desc: '뜻·단어 고르기, 주관식, 예문 빈칸, 받아쓰기 5종.' },
  { icon: 'あ', name: '가나', desc: '히라가나·가타카나 오십음도와 미니 퀴즈.' },
  { icon: '✍️', name: '문법', desc: '동사·형용사 활용 규칙을 배우고 바로 드릴로 연습.' },
  { icon: '🎧', name: '회화', desc: '상황별 문장 401개를 연속 재생. 이동 중 듣기용.' },
]

const TIPS = [
  '카드를 볼 때 소리 내어 따라 읽으면 훨씬 오래 남습니다.',
  '애매하면 솔직하게 "다시"를 누르세요. 그래야 복습 간격이 정확해집니다.',
  '한 번에 30분보다, 26초 모드를 하루 여러 번이 더 효과적입니다.',
]

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [level, setLevel] = useState<Level>('N5')

  async function finish() {
    await setSetting('targetLevel', level)
    await setSetting('onboarded', true)
    // DB 반영 전에 화면이 되튀지 않도록 동기 플래그를 먼저 세운다
    markOnboarded()
    navigate('/', { replace: true })
  }

  const steps = [
    // 0. 환영
    <div key="welcome" className="flex flex-col items-center gap-4 text-center">
      <p className="text-6xl">🎆</p>
      <h1 className="text-2xl font-extrabold">하나비에 오신 걸 환영합니다</h1>
      <p className="text-sm leading-relaxed text-slate-500">
        JLPT 단어 <b>8,129개</b>, 문형 <b>525개</b>, 회화 <b>401문장</b>을
        <br />
        기억에 남는 방식으로 익히는 앱입니다.
      </p>
      <ul className="w-full space-y-2 text-left text-sm text-slate-600">
        <li className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
          🧠 <b>간격 반복(FSRS)</b> — 잊을 때쯤 다시 보여줍니다
        </li>
        <li className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
          🀄 <b>한자 분해</b> — 한국 한자음으로 뜻을 연결
        </li>
        <li className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
          🔊 <b>발음·억양</b> — 소리와 고저 억양선까지
        </li>
      </ul>
    </div>,

    // 1. 레벨 선택
    <div key="level" className="space-y-3">
      <h1 className="text-xl font-extrabold">목표 레벨을 정해 주세요</h1>
      <p className="text-sm text-slate-500">
        선택한 레벨까지의 단어·문법만 학습 대상이 됩니다. 나중에 설정에서 바꿀 수 있어요.
      </p>
      <div className="space-y-2">
        {LEVEL_ORDER.map((lv) => (
          <button
            key={lv}
            type="button"
            onClick={() => setLevel(lv)}
            className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left ${
              level === lv ? 'border-rose-400 bg-rose-50' : 'border-slate-200 bg-white'
            }`}
          >
            <span
              className={`w-10 shrink-0 rounded-lg py-1 text-center text-sm font-extrabold ${
                level === lv ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {lv}
            </span>
            <span className="min-w-0 text-sm">{LEVEL_DESC[lv]}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400">
        💡 처음이라면 <b>N5</b>부터 시작하는 것을 권합니다.
      </p>
    </div>,

    // 2. 메뉴 소개
    <div key="menus" className="space-y-3">
      <h1 className="text-xl font-extrabold">이렇게 사용하세요</h1>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {MENUS.map((m) => (
          <li key={m.name} className="flex gap-3 px-4 py-3">
            <span className="w-6 shrink-0 text-center text-lg font-ja">{m.icon}</span>
            <span className="min-w-0">
              <b className="text-sm">{m.name}</b>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{m.desc}</p>
            </span>
          </li>
        ))}
      </ul>
    </div>,

    // 3. 팁 + 시작
    <div key="tips" className="space-y-3">
      <h1 className="text-xl font-extrabold">시작하기 전에</h1>
      <ul className="space-y-2">
        {TIPS.map((t) => (
          <li key={t} className="rounded-xl bg-amber-50 p-3 text-sm leading-relaxed text-amber-800 ring-1 ring-amber-100">
            💡 {t}
          </li>
        ))}
      </ul>
      <p className="rounded-xl bg-white p-3 text-xs leading-relaxed text-slate-500 ring-1 ring-slate-200">
        학습 기록은 이 기기에 저장됩니다. 설정에서 언제든 백업 파일로 내보내고, 다른 기기에서
        가져올 수 있어요.
      </p>
    </div>,
  ]

  const isLast = step === steps.length - 1

  return (
    <div className="flex min-h-[80svh] flex-col">
      {/* 진행 점 */}
      <div className="mb-5 flex justify-center gap-1.5">
        {steps.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i === step ? 'w-6 bg-rose-600' : 'w-1.5 bg-slate-200'
            }`}
          />
        ))}
      </div>

      <div className="flex-1">{steps[step]}</div>

      <div className="mt-6 flex gap-2">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-bold text-slate-500"
          >
            이전
          </button>
        )}
        <button
          type="button"
          onClick={() => (isLast ? void finish() : setStep((s) => s + 1))}
          className="flex-1 rounded-xl bg-rose-600 py-3 text-lg font-bold text-white"
        >
          {isLast ? '학습 시작하기 🎆' : '다음'}
        </button>
      </div>
    </div>
  )
}
