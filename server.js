import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import GeminiLiveHandler from './lib/gemini-handler.js';
import AudioProcessor from './lib/audio-processor.js';

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

// 언어별 Gemini 핸들러
const geminiHandlers = {};
const audioProcessor = new AudioProcessor();

// 연결된 클라이언트 관리
const connectedClients = {
    ru: new Set(),
    zh: new Set(),
    vi: new Set()
};

/**
 * Gemini 핸들러 초기화
 */
async function initializeGeminiHandlers() {
    const languages = ['ru', 'zh', 'vi'];

    for (const lang of languages) {
        const handler = new GeminiLiveHandler(lang, GEMINI_API_KEY);

        // 오디오 응답 콜백
        handler.on('audioResponse', (audioBuffer, language) => {
            // 해당 언어 룸의 모든 클라이언트에게 브로드캐스트
            io.to(`lang:${language}`).emit('audio', {
                language,
                audio: audioBuffer.toString('base64')
            });
        });

        // 텍스트(자막) 응답 콜백
        handler.on('textResponse', (text, language) => {
            io.to(`lang:${language}`).emit('subtitle', {
                language,
                text,
                timestamp: Date.now()
            });
        });

        // 에러 콜백
        handler.on('error', (error, language) => {
            console.error(`Gemini 에러 [${language}]:`, error);
            io.to(`lang:${language}`).emit('error', {
                message: '통역 서비스에 문제가 발생했습니다.'
            });
        });

        // 연결
        try {
            await handler.connect();
            geminiHandlers[lang] = handler;
            console.log(`✅ Gemini 핸들러 초기화 완료 [${lang}]`);
        } catch (error) {
            console.error(`❌ Gemini 핸들러 초기화 실패 [${lang}]:`, error);
        }
    }
}

/**
 * Socket.IO 연결 처리
 */
io.on('connection', (socket) => {
    console.log(`🔌 클라이언트 연결: ${socket.id}`);

    // 언어 선택 및 룸 참여
    socket.on('join', (data) => {
        const { language, clientType } = data; // clientType: 'listener' or 'speaker'

        if (!['ru', 'zh', 'vi', 'speaker'].includes(language)) {
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
    socket.on('audio-stream', (data) => {
        if (socket.clientType !== 'speaker') {
            return;
        }

        try {
            // Base64 디코딩
            const audioBuffer = Buffer.from(data.audio, 'base64');

            // 모든 언어 핸들러로 전송
            Object.values(geminiHandlers).forEach(handler => {
                if (handler.isConnected) {
                    handler.streamAudio(audioBuffer);
                }
            });
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
    });
});

/**
 * 관리자 API: 컨텍스트 주입
 */
app.post('/api/inject-context', (req, res) => {
    try {
        const { sermonText, keywords } = req.body;

        // 모든 언어 핸들러에 컨텍스트 주입
        Object.values(geminiHandlers).forEach(handler => {
            handler.injectContext(sermonText, keywords);
        });

        console.log('📝 컨텍스트 주입 완료');
        console.log('   설교 본문:', sermonText?.substring(0, 50) + '...');
        console.log('   키워드:', keywords);

        res.json({ success: true, message: '컨텍스트가 주입되었습니다.' });
    } catch (error) {
        console.error('컨텍스트 주입 오류:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * 상태 확인 API
 */
app.get('/api/status', (req, res) => {
    const status = {
        server: 'running',
        gemini: {},
        clients: {}
    };

    // Gemini 핸들러 상태
    Object.entries(geminiHandlers).forEach(([lang, handler]) => {
        status.gemini[lang] = handler.isConnected ? 'connected' : 'disconnected';
    });

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

        // Gemini 핸들러 초기화
        console.log('🚀 Gemini Live API 연결 중...');
        await initializeGeminiHandlers();

        // HTTP 서버 시작
        httpServer.listen(PORT, () => {
            console.log('');
            console.log('✅ 실시간 설교 통역 서버 시작!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`🌐 서버 주소: http://localhost:${PORT}`);
            console.log(`👥 청취자 페이지: http://localhost:${PORT}`);
            console.log(`🎤 설교자 페이지: http://localhost:${PORT}/speaker.html`);
            console.log(`⚙️  관리자 페이지: http://localhost:${PORT}/admin.html`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
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

    // Gemini 핸들러 연결 해제
    Object.values(geminiHandlers).forEach(handler => {
        handler.disconnect();
    });

    httpServer.close(() => {
        console.log('✅ 서버 종료 완료');
        process.exit(0);
    });
});

start();
