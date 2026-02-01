# 실시간 설교 통역 시스템

Gemini Multimodal Live API를 활용한 실시간 다국어(러시아어/중국어/베트남어) 설교 통역 시스템

## 🚀 프로덕션 배포

| 페이지 | URL |
|--------|-----|
| 청취자 | https://live-translate-production-1a87.up.railway.app |
| 설교자 | https://live-translate-production-1a87.up.railway.app/speaker.html |
| 관리자 | https://live-translate-production-1a87.up.railway.app/admin.html |

## 주요 기능

- ✅ 실시간 음성 스트리밍 (S2ST)
- ✅ 3개 언어 동시 지원 (러시아어, 중국어, 베트남어)
- ✅ 신학 용어 정확성 보장
- ✅ 감정/뉘앙스 보존
- ✅ 자막 실시간 표시
- ✅ 통찰적 질문 제공
- ✅ 설교 전 컨텍스트 사전 로딩

## 시작하기

### 1. 환경 설정

`.env` 파일을 생성하고 Gemini API 키를 설정하세요:

```bash
cp .env.example .env
```

`.env` 파일 편집:
```
GEMINI_API_KEY=your_actual_api_key_here
PORT=3000
NODE_ENV=development
```

### 2. 패키지 설치

```bash
npm install
```

### 3. 서버 실행

```bash
npm start
```

또는 개발 모드 (자동 재시작):
```bash
npm run dev
```

### 4. 접속

- **청취자 페이지**: http://localhost:3000
- **설교자 페이지**: http://localhost:3000/speaker.html
- **관리자 페이지**: http://localhost:3000/admin.html

## 사용 방법

### 설교 준비 (관리자)

1. http://localhost:3000/admin.html 접속
2. 오늘의 설교 본문 입력 (예: 요한복음 3:16)
3. 핵심 키워드 입력 (예: 은혜, 구원, 사랑)
4. "컨텍스트 주입" 버튼 클릭

### 설교 시작 (설교자)

1. http://localhost:3000/speaker.html 접속
2. "스트리밍 시작" 버튼 클릭
3. 마이크 권한 허용
4. 설교 시작

### 통역 청취 (성도)

1. http://localhost:3000 접속
2. 원하는 언어 선택 (러시아어/중국어/베트남어)
3. "듣기 시작" 버튼 클릭
4. 실시간 통역 음성 및 자막 확인

## 프로젝트 구조

```
Live-translate/
├── server.js                 # 메인 서버
├── lib/
│   ├── gemini-handler.js     # Gemini API 핸들러
│   ├── theological-context.js # 신학 컨텍스트 관리
│   └── audio-processor.js    # 오디오 처리
├── config/
│   ├── theological-terms.json # 신학 용어 사전
│   └── system-prompts.json   # 시스템 프롬프트
├── public/
│   ├── index.html            # 청취자 페이지
│   ├── speaker.html          # 설교자 페이지
│   ├── admin.html            # 관리자 페이지
│   ├── css/
│   │   └── style.css         # 스타일시트
│   └── js/
│       ├── client.js         # 청취자 클라이언트
│       ├── speaker.js        # 설교자 클라이언트
│       └── admin.js          # 관리자 클라이언트
├── package.json
└── .env
```

## 기술 스택

- **백엔드**: Node.js, Express, Socket.IO
- **프론트엔드**: HTML5, CSS3, JavaScript (Web Audio API)
- **AI**: Gemini Multimodal Live API
- **실시간 통신**: WebSocket

## 신학 용어 사전

시스템에 내장된 주요 신학 용어:

| 한국어 | 러시아어 | 중국어 | 베트남어 |
|--------|----------|--------|----------|
| 은혜 | благодать | 恩典 | ân điển |
| 구원 | спасение | 救恩 | sự cứu rỗi |
| 성령 | Святой Дух | 圣灵 | Chúa Thánh Thần |
| 복음 | Евангелие | 福音 | Tin Mừng |
| 회개 | покаяние | 悔改 | sự ăn năn |

## 문제 해결

### Gemini API 연결 오류

- API 키가 올바른지 확인
- 인터넷 연결 상태 확인
- Gemini API 할당량 확인

### 마이크 접근 오류

- 브라우저 마이크 권한 허용
- HTTPS 연결 사용 (프로덕션 환경)

### 오디오 재생 안됨

- 브라우저 자동 재생 정책 확인
- "듣기 시작" 버튼 클릭 후 재생

## 라이선스

MIT License

## 지원

문의: caleb@a4k.ai
