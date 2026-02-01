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
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: this.getVoiceName()
                        }
                    }
                },
                systemInstruction: systemPrompt
            };

            this.session = await this.ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-12-2025',
                config: config,
                callbacks: {
                    onopen: () => {
                        console.log(`✅ Gemini Live API 연결 성공 [${this.language}]`);
                        this.isConnected = true;
                        this.isSessionReady = true;
                        if (this.callbacks.onConnect) {
                            this.callbacks.onConnect(this.language);
                        }
                        // 대기 중인 오디오 전송
                        this.flushPendingAudio();
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
            'vi': 'Charon'
        };
        return voiceMap[this.language] || 'Puck';
    }

    /**
     * 설교 전 컨텍스트 주입
     */
    injectContext(sermonText, keywords = []) {
        this.preloadedContext = {
            sermonText,
            keywords
        };
        console.log(`📝 컨텍스트 주입 완료 [${this.language}]`);
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
     * 오디오 청크 전송
     */
    sendAudioChunk(audioChunk) {
        if (!this.session) return;

        try {
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
     * 연결 종료
     */
    disconnect() {
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
        }
    }
}

export default GeminiLiveHandler;
