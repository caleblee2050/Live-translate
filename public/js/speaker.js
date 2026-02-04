let socket = null;
let mediaStream = null;
let audioContext = null;
let sourceNode = null;
let processorNode = null;
let isStreaming = false;
let selectedDeviceId = null; // 선택된 오디오 입력 장치 ID

/**
 * 서버 연결
 */
function connectToServer() {
    socket = io();

    socket.on('connect', () => {
        console.log('✅ 서버 연결 성공');

        // 설교자로 참여
        socket.emit('join', {
            language: 'speaker',
            clientType: 'speaker'
        });
    });

    socket.on('joined', (data) => {
        console.log('✅ 설교자 인증 완료:', data);
    });

    socket.on('client-update', (data) => {
        updateListenerCount();
    });

    socket.on('error', (data) => {
        console.error('서버 오류:', data.message);
        alert(data.message);
    });

    socket.on('disconnect', () => {
        console.log('⚠️  서버 연결 해제');
        if (isStreaming) {
            stopStreaming();
        }
    });
}

/**
 * 스트리밍 시작
 */
async function startStreaming() {
    try {
        // 선택된 오디오 입력 장치 가져오기
        const audioSelect = document.getElementById('audioInputSelect');
        selectedDeviceId = audioSelect.value || undefined;

        // 오디오 설정 구성
        const audioConstraints = {
            echoCancellation: false,  // 믹서 입력 시 에코 캔슬 비활성화 (깨끗한 원음)
            noiseSuppression: false,  // 노이즈 억제 비활성화 (원음 유지)
            autoGainControl: false,   // 자동 게인 비활성화 (믹서에서 조정)
            sampleRate: 48000
        };

        // 특정 장치가 선택된 경우 deviceId 추가
        if (selectedDeviceId) {
            audioConstraints.deviceId = { exact: selectedDeviceId };
            console.log('🎚️ 선택된 장치 ID:', selectedDeviceId);
        }

        // 마이크/오디오 입력 권한 요청
        mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: audioConstraints
        });

        // Web Audio API 초기화
        audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 48000
        });

        sourceNode = audioContext.createMediaStreamSource(mediaStream);

        // ScriptProcessorNode (오디오 처리)
        // 더 작은 버퍼로 자주 전송하여 지연 감소
        const bufferSize = 2048;
        processorNode = audioContext.createScriptProcessor(bufferSize, 1, 1);

        processorNode.onaudioprocess = (e) => {
            if (!isStreaming) return;

            const inputData = e.inputBuffer.getChannelData(0);

            // 오디오 레벨 표시
            const level = calculateAudioLevel(inputData);
            updateAudioLevel(level);

            // 16kHz로 리샘플링
            const resampled = resample(inputData, 48000, 16000);

            // Float32를 Int16 PCM으로 변환
            const pcm = floatTo16BitPCM(resampled);

            // Base64로 인코딩하여 전송
            const base64Audio = arrayBufferToBase64(pcm.buffer);

            socket.emit('audio-stream', {
                audio: base64Audio,
                timestamp: Date.now()
            });
        };

        sourceNode.connect(processorNode);
        processorNode.connect(audioContext.destination);

        isStreaming = true;

        // UI 업데이트
        document.getElementById('startStreamBtn').style.display = 'none';
        document.getElementById('stopStreamBtn').style.display = 'inline-flex';
        document.getElementById('connectionStatus').style.display = 'flex';
        document.getElementById('audioLevel').style.display = 'block';

        console.log('🎤 스트리밍 시작');

    } catch (error) {
        console.error('마이크 접근 오류:', error);
        alert('마이크 권한이 필요합니다. 브라우저 설정을 확인해주세요.');
    }
}

/**
 * 스트리밍 중지
 */
function stopStreaming() {
    isStreaming = false;

    if (processorNode) {
        processorNode.disconnect();
    }

    if (sourceNode) {
        sourceNode.disconnect();
    }

    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
    }

    if (audioContext) {
        audioContext.close();
    }

    // UI 업데이트
    document.getElementById('startStreamBtn').style.display = 'inline-flex';
    document.getElementById('stopStreamBtn').style.display = 'none';
    document.getElementById('connectionStatus').style.display = 'none';
    document.getElementById('audioLevel').style.display = 'none';

    console.log('⏹ 스트리밍 중지');
}

/**
 * 오디오 레벨 계산
 */
function calculateAudioLevel(samples) {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
        sum += samples[i] * samples[i];
    }
    const rms = Math.sqrt(sum / samples.length);
    return Math.min(1, rms * 10); // 0-1 범위로 정규화
}

/**
 * 오디오 레벨 표시 업데이트
 */
function updateAudioLevel(level) {
    const levelBar = document.getElementById('levelBar');
    levelBar.style.width = (level * 100) + '%';
}

/**
 * 리샘플링 (48kHz → 16kHz)
 */
function resample(buffer, fromRate, toRate) {
    if (fromRate === toRate) return buffer;

    const ratio = fromRate / toRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
        const srcIndex = i * ratio;
        const srcIndexFloor = Math.floor(srcIndex);
        const srcIndexCeil = Math.min(srcIndexFloor + 1, buffer.length - 1);
        const fraction = srcIndex - srcIndexFloor;

        result[i] = buffer[srcIndexFloor] * (1 - fraction) +
            buffer[srcIndexCeil] * fraction;
    }

    return result;
}

/**
 * Float32 → Int16 PCM 변환
 */
function floatTo16BitPCM(float32Array) {
    const int16Array = new Int16Array(float32Array.length);

    for (let i = 0; i < float32Array.length; i++) {
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    return int16Array;
}

/**
 * ArrayBuffer → Base64
 */
function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * 청취자 수 업데이트
 */
async function updateListenerCount() {
    try {
        const response = await fetch('/api/status');
        const status = await response.json();

        const total = (status.clients.ru || 0) + (status.clients.zh || 0) + (status.clients.vi || 0) + (status.clients.en || 0);

        const countHtml = `
      <div style="font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem;">
        👥 ${total}명 청취 중
      </div>
      <div style="font-size: 0.875rem;">
        🇷🇺 ${status.clients.ru || 0}명 | 
        🇨🇳 ${status.clients.zh || 0}명 | 
        🇻🇳 ${status.clients.vi || 0}명 |
        🇺🇸 ${status.clients.en || 0}명
      </div>
    `;

        document.getElementById('listenerCount').innerHTML = countHtml;
    } catch (error) {
        console.error('청취자 수 업데이트 오류:', error);
    }
}

/**
 * 오디오 입력 장치 목록 로드
 */
async function loadAudioDevices() {
    try {
        // 먼저 권한을 요청해야 장치 이름이 표시됨
        await navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => stream.getTracks().forEach(track => track.stop()));

        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');

        const select = document.getElementById('audioInputSelect');
        select.innerHTML = '<option value="">기본 마이크</option>';

        audioInputs.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `마이크 ${select.options.length}`;
            select.appendChild(option);
        });

        console.log(`🎚️ ${audioInputs.length}개 오디오 입력 장치 발견`);
    } catch (error) {
        console.error('오디오 장치 목록 로드 오류:', error);
    }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    connectToServer();
    updateListenerCount();
    loadAudioDevices(); // 오디오 장치 목록 로드

    // 5초마다 청취자 수 업데이트
    setInterval(updateListenerCount, 5000);

    // 장치 변경 감지 (USB 장치 연결/해제 시)
    navigator.mediaDevices.addEventListener('devicechange', loadAudioDevices);
});
