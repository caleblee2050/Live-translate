import { GoogleGenAI, Modality } from '@google/genai';
import TheologicalContext from './theological-context.js';

class GeminiLiveHandler {
    constructor(language, apiKey) {
        this.language = language;
        this.apiKey = apiKey;
        this.ai = new GoogleGenAI({ apiKey });
        this.session = null;
        this.isConnected = false;
        this.isSessionReady = false;
        this.context = new TheologicalContext();
        this.callbacks = {
            onAudioResponse: null,
            onTextResponse: null,
            onError: null,
            onConnect: null,
            onDisconnect: null
        };
        this.preloadedContext = {};
        this.pendingAudioChunks = [];
        this.connectPromise = null;

        // 동시통역을 위한 수동 ActivityEnd 타이머
        this.activityEndTimer = null;
        this.ACTIVITY_END_INTERVAL = 1000; // 1초마다 ActivityEnd 신호 (더 빠른 응답)
        this.isActivityStarted = false;  // ActivityStart 전송 여부 추적

        // 오디오 수신 추적 (마이크 입력 없이 자동 응답 방지)
        this.lastAudioReceivedTime = 0;
        this.AUDIO_IDLE_THRESHOLD = 1500; // 1.5초 이상 오디오 없으면 ActivityEnd 전송 안함
    }

    /**
     * Gemini Live API에 연결
     */
    async connect() {
        // 이미 연결된 경우
        if (this.isConnected && this.session) {
            return;
        }

        // 이미 연결 중인 경우 기존 Promise 반환
        if (this.connectPromise) {
            return this.connectPromise;
        }

        this.connectPromise = this._doConnect();
        return this.connectPromise;
    }

