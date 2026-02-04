import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 새 파이프라인 핸들러들
import STTHandler from './lib/stt-handler.js';
import TranslationHandler from './lib/translation-handler.js';
import TTSHandler from './lib/tts-handler.js';

// ES 모듈에서 __dirname 구하기
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 환경변수 로드
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 정적 파일 서빙
app.use(express.static(join(__dirname, 'public')));
app.use(express.json());

// 파이프라인 핸들러들
let sttHandler = null;
let translationHandler = null;
let ttsHandler = null;

// 연결된 클라이언트 관리
const connectedClients = {
    ru: new Set(),
    zh: new Set(),
    vi: new Set(),
    en: new Set()
};

/**
 * 파이프라인 핸들러 초기화
 */
async function initializePipeline() {
    try {
        // STT 핸들러
        sttHandler = new STTHandler();

        // STT 중간 결과 → 원어 자막 전송
        sttHandler.on('interimResult', (text) => {
            io.to('lang:speaker').emit('source-subtitle', {
                text,
                isFinal: false,
                timestamp: Date.now()
            });
            // 모든 언어 룸에도 원어 자막 전송
            ['ru', 'zh', 'vi', 'en'].forEach(lang => {
                io.to(`lang:${lang}`).emit('source-subtitle', {
                    text,
                    isFinal: false,
                    timestamp: Date.now()
                });
            });
        });

        // STT 최종 결과 → 번역 및 TTS 트리거
        sttHandler.on('finalResult', async (text) => {
            // 원어 최종 자막 전송
            io.to('lang:speaker').emit('source-subtitle', {
                text,
                isFinal: true,
                timestamp: Date.now()
            });
            ['ru', 'zh', 'vi', 'en'].forEach(lang => {
                io.to(`lang:${lang}`).emit('source-subtitle', {
                    text,
                    isFinal: true,
                    timestamp: Date.now()
                });
            });

            // 각 언어로 번역 및 TTS 생성
            await processTranslation(text);
        });

        sttHandler.on('error', (error) => {
            console.error('❌ STT 오류:', error.message);
        });

        // 번역 핸들러
        translationHandler = new TranslationHandler(GEMINI_API_KEY);
        console.log('✅ 번역 핸들러 초기화 완료');

        // TTS 핸들러
        ttsHandler = new TTSHandler();
        console.log('✅ TTS 핸들러 초기화 완료');

        console.log('✅ STT → 번역 → TTS 파이프라인 준비 완료');

    } catch (error) {
        console.error('❌ 파이프라인 초기화 실패:', error);
        throw error;
    }
}

/**
 * 번역 및 TTS 처리
 */
async function processTranslation(koreanText) {
    if (!koreanText || koreanText.trim().length < 2) return;

    const languages = ['ru', 'zh', 'vi', 'en'];

    // 병렬로 모든 언어 처리
    await Promise.all(languages.map(async (lang) => {
        try {
            // 해당 언어에 청취자가 있는지 확인
            if (connectedClients[lang].size === 0) {
                return;
            }

            // 1. 번역
            const translatedText = await translationHandler.translate(koreanText, lang);

            // 2. 번역 자막 전송
            io.to(`lang:${lang}`).emit('subtitle', {
                language: lang,
                text: translatedText,
                timestamp: Date.now()
            });

            // 3. TTS 생성
            const audioBuffer = await ttsHandler.synthesize(translatedText, lang);

            if (audioBuffer) {
                // 4. 오디오 전송
                io.to(`lang:${lang}`).emit('audio', {
                    language: lang,
                    audio: audioBuffer.toString('base64')
                });
            }

        } catch (error) {
            console.error(`❌ 처리 오류 [${lang}]:`, error.message);
        }
    }));
}

/**
 * Socket.IO 연결 처리
 */
