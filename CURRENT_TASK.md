# Live-translate 진행 상황 (2026-02-04)

## ✅ 오늘 완료된 작업

### 1. 영어 번역 청취자 표시 수정
- **문제**: 설교자 페이지에서 영어 청취자 수가 표시되지 않음
- **원인**: `speaker.js`에서 영어('en') 청취자가 집계에서 누락됨
- **해결**: 
  - `public/js/speaker.js`: 영어 청취자 수 집계 및 🇺🇸 표시 추가
  - `public/speaker.html`: 안내 메시지에 영어 통역 언급 추가

### 2. 마이크 입력 없이 자동 음성 생성 방지
- **문제**: 청취 시작 시 마이크 입력 없이 자동으로 설교 음성 생성됨
- **원인**: 
  1. Gemini 연결 즉시 ActivityEnd 타이머 시작
  2. 시스템 프롬프트의 "항상 말하면서 번역하세요" 지침
- **해결**:
  - `lib/gemini-handler.js`: 첫 오디오 수신 시에만 ActivityEnd 타이머 시작
  - `lib/gemini-handler.js`: AUDIO_IDLE_THRESHOLD 추가 (1.5초 이상 오디오 없으면 스킵)
  - `lib/theological-context.js`: 시스템 프롬프트에 침묵 규칙 추가
    - "음성 입력 없으면 절대 말하지 마세요" 명시

### 3. 통역 딜레이 최적화
- **문제**: 번역 딜레이가 너무 심함
- **해결**: 
  - `ACTIVITY_END_INTERVAL`: 1.5초 → **1초**
  - `AUDIO_IDLE_THRESHOLD`: 2초 → **1.5초**

---

## 📁 수정된 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `lib/gemini-handler.js` | 타이머 시작 조건 수정, idle threshold 추가, 간격 최적화 |
| `lib/theological-context.js` | 시스템 프롬프트 침묵 규칙 추가 |
| `public/js/speaker.js` | 영어 청취자 수 표시 추가 |
| `public/speaker.html` | 영어 통역 안내 추가 |

---

## 🔧 현재 설정값

```javascript
// lib/gemini-handler.js
ACTIVITY_END_INTERVAL = 1000;   // 1초마다 ActivityEnd 신호
AUDIO_IDLE_THRESHOLD = 1500;    // 1.5초 이상 오디오 없으면 스킵
```

---

## 🚀 Git 커밋 이력

1. `7ef2e80` - fix: 영어 번역 문제 해결 및 자동 음성 생성 방지
2. `82d63aa` - perf: 통역 딜레이 최적화 - ActivityEnd 간격 1.5초→1초

---

## 🔍 다음 고도화 시 고려사항

### 딜레이 추가 최적화
- 현재 1초 간격으로 설정됨
- 더 빠른 응답 필요시 0.5~0.7초로 줄일 수 있음 (끊김 주의)
- Gemini 모델 자체의 처리 시간도 존재 (약 0.5~1초)

### 시스템 프롬프트 개선
- 현재 침묵 규칙 추가됨
- 번역 품질 향상을 위한 프롬프트 튜닝 가능

### Railway 자동 배포 설정
- 현재 수동 배포 (`railway up`) 사용 중
- GitHub 자동 배포 설정 확인 필요
- Railway Dashboard → Project Settings → Source

### 지원 언어
- 현재: 러시아어(ru), 중국어(zh), 베트남어(vi), 영어(en)
- 추가 언어 확장 가능: `server.js`, `config/system-prompts.json`, `config/theological-terms.json` 수정 필요

---

## 💻 실행 명령어

```bash
# 로컬 서버 시작
cd /Users/caleb/dev/Live-translate && npm start

# Railway 수동 배포
cd /Users/caleb/dev/Live-translate && railway up

# 로그 확인
railway logs --lines 50
```

## 🔗 URL

- **로컬**: http://localhost:3000
- **배포**: https://live-translate-production-1a87.up.railway.app/

---

## 📊 핵심 아키텍처 요약

```
[설교자 마이크] 
    ↓ audio-stream (Socket.IO)
[서버] 
    ↓ streamAudio()
[GeminiLiveHandler (언어별 4개)]
    ↓ ActivityEnd (1초마다) - 오디오 있을 때만
[Gemini Live API]
    ↓ 통역 오디오 응답
[청취자 브라우저]
    ↓ Web Audio API 재생
```

### 핵심 방어 로직
1. **첫 오디오 전**: ActivityEnd 타이머 미시작
2. **오디오 중단 시**: 1.5초 이상 없으면 ActivityEnd 스킵
3. **시스템 프롬프트**: "입력 없으면 침묵" 명시
