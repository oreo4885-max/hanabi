import { Link } from 'react-router-dom'
import { parseFurigana } from '../lib/furigana'

export { parseFurigana, stripFurigana } from '../lib/furigana'

interface Props {
  /** 후리가나 마크업 문장. 없으면 plain을 그대로 보여준다 */
  marked?: string
  plain: string
  /** 한자를 누르면 해당 레벨 단어장에서 검색되도록 링크를 건다 */
  deckId?: string
  className?: string
}

/**
 * 예문을 후리가나(한자 위 히라가나)와 함께 표시한다.
 * 한자 부분은 단어장 검색으로 연결돼 바로 찾아볼 수 있다.
 */
export default function Furigana({ marked, plain, deckId, className }: Props) {
  if (!marked) return <span className={className}>{plain}</span>
  const segments = parseFurigana(marked)

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (!seg.reading) return <span key={i}>{seg.text}</span>
        const body = (
          <ruby className="rounded px-px hover:bg-rose-50">
            {seg.text}
            <rt className="text-[0.55em] text-slate-400">{seg.reading}</rt>
          </ruby>
        )
        if (!deckId) return <span key={i}>{body}</span>
        return (
          <Link
            key={i}
            to={`/decks/${deckId}?q=${encodeURIComponent(seg.text)}`}
            onClick={(e) => e.stopPropagation()}
            // 눌러볼 수 있다는 걸 색으로 알린다
            className="text-sky-600 underline decoration-sky-300 decoration-dotted underline-offset-4"
            title={`${seg.text} 단어장에서 찾기`}
          >
            {body}
          </Link>
        )
      })}
    </span>
  )
}
