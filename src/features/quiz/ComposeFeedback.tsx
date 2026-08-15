import type { ComposeResult } from '../../lib/compose'
import { HINT_MIN_PERCENT, composeHints, composeVerdict } from '../../lib/compose'
import { grammarNotes } from '../../lib/grammarNotes'
import type { Card } from '../../db/schema'
import Furigana from '../../components/Furigana'

interface Props {
  result: ComposeResult
  card: Card
  onSpeak?: () => void
  /** 다른 표현으로 맞게 썼을 때 사용자가 직접 정답 처리 */
  onSelfMark?: () => void
  selfMarked?: boolean
}

/**
 * 작문 첨삭 결과.
 *
 * 앱은 문장당 모범 답안을 하나만 알고 있어서 "다르지만 맞는 답"을 가려낼 수 없다.
 * 그래서 정답/오답을 단정하지 않고 무엇이 다른지 보여준 뒤,
 * 판단은 사용자가 내릴 수 있게 한다.
 */
export default function ComposeFeedback({
  result,
  card,
  onSpeak,
  onSelfMark,
  selfMarked,
}: Props) {
  const verdict = composeVerdict(result.percent)
  const good = result.correct || !!selfMarked
  // 문장이 통째로 다르면 글자 단위 지적은 소음이라 접는다
  const closeEnough = result.percent >= HINT_MIN_PERCENT && result.percent < 100
  const hints = closeEnough ? composeHints(result.diff) : []
  // 왜 다른지 — 많이 틀렸을 때야말로 이유 설명이 필요하므로 점수와 무관하게 보여준다
  const notes =
    result.percent < 100
      ? grammarNotes(result.normalizedExpected, result.normalizedInput, {
          diff: result.diff,
          percent: result.percent,
        })
      : []

  return (
    <div className={`space-y-3 rounded-2xl p-4 ${good ? 'bg-emerald-50' : 'bg-amber-50'}`}>
      <div className="flex items-baseline justify-between">
        <p className={`font-bold ${good ? 'text-emerald-600' : 'text-amber-700'}`}>
          {selfMarked ? '✅ 정답으로 처리했어요' : `${verdict.emoji} ${verdict.label}`}
        </p>
        <p className="shrink-0 text-right">
          <span className={`text-2xl font-extrabold ${good ? 'text-emerald-600' : 'text-amber-600'}`}>
            {result.percent}%
          </span>
          <span className="block text-[11px] text-slate-400">모범 답안과 일치도</span>
        </p>
      </div>

      {/* 일치도 막대 */}
      <div className="h-2 overflow-hidden rounded-full bg-white/70">
        <div
          className={`h-full rounded-full ${good ? 'bg-emerald-500' : 'bg-amber-400'}`}
          style={{ width: `${result.percent}%` }}
        />
      </div>

      {/* 왜 다른지 — 무엇이 다른지보다 이쪽이 실제로 배움이 된다 */}
      {notes.length > 0 && (
        <div className="space-y-2 rounded-xl bg-white/80 px-3 py-2.5">
          <p className="text-[11px] font-semibold text-slate-400">왜 다를까요?</p>
          {notes.map((n, i) => (
            <div key={i}>
              <p className="font-ja text-sm font-bold text-amber-700">{n.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{n.detail}</p>
            </div>
          ))}
        </div>
      )}

      {/* 많이 다를 때는 글자를 짚기보다 모범 답안을 통째로 익히도록 안내한다 */}
      {!closeEnough && result.percent < 100 && (
        <p className="rounded-xl bg-white/70 px-3 py-2 text-sm text-slate-600">
          ✏️ 모범 답안과 구조가 많이 달라요. 아래 문장을 소리 내어 읽어 보고 다시 도전해 보세요.
        </p>
      )}

      {/* 무엇이 어떻게 다른지 말로 알려준다 */}
      {hints.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-white/70 px-3 py-2 text-sm">
          {hints.map((h, i) => (
            <li key={i} className="flex gap-1.5">
              <span className="text-slate-400">✏️</span>
              <span className="font-ja">{h}</span>
            </li>
          ))}
        </ul>
      )}

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
            <p className="mb-0.5 text-[11px] font-semibold text-slate-400">모범 답안은 이래요</p>
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
            <span className="rounded bg-red-100 px-1 text-red-500">빨강</span> 다르게 쓴 곳 ·{' '}
            <span className="rounded bg-emerald-100 px-1 font-bold text-emerald-700">초록</span> 모범
            답안 쪽 글자
          </p>
        </div>
      )}

      {/* 정답 문장 */}
      <div className="rounded-xl bg-white/70 px-3 py-2">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="mb-0.5 text-[11px] font-semibold text-slate-400">모범 답안</p>
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

      {/* 앱은 모범 답안 하나만 알고 있으므로, 다른 표현으로 맞게 쓴 경우는 사용자가 판단한다 */}
      {!result.correct && onSelfMark && (
        <button
          type="button"
          onClick={onSelfMark}
          disabled={selfMarked}
          className="w-full rounded-xl bg-white py-2.5 text-sm font-bold text-emerald-700 ring-1 ring-emerald-200 disabled:opacity-50"
        >
          {selfMarked ? '정답으로 처리됨' : '🙋 제 답도 맞는 것 같아요'}
        </button>
      )}
    </div>
  )
}