io.on('connection', (socket) => {
    console.log(`🔌 클라이언트 연결: ${socket.id}`);

    // 언어 선택 및 룸 참여
    socket.on('join', (data) => {
        const { language, clientType } = data;

        if (!['ru', 'zh', 'vi', 'en', 'speaker'].includes(language)) {
            socket.emit('error', { message: '지원하지 않는 언어입니다.' });
            return;
        }

        socket.join(`lang:${language}`);
        socket.language = language;
        socket.clientType = clientType;

        if (clientType === 'listener') {
            connectedClients[language].add(socket.id);
            console.log(`👂 청취자 참여 [${language}]: ${socket.id} (총 ${connectedClients[language].size}명)`);
        } else {
            console.log(`🎤 설교자 연결: ${socket.id}`);
        }

        socket.emit('joined', {
            language,
            clientType,
            listeners: language !== 'speaker' ? connectedClients[language].size : 0
        });

        // 다른 클라이언트에게 알림
        socket.to(`lang:${language}`).emit('client-update', {
            listeners: language !== 'speaker' ? connectedClients[language].size : 0
        });
    });

    // 설교자 오디오 스트림 수신
    socket.on('audio-stream', async (data) => {
        if (socket.clientType !== 'speaker') {
            return;
        }

        try {
            // Base64 디코딩
            const audioBuffer = Buffer.from(data.audio, 'base64');

            // STT로 전송
            if (sttHandler) {
                sttHandler.sendAudio(audioBuffer);
            }
        } catch (error) {
            console.error('오디오 스트림 처리 오류:', error);
        }
    });

    // 연결 해제
    socket.on('disconnect', () => {
        console.log(`🔌 클라이언트 연결 해제: ${socket.id}`);

        if (socket.language && socket.clientType === 'listener') {
            connectedClients[socket.language].delete(socket.id);
            console.log(`👋 청취자 퇴장 [${socket.language}]: ${socket.id} (남은 ${connectedClients[socket.language].size}명)`);

            // 남은 클라이언트에게 업데이트
            io.to(`lang:${socket.language}`).emit('client-update', {
                listeners: connectedClients[socket.language].size
            });
        }

        // 설교자 연결 해제 시 STT 스트리밍 중지
        if (socket.clientType === 'speaker' && sttHandler) {
            sttHandler.stopStreaming();
        }
    });
});

/**
 * 상태 확인 API
 */
app.get('/api/status', (req, res) => {
    const status = {
        server: 'running',
        pipeline: {
            stt: sttHandler ? 'ready' : 'not initialized',
            translation: translationHandler ? 'ready' : 'not initialized',
            tts: ttsHandler ? 'ready' : 'not initialized'
        },
        clients: {}
    };

    // 클라이언트 수
    Object.entries(connectedClients).forEach(([lang, clients]) => {
        status.clients[lang] = clients.size;
    });

    res.json(status);
});

/**
 * 서버 시작
 */
async function start() {
    try {
        // API 키 확인
        if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_api_key_here') {
            console.error('❌ GEMINI_API_KEY가 설정되지 않았습니다.');
            console.error('   .env 파일을 생성하고 API 키를 설정해주세요.');
            process.exit(1);
        }

        // 파이프라인 초기화
        console.log('🚀 STT → 번역 → TTS 파이프라인 초기화 중...');
        await initializePipeline();

        // HTTP 서버 시작
        httpServer.listen(PORT, () => {
            console.log('');
            console.log('✅ 실시간 설교 통역 서버 시작!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`🌐 서버 주소: http://localhost:${PORT}`);
            console.log(`👥 청취자 페이지: http://localhost:${PORT}`);
            console.log(`🎤 설교자 페이지: http://localhost:${PORT}/speaker.html`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📡 파이프라인: STT → Gemini 번역 → TTS');
            console.log('');
        });
    } catch (error) {
        console.error('❌ 서버 시작 실패:', error);
        process.exit(1);
    }
}

// 종료 처리
process.on('SIGINT', () => {
    console.log('\n🛑 서버 종료 중...');

    // STT 스트리밍 중지
    if (sttHandler) {
        sttHandler.stopStreaming();
    }

    httpServer.close(() => {
        console.log('✅ 서버 종료 완료');
        process.exit(0);
    });
});

start();
