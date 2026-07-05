/** "**소리**" 강조 표기가 포함된 연상 문장을 렌더링 */
export default function Mnemonic({ text }: { text: string }) {
  const parts = text.split('**')
  return (
    <p className="text-sm leading-relaxed text-slate-500">
      💡{' '}
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <b key={i} className="text-rose-600">
            {part}
          </b>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  )
}