    async _doConnect() {
        try {
            const systemPrompt = this.context.buildSystemPrompt(
                this.language,
                this.preloadedContext
            );

            // 동시통역을 위한 최적화 설정
            const config = {
                responseModalities: [Modality.AUDIO],  // 오디오 출력 (TEXT와 동시 사용 불가)
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: this.getVoiceName()
                        }
                    }
                },
                systemInstruction: systemPrompt,
                // 🔥 동시통역 핵심 설정 - VAD 완전 비활성화
                realtimeInputConfig: {
                    automaticActivityDetection: {
                        disabled: true  // VAD 완전 비활성화 - 수동 턴 제어
                    },
                    activityHandling: 'NO_INTERRUPTION',  // 통역 도중 끊김 방지
                    turnCoverage: 'TURN_INCLUDES_ALL_INPUT'  // 모든 입력 포함
                }
            };

            this.session = await this.ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-12-2025',
                config: config,
                callbacks: {
                    onopen: () => {
                        console.log(`✅ Gemini Live API 연결 성공 [${this.language}] (진정한 동시통역 모드: VAD 비활성화)`);
                        this.isConnected = true;
                        this.isSessionReady = true;
                        if (this.callbacks.onConnect) {
                            this.callbacks.onConnect(this.language);
                        }
                        // 대기 중인 오디오 전송
                        this.flushPendingAudio();
                        // 주의: ActivityEnd 타이머는 첫 오디오 수신 시 시작됨 (sendAudioChunk에서)
                    },
                    onmessage: (message) => {
                        this.handleResponse(message);
                    },
                    onerror: (e) => {
                        console.error(`❌ Gemini API 오류 [${this.language}]:`, e.message);
                        if (this.callbacks.onError) {
                            this.callbacks.onError(e, this.language);
                        }
                    },
                    onclose: (e) => {
                        console.log(`⚠️  Gemini API 연결 종료 [${this.language}]:`, e?.reason || 'unknown');
                        this.isConnected = false;
                        this.isSessionReady = false;
                        this.session = null;
                        this.connectPromise = null;
                        if (this.callbacks.onDisconnect) {
                            this.callbacks.onDisconnect(this.language);
                        }
                    }
                }
            });

            console.log(`🎯 세션 설정 완료 [${this.language}]`);
        } catch (error) {
            console.error(`❌ Gemini API 연결 실패 [${this.language}]:`, error.message);
            this.connectPromise = null;
            throw error;
        }
    }

    /**
     * 언어별 음성 이름 가져오기
     */
    getVoiceName() {
        const voiceMap = {
            'ru': 'Puck',
            'zh': 'Aoede',
            'vi': 'Charon',
            'en': 'Kore'
        };
        return voiceMap[this.language] || 'Puck';
    }

    /**
     * 설교 전 컨텍스트 주입 (세션 재연결 포함)
     * @param {string} sermonText - 오늘의 설교 본문
     * @param {string[]} keywords - 핵심 키워드
     * @returns {Promise<boolean>} 성공 여부
     */
    async injectContext(sermonText, keywords = []) {
        this.preloadedContext = {
            sermonText,
            keywords
        };
        console.log(`📝 컨텍스트 저장 [${this.language}]: ${keywords.join(', ')}`);

        // 기존 세션이 있으면 재연결하여 새 시스템 프롬프트 적용
        if (this.session) {
            console.log(`🔄 새 컨텍스트로 세션 재연결 중 [${this.language}]...`);
            try {
                // 기존 세션 정리
                this.isConnected = false;
                this.isSessionReady = false;
                this.session = null;
                this.connectPromise = null;

                // 새 세션 연결 (새 시스템 프롬프트 적용)
                await this.connect();
                console.log(`✅ 컨텍스트 적용 완료 [${this.language}]`);
                return true;
            } catch (error) {
                console.error(`❌ 세션 재연결 실패 [${this.language}]:`, error.message);
                return false;
            }
        }

        return true;
    }

    /**
     * 오디오 스트림 전송
     */
    async streamAudio(audioChunk) {
        // 연결되지 않았으면 재연결 시도
        if (!this.isConnected || !this.session) {
            console.log(`🔄 재연결 시도 [${this.language}]`);
            try {
                await this.connect();
                // 연결 성공, 대기 중인 오디오에 추가
                this.pendingAudioChunks.push(audioChunk);
                return;
            } catch (error) {
                console.error(`❌ 재연결 실패 [${this.language}]:`, error.message);
                return;
            }
        }

        // 세션이 아직 준비되지 않았으면 대기
        if (!this.isSessionReady) {
            this.pendingAudioChunks.push(audioChunk);
            return;
        }

        // 정상적으로 오디오 전송
        this.sendAudioChunk(audioChunk);
    }

    /**
     * 오디오 청크 전송 (수동 Activity 제어 포함)
     */
    sendAudioChunk(audioChunk) {
        if (!this.session) return;

        try {
            // 오디오 수신 시간 기록 (ActivityEnd 조건부 전송용)
            this.lastAudioReceivedTime = Date.now();

            // 첫 오디오 수신 시 ActivityStart 전송 및 타이머 시작
            if (!this.isActivityStarted) {
                this.session.sendRealtimeInput({ activityStart: {} });
                this.isActivityStarted = true;
                console.log(`🎬 ActivityStart 전송 [${this.language}]`);

                // 첫 오디오 수신 시 ActivityEnd 타이머 시작 (연결 시 시작하지 않음)
                if (!this.activityEndTimer) {
                    this.startActivityEndTimer();
                }
            }

            const base64Audio = audioChunk.toString('base64');
            this.session.sendRealtimeInput({
                audio: {
                    data: base64Audio,
                    mimeType: "audio/pcm;rate=16000"
                }
            });
        } catch (error) {
            console.error(`❌ 오디오 전송 오류 [${this.language}]:`, error.message);
        }
    }

    /**
     * 대기 중인 오디오 청크 전송
     */
    flushPendingAudio() {
        if (this.pendingAudioChunks.length > 0) {
            console.log(`📤 대기 중인 오디오 ${this.pendingAudioChunks.length}개 전송 [${this.language}]`);

            // 최근 청크만 전송 (너무 오래된 것은 버림)
            const recentChunks = this.pendingAudioChunks.slice(-10);

            for (const chunk of recentChunks) {
                this.sendAudioChunk(chunk);
            }

            this.pendingAudioChunks = [];
        }
    }

    /**

     * Gemini 응답 처리
     */
    handleResponse(message) {
        try {
            // 모든 응답 로깅 (디버그용)
            console.log(`📨 Gemini 응답 [${this.language}]:`, JSON.stringify(message).substring(0, 200));

            // 오디오 응답 처리
            if (message.serverContent?.modelTurn?.parts) {
                message.serverContent.modelTurn.parts.forEach(part => {
                    // 오디오 데이터
                    if (part.inlineData && part.inlineData.data) {
                        const audioBuffer = Buffer.from(part.inlineData.data, 'base64');
                        console.log(`🔊 오디오 응답 수신 [${this.language}]: ${audioBuffer.length} bytes`);
                        if (this.callbacks.onAudioResponse) {
                            this.callbacks.onAudioResponse(audioBuffer, this.language);
                        }
                    }

                    // 텍스트 데이터 (자막)
                    if (part.text) {
                        console.log(`📝 텍스트 응답 [${this.language}]: ${part.text.substring(0, 50)}...`);
                        if (this.callbacks.onTextResponse) {
                            this.callbacks.onTextResponse(part.text, this.language);
                        }
                    }
                });
            }

            // 인터럽트 처리
            if (message.serverContent?.interrupted) {
                console.log(`⏸️ 인터럽트 [${this.language}]`);
            }

            // 턴 완료 처리
            if (message.serverContent?.turnComplete) {
                console.log(`✅ 턴 완료 [${this.language}]`);
            }

        } catch (error) {
            console.error(`❌ 응답 처리 오류 [${this.language}]:`, error);
        }
    }

    /**
     * 콜백 등록
     */
    on(event, callback) {
        if (this.callbacks.hasOwnProperty(`on${event.charAt(0).toUpperCase() + event.slice(1)}`)) {
            this.callbacks[`on${event.charAt(0).toUpperCase() + event.slice(1)}`] = callback;
        }
    }

    /**
     * 동시통역을 위한 주기적 ActivityEnd 신호 타이머 시작
     */
    startActivityEndTimer() {
        this.stopActivityEndTimer(); // 기존 타이머 정리

        this.activityEndTimer = setInterval(() => {
            if (this.session && this.isSessionReady && this.isActivityStarted) {
                // 최근에 오디오가 수신되었는지 확인 (마이크 입력 없이 자동 응답 방지)
                const timeSinceLastAudio = Date.now() - this.lastAudioReceivedTime;
                if (timeSinceLastAudio > this.AUDIO_IDLE_THRESHOLD) {
                    // 오디오 입력이 없으면 ActivityEnd 전송하지 않음
                    console.log(`⏸️ 오디오 없음 - ActivityEnd 전송 스킵 [${this.language}]`);
                    return;
                }

                try {
                    // ActivityEnd 신호를 보내 모델이 응답을 생성하도록 유도
                    this.session.sendRealtimeInput({ activityEnd: {} });
                    this.isActivityStarted = false; // 다음 오디오에서 다시 ActivityStart 전송하도록
                    console.log(`⏱️ ActivityEnd 신호 전송 [턴 종료] [${this.language}]`);
                } catch (error) {
                    console.error(`❌ ActivityEnd 전송 실패 [${this.language}]:`, error.message);
                }
            }
        }, this.ACTIVITY_END_INTERVAL);

        console.log(`⏱️ ActivityEnd 타이머 시작 [${this.language}] (${this.ACTIVITY_END_INTERVAL}ms 간격)`);
    }

    /**
     * ActivityEnd 타이머 중지
     */
    stopActivityEndTimer() {
        if (this.activityEndTimer) {
            clearInterval(this.activityEndTimer);
            this.activityEndTimer = null;
        }
    }

    /**
     * 연결 종료
     */
    disconnect() {
        // ActivityEnd 타이머 정리
        this.stopActivityEndTimer();

        if (this.session) {
            try {
                this.session.close();
            } catch (e) {
                // ignore
            }
            this.session = null;
            this.isConnected = false;
            this.isSessionReady = false;
            this.connectPromise = null;
            this.isActivityStarted = false;
        }
    }
}

export default GeminiLiveHandler;
