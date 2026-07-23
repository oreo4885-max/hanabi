# 하나비 (Hanabi) 🎆

개인 학습용 JLPT 일본어 단어 암기 PWA. 플래시카드(FSRS 간격반복), 퀴즈 5종, 26초 스피드 모드, 가나 학습, 문법 활용 드릴, 한자 분해, 피치 악센트, TTS 발음을 제공합니다.

**앱 사용**: https://oreo4885-max.github.io/hanabi/

## 데이터 출처 및 라이선스 고지

- **JLPT 단어 목록(한자·읽기)**: [Jonathan Waller — JLPT Resources](https://www.tanos.co.uk/jlpt/)
  ([CC BY](https://creativecommons.org/licenses/by/4.0/)) 에서 파생된
  [jamsinclair/open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks) 의 CSV를 기반으로 하며,
  표기 정규화 등 일부 수정이 있었습니다.
- 이 목록은 **JLPT 공식 출제 목록이 아닙니다** (공식 목록은 2010년 이후 비공개). 학습 참고용입니다.
- **한국어 뜻·품사·예문·연상 문장·이모지 매칭·한자 훈음/분해·문형**: 이 프로젝트에서 AI(Claude)로 생성한 것으로, 오류가 있을 수 있습니다.
- **피치 악센트(억양) 데이터**: [mifunetoshiro/kanjium](https://github.com/mifunetoshiro/kanjium)
  ([CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)) — `src/data/pitch.json`은 이 데이터에서 파생되어 동일 라이선스를 따릅니다.

## 개발

```
npm install
npm run dev      # http://localhost:5173
npm test         # vitest
deploy.cmd       # GitHub Pages 배포 (gh-pages 브랜치)
```

개인 프로젝트입니다. 학습 기록은 서버 없이 사용자 브라우저(IndexedDB)에만 저장됩니다.
