// Socket.IO 연결
let socket = null;
let selectedLanguage = null;
let audioContext = null;
let audioQueue = [];
let isPlaying = false;

// 오디오 버퍼링 시스템
let audioBufferQueue = [];
let isBufferPlaying = false;
let nextPlayTime = 0;
let gainNode = null;

/**
 * 언어 선택
 */
function selectLanguage(lang) {
    selectedLanguage = lang;

    // UI 업데이트
    document.querySelectorAll('.language-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-lang="${lang}"]`).classList.add('active');

    // 언어 이름 표시
    const languageNames = {
        ru: '🇷🇺 Русский (러시아어)',
        zh: '🇨🇳 中文 (중국어)',
        vi: '🇻🇳 Tiếng Việt (베트남어)'
    };
    document.getElementById('selectedLanguageName').textContent = languageNames[lang];

    // 플레이어 카드 표시
    document.getElementById('languageSelection').style.display = 'none';
    document.getElementById('playerCard').style.display = 'block';

    // 서버 연결
    connectToServer();
}

/**
 * 언어 변경
 */
function changeLanguage() {
    if (socket) {
        socket.disconnect();
    }

    document.getElementById('languageSelection').style.display = 'block';
    document.getElementById('playerCard').style.display = 'none';
    document.getElementById('connectionStatus').style.display = 'none';

    selectedLanguage = null;
}

/**
 * 서버 연결
 */
function connectToServer() {
    socket = io();

    socket.on('connect', () => {
        console.log('✅ 서버 연결 성공');

        // 언어별 룸 참여
        socket.emit('join', {
            language: selectedLanguage,
            clientType: 'listener'
        });
    });

    socket.on('joined', (data) => {
        console.log('✅ 룸 참여 성공:', data);
        document.getElementById('connectionStatus').style.display = 'flex';
    });

    socket.on('audio', (data) => {
        if (data.language === selectedLanguage && isPlaying) {
            playAudio(data.audio);
        }
    });

    socket.on('subtitle', (data) => {
        if (data.language === selectedLanguage) {
            displaySubtitle(data.text, data.timestamp);
        }
    });

    socket.on('error', (data) => {
        console.error('서버 오류:', data.message);
        alert(data.message);
    });

    socket.on('disconnect', () => {
        console.log('⚠️  서버 연결 해제');
        document.getElementById('connectionStatus').style.display = 'none';
    });
}

/**
 * 듣기 시작
 */
function startListening() {
    isPlaying = true;

    // Web Audio API 초기화
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 24000  // Gemini 출력과 동일한 샘플레이트
        });
    }

    // GainNode 생성 (볼륨 제어 및 연결용)
    if (!gainNode) {
        gainNode = audioContext.createGain();
        gainNode.connect(audioContext.destination);
    }

    // 버퍼링 시스템 초기화
    audioBufferQueue = [];
    isBufferPlaying = false;
    nextPlayTime = audioContext.currentTime;

    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('stopBtn').style.display = 'inline-flex';

    console.log('🎧 듣기 시작');
}

/**
 * 듣기 중지
 */
function stopListening() {
    isPlaying = false;

    document.getElementById('startBtn').style.display = 'inline-flex';
    document.getElementById('stopBtn').style.display = 'none';

    console.log('⏸ 듣기 중지');
}

/**
 * 오디오 재생 (버퍼링 큐 시스템)
 */
function playAudio(base64Audio) {
    // 청크를 큐에 추가
    audioBufferQueue.push(base64Audio);

    // 재생 중이 아니면 처리 시작
    if (!isBufferPlaying) {
        processAudioQueue();
    }
}

/**
 * 오디오 큐 처리
 */
function processAudioQueue() {
    if (audioBufferQueue.length === 0) {
        isBufferPlaying = false;
        return;
    }

    isBufferPlaying = true;

    try {
        const base64Audio = audioBufferQueue.shift();

        // Base64 디코딩
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Int16 PCM으로 변환
        const int16Array = new Int16Array(bytes.buffer);

        // Float32로 변환 (Web Audio API 요구사항)
        const float32Array = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
            float32Array[i] = int16Array[i] / 32768.0;
        }

        // AudioBuffer 생성 (24kHz - Gemini 출력)
        const audioBuffer = audioContext.createBuffer(1, float32Array.length, 24000);
        audioBuffer.getChannelData(0).set(float32Array);

        // 스케줄링된 시간에 재생
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(gainNode);

        // 현재 시간보다 과거라면 즉시 재생
        const currentTime = audioContext.currentTime;
        if (nextPlayTime < currentTime) {
            nextPlayTime = currentTime;
        }

        source.start(nextPlayTime);

        // 다음 재생 시간 계산 (현재 버퍼 길이만큼 뒤로)
        nextPlayTime += audioBuffer.duration;

        // 다음 청크 즉시 처리 (스케줄링이므로 즉시 처리해도 됨)
        // 큐에 있는 청크들을 미리 스케줄링
        setTimeout(processAudioQueue, 10);

    } catch (error) {
        console.error('오디오 재생 오류:', error);
        isBufferPlaying = false;
    }
}

/**
 * 자막 표시
 */
function displaySubtitle(text, timestamp) {
    const subtitleEl = document.getElementById('subtitle');
    const timestampEl = document.getElementById('subtitleTime');

    subtitleEl.textContent = text;
    timestampEl.textContent = new Date(timestamp).toLocaleTimeString('ko-KR');

    // 통찰 질문 표시 (특정 패턴 감지)
    const reflectionPrompts = {
        ru: 'Что это слово значит для вас сегодня?',
        zh: '这句话对你今天有什么意义？',
        vi: 'Lời này có ý nghĩa gì với bạn hôm nay?'
    };

    if (text.includes(reflectionPrompts[selectedLanguage])) {
        showReflectionPrompt(text);
    }
}

/**
 * 통찰 질문 표시
 */
function showReflectionPrompt(question) {
    const promptEl = document.getElementById('reflectionPrompt');
    promptEl.textContent = `💭 ${question}`;
    promptEl.style.display = 'block';

    // 5초 후 숨기기
    setTimeout(() => {
        promptEl.style.display = 'none';
    }, 5000);
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 실시간 설교 통역 시스템 시작');
});
