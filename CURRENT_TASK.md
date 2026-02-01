# 실시간 설교 통역 시스템

> 마지막 업데이트: 2026-02-02 00:23 KST

## ✅ 배포 완료!

**프로덕션 URL**: https://live-translate-production-1a87.up.railway.app

---

## 📌 시스템 정보

| 항목 | 내용 |
|------|------|
| 플랫폼 | Railway |
| 상태 | ✅ Online |
| 모델 | `gemini-2.5-flash-native-audio-preview-12-2025` |
| 지원 언어 | 러시아어, 중국어, 베트남어 |

---

## 🔗 접속 URL

### 프로덕션 (Railway)
- **청취자**: https://live-translate-production-1a87.up.railway.app
- **설교자**: https://live-translate-production-1a87.up.railway.app/speaker.html
- **관리자**: https://live-translate-production-1a87.up.railway.app/admin.html

### 로컬 개발
```bash
cd /Users/caleb/dev/Live-translate
npm start
```
- 청취자: http://localhost:3000
- 설교자: http://localhost:3000/speaker.html
- 관리자: http://localhost:3000/admin.html

---

## 🔧 환경 변수 (Railway)

Railway 대시보드에서 설정 필요:
```
GEMINI_API_KEY=<your-api-key>
NODE_ENV=production
```

---

## 📁 레포지토리

- **GitHub**: https://github.com/caleblee2050/Live-translate
- **브랜치**: main

---

## 📝 최근 변경 사항 (2026-02-02)

1. ✅ Gemini 모델 업데이트 (`gemini-2.5-flash-native-audio-preview-12-2025`)
2. ✅ 동시통역 전용 시스템 프롬프트 추가
3. ✅ 3개 언어(ru, zh, vi) 프롬프트 수정
4. ✅ Railway 배포 완료
