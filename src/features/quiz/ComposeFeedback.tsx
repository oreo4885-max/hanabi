import type { ComposeResult } from '../../lib/compose'
import { composeVerdict } from '../../lib/compose'
import type { Card } from '../../db/schema'
import Furigana from '../../components/Furigana'

interface Props {
  result: ComposeResult
  card: Card
  onSpeak?: () => void
}

/** 작문 채점 결과 — 정답률, 글자 단위 지적, 정답 문장(후리가나 + 듣기) */
export default function ComposeFeedback({ result, card, onSpeak }: Props) {
  const verdict = composeVerdict(result.percent)
  const good = result.correct

  return (
    <div className={`space-y-3 rounded-2xl p-4 ${good ? 'bg-emerald-50' : 'bg-red-50'}`}>
      <div className="flex items-baseline justify-between">
        <p className={`font-bold ${good ? 'text-emerald-600' : 'text-red-500'}`}>
          {verdict.emoji} {verdict.label}
        </p>
        <p className={`text-2xl font-extrabold ${good ? 'text-emerald-600' : 'text-red-500'}`}>
          {result.percent}%
        </p>
      </div>

      {/* 정답률 막대 */}
      <div className="h-2 overflow-hidden rounded-full bg-white/70">
        <div
          className={`h-full rounded-full ${good ? 'bg-emerald-500' : 'bg-red-400'}`}
          style={{ width: `${result.percent}%` }}
        />
      </div>

      {/* 글자 단위 지적 — 두 문장을 섞으면 읽을 수 없으므로 각각 한 줄로 나눠 표시한다 */}
      {result.percent < 100 && (
        <div className="space-y-2 rounded-xl bg-white/70 px-3 py-2">
          <div>
            <p className="mb-0.5 text-[11px] font-semibold text-slate-400">내가 쓴 문장</p>
            <p className="font-ja text-base leading-relaxed">
              {result.diff
                .filter((op) => op.type !== 'missing')
                .map((op, i) =>
                  op.type === 'same' ? (
                    <span key={i}>{op.text}</span>
                  ) : (
                    <span key={i} className="rounded bg-red-100 px-0.5 text-red-500" title="잘못 쓴 글자">
                      {op.text}
                    </span>
                  ),
                )}
            </p>
          </div>
          <div>
            <p className="mb-0.5 text-[11px] font-semibold text-slate-400">이렇게 써야 해요</p>
            <p className="font-ja text-base leading-relaxed">
              {result.diff
                .filter((op) => op.type !== 'extra')
                .map((op, i) =>
                  op.type === 'same' ? (
                    <span key={i}>{op.text}</span>
                  ) : (
                    <span
                      key={i}
                      className="rounded bg-emerald-100 px-0.5 font-bold text-emerald-700"
                      title="빠뜨리거나 틀린 글자"
                    >
                      {op.text}
                    </span>
                  ),
                )}
            </p>
          </div>
          <p className="text-[11px] text-slate-400">
            <span className="rounded bg-red-100 px-1 text-red-500">빨강</span> 잘못 쓴 곳 ·{' '}
            <span className="rounded bg-emerald-100 px-1 font-bold text-emerald-700">초록</span> 들어가야
            할 글자
          </p>
        </div>
      )}

      {/* 정답 문장 */}
      <div className="rounded-xl bg-white/70 px-3 py-2">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="mb-0.5 text-[11px] font-semibold text-slate-400">정답</p>
            <Furigana
              marked={card.exFuri}
              plain={card.exJa ?? ''}
              deckId={card.deckId}
              className="font-ja block text-base leading-loose"
            />
            <p className="mt-1 font-ja text-xs text-slate-400">{result.normalizedExpected}</p>
            {card.exKo && <p className="mt-0.5 text-xs text-slate-500">{card.exKo}</p>}
          </div>
          {onSpeak && (
            <button
              type="button"
              onClick={onSpeak}
              className="shrink-0 rounded-full bg-white px-2.5 py-1.5 text-lg shadow-sm"
              aria-label="정답 문장 듣기"
            >
              🔊
            </button>
          )}
        </div>
      </div>

      {/* 이번 문제에서 쓰인 단어 */}
      <p className="text-xs text-slate-500">
        핵심 단어 <span className="font-ja font-semibold">{card.kanji}</span>
        {card.kana !== card.kanji && <span className="font-ja"> ({card.kana})</span>} — {card.ko}
      </p>
    </div>
  )
}
