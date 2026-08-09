import { Link } from 'react-router-dom'

/** `会(あ)います` 형태의 마크업을 한자 덩어리와 읽기로 분해 */
interface Segment {
  text: string
  reading?: string
}

const RUBY_RE = /([一-鿿々〆ヵヶ]+)\(([ぁ-んー]+)\)/g

export function parseFurigana(marked: string): Segment[] {
  const out: Segment[] = []
  let last = 0
  for (const m of marked.matchAll(RUBY_RE)) {
    const idx = m.index ?? 0
    if (idx > last) out.push({ text: marked.slice(last, idx) })
    out.push({ text: m[1], reading: m[2] })
    last = idx + m[0].length
  }
  if (last < marked.length) out.push({ text: marked.slice(last) })
  return out
}

/** 마크업에서 후리가나를 걷어낸 원문 (TTS·검증용) */
export function stripFurigana(marked: string): string {
  return marked.replace(RUBY_RE, '$1')
}

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
            className="text-inherit no-underline"
            title={`${seg.text} 단어장에서 찾기`}
          >
            {body}
          </Link>
        )
      })}
    </span>
  )
}
