import data from './talk.json'

export interface TalkSentence {
  ja: string
  ko: string
}

export interface TalkTheme {
  key: string
  name: string
  icon: string
  sentences: TalkSentence[]
}

export const TALK_THEMES: TalkTheme[] = data as TalkTheme[]
