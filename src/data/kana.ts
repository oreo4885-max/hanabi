export interface KanaChar {
  kana: string // 히라가나 기준 (가타카나는 변환)
  romaji: string
}

export interface KanaRow {
  name: string
  chars: (KanaChar | null)[] // null = 오십음도 빈칸
}

const r = (kana: string, romaji: string): KanaChar => ({ kana, romaji })

export const SEION: KanaRow[] = [
  { name: 'あ행', chars: [r('あ', 'a'), r('い', 'i'), r('う', 'u'), r('え', 'e'), r('お', 'o')] },
  { name: 'か행', chars: [r('か', 'ka'), r('き', 'ki'), r('く', 'ku'), r('け', 'ke'), r('こ', 'ko')] },
  { name: 'さ행', chars: [r('さ', 'sa'), r('し', 'shi'), r('す', 'su'), r('せ', 'se'), r('そ', 'so')] },
  { name: 'た행', chars: [r('た', 'ta'), r('ち', 'chi'), r('つ', 'tsu'), r('て', 'te'), r('と', 'to')] },
  { name: 'な행', chars: [r('な', 'na'), r('に', 'ni'), r('ぬ', 'nu'), r('ね', 'ne'), r('の', 'no')] },
  { name: 'は행', chars: [r('は', 'ha'), r('ひ', 'hi'), r('ふ', 'fu'), r('へ', 'he'), r('ほ', 'ho')] },
  { name: 'ま행', chars: [r('ま', 'ma'), r('み', 'mi'), r('む', 'mu'), r('め', 'me'), r('も', 'mo')] },
  { name: 'や행', chars: [r('や', 'ya'), null, r('ゆ', 'yu'), null, r('よ', 'yo')] },
  { name: 'ら행', chars: [r('ら', 'ra'), r('り', 'ri'), r('る', 'ru'), r('れ', 're'), r('ろ', 'ro')] },
  { name: 'わ행', chars: [r('わ', 'wa'), null, null, null, r('を', 'wo')] },
  { name: 'ん', chars: [r('ん', 'n'), null, null, null, null] },
]

export const DAKUON: KanaRow[] = [
  { name: 'が행', chars: [r('が', 'ga'), r('ぎ', 'gi'), r('ぐ', 'gu'), r('げ', 'ge'), r('ご', 'go')] },
  { name: 'ざ행', chars: [r('ざ', 'za'), r('じ', 'ji'), r('ず', 'zu'), r('ぜ', 'ze'), r('ぞ', 'zo')] },
  { name: 'だ행', chars: [r('だ', 'da'), r('ぢ', 'ji'), r('づ', 'zu'), r('で', 'de'), r('ど', 'do')] },
  { name: 'ば행', chars: [r('ば', 'ba'), r('び', 'bi'), r('ぶ', 'bu'), r('べ', 'be'), r('ぼ', 'bo')] },
  { name: 'ぱ행', chars: [r('ぱ', 'pa'), r('ぴ', 'pi'), r('ぷ', 'pu'), r('ぺ', 'pe'), r('ぽ', 'po')] },
]

export const YOON: KanaRow[] = [
  { name: 'きゃ행', chars: [r('きゃ', 'kya'), r('きゅ', 'kyu'), r('きょ', 'kyo'), null, null] },
  { name: 'しゃ행', chars: [r('しゃ', 'sha'), r('しゅ', 'shu'), r('しょ', 'sho'), null, null] },
  { name: 'ちゃ행', chars: [r('ちゃ', 'cha'), r('ちゅ', 'chu'), r('ちょ', 'cho'), null, null] },
  { name: 'にゃ행', chars: [r('にゃ', 'nya'), r('にゅ', 'nyu'), r('にょ', 'nyo'), null, null] },
  { name: 'ひゃ행', chars: [r('ひゃ', 'hya'), r('ひゅ', 'hyu'), r('ひょ', 'hyo'), null, null] },
  { name: 'みゃ행', chars: [r('みゃ', 'mya'), r('みゅ', 'myu'), r('みょ', 'myo'), null, null] },
  { name: 'りゃ행', chars: [r('りゃ', 'rya'), r('りゅ', 'ryu'), r('りょ', 'ryo'), null, null] },
  { name: 'ぎゃ행', chars: [r('ぎゃ', 'gya'), r('ぎゅ', 'gyu'), r('ぎょ', 'gyo'), null, null] },
  { name: 'じゃ행', chars: [r('じゃ', 'ja'), r('じゅ', 'ju'), r('じょ', 'jo'), null, null] },
  { name: 'びゃ행', chars: [r('びゃ', 'bya'), r('びゅ', 'byu'), r('びょ', 'byo'), null, null] },
  { name: 'ぴゃ행', chars: [r('ぴゃ', 'pya'), r('ぴゅ', 'pyu'), r('ぴょ', 'pyo'), null, null] },
]

export const GROUPS = [
  { key: 'seion', name: '기본 (청음)', rows: SEION },
  { key: 'dakuon', name: '탁음·반탁음', rows: DAKUON },
  { key: 'yoon', name: '요음', rows: YOON },
] as const

export function allChars(rows: KanaRow[]): KanaChar[] {
  return rows.flatMap((row) => row.chars.filter((c): c is KanaChar => c !== null))
}
