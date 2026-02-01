# 실시간 설교 통역 시스템

> 마지막 업데이트: 2026-02-02 01:02 KST

## ✅ 프로젝트 완료

**프로덕션 URL**: https://live-translate-production-1a87.up.railway.app

---

## 📌 시스템 정보

| 항목 | 내용 |
|------|------|
| 플랫폼 | Railway (자동배포 활성화) |
| 모델 | `gemini-2.5-flash-native-audio-preview-12-2025` |
| 지원 언어 | 러시아어, 중국어, 베트남어 |
| 방식 | **실시간 동시통역** |

---

## 🔗 접속 URL

### 프로덕션 (Railway)
| 페이지 | URL |
|--------|-----|
| 청취자 | https://live-translate-production-1a87.up.railway.app |
| 설교자 | https://live-translate-production-1a87.up.railway.app/speaker.html |
| 관리자 | https://live-translate-production-1a87.up.railway.app/admin.html |

### 로컬 개발
```bash
cd /Users/caleb/dev/Live-translate
npm start
```

---

## 📝 주요 기능

### 1. 실시간 동시통역
- 설교자가 말하는 도중 번역 시작 (2-3초 지연)
- 문장 완성을 기다리지 않음

### 2. 컨텍스트 주입 (관리자)
- 설교 전 본문과 키워드 입력
- "참고 자료"로 제공 (실제 음성 우선)
- 세션 즉시 재연결하여 적용

### 3. 신학 용어 사전
- 은혜, 구원, 성령 등 정확한 번역
- 성경 인명/지명 표준 표기

---

## 💰 예상 비용

| 기간 | 비용 (USD) | 비용 (KRW) |
|------|------------|------------|
| 1회 설교 (60분) | ~$4 | ~₩5,700 |
| 1개월 (8회) | ~$31 | ~₩45,000 |
| 1년 | ~$375 | ~₩540,000 |

---

## 📁 레포지토리

- **GitHub**: https://github.com/caleblee2050/Live-translate
- **브랜치**: main

---

## 📋 최근 작업 이력 (2026-02-02)

1. ✅ Gemini 모델 업데이트 (2.5 Flash Native Audio Preview)
2. ✅ 동시통역 시스템 프롬프트 추가
3. ✅ 컨텍스트 주입 기능 개선 (세션 재연결)
4. ✅ Railway 배포 완료 (자동배포 활성화)
