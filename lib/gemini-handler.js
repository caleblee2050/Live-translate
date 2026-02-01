import WebSocket from 'ws';
import TheologicalContext from './theological-context.js';

class GeminiLiveHandler {
    constructor(language, apiKey) {
        this.language = language;
        this.apiKey = apiKey;
        this.ws = null;
        this.isConnected = false;
        this.context = new TheologicalContext();
        this.callbacks = {
            onAudioResponse: null,
            onTextResponse: null,
            onError: null,
            onConnect: null,
            onDisconnect: null
        };
        this.preloadedContext = {};
    }

    /**
     * Gemini Live API에 연결
     */
    async connect() {
        return new Promise((resolve, reject) => {
            try {
                const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;

                this.ws = new WebSocket(url);

                this.ws.on('open', async () => {
                    console.log(`✅ Gemini Live API 연결 성공 [${this.language}]`);
                    this.isConnected = true;

                    // 세션 설정
                    await this.setupSession();

                    if (this.callbacks.onConnect) {
                        this.callbacks.onConnect(this.language);
                    }

                    resolve();
                });

                this.ws.on('message', (data) => {
                    this.handleResponse(data);
                });

                this.ws.on('error', (error) => {
                    console.error(`❌ Gemini API 오류 [${this.language}]:`, error);
                    if (this.callbacks.onError) {
                        this.callbacks.onError(error, this.language);
                    }
                });

                this.ws.on('close', () => {
                    console.log(`⚠️  Gemini API 연결 종료 [${this.language}]`);
                    this.isConnected = false;
                    if (this.callbacks.onDisconnect) {
                        this.callbacks.onDisconnect(this.language);
                    }
                });

            } catch (error) {
                console.error(`❌ Gemini API 연결 실패 [${this.language}]:`, error);
                reject(error);
            }
        });
    }

    /**
     * 세션 초기 설정
     */
    async setupSession() {
        // 시스템 프롬프트 생성
        const systemPrompt = this.context.buildSystemPrompt(
            this.language,
            this.preloadedContext
        );

        // Gemini Live API 설정 메시지 전송
        const setupMessage = {
            setup: {
                model: "models/gemini-2.0-flash-exp",
                generation_config: {
                    response_modalities: ["AUDIO", "TEXT"],
                    speech_config: {
                        voice_config: {
                            prebuilt_voice_config: {
                                voice_name: this.getVoiceName()
                            }
                        }
                    }
                },
                system_instruction: {
                    parts: [{
                        text: systemPrompt
                    }]
                }
            }
        };

        this.sendMessage(setupMessage);
        console.log(`🎯 세션 설정 완료 [${this.language}]`);
    }

    /**
     * 언어별 음성 이름 가져오기
     */
    getVoiceName() {
        const voiceMap = {
            'ru': 'Puck', // 러시아어 음성
            'zh': 'Aoede', // 중국어 음성
            'vi': 'Charon' // 베트남어 음성
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
     * @param {Buffer} audioChunk - PCM 오디오 버퍼 (16kHz, 16-bit, mono)
     */
    async streamAudio(audioChunk) {
        // 연결되지 않았으면 재연결 시도
        if (!this.isConnected) {
            console.log(`🔄 재연결 시도 [${this.language}]`);
            try {
                await this.connect();
            } catch (error) {
                console.error(`❌ 재연결 실패 [${this.language}]:`, error);
                return;
            }
        }

        // Base64로 인코딩
        const base64Audio = audioChunk.toString('base64');

        const message = {
            realtime_input: {
                media_chunks: [{
                    mime_type: "audio/pcm",
                    data: base64Audio
                }]
            }
        };

        this.sendMessage(message);
    }

    /**
     * 메시지 전송
     */
    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    /**
     * Gemini 응답 처리
     */
    handleResponse(data) {
        try {
            const response = JSON.parse(data.toString());

            // 오디오 응답 처리
            if (response.serverContent?.modelTurn?.parts) {
                response.serverContent.modelTurn.parts.forEach(part => {
                    // 오디오 데이터
                    if (part.inlineData && part.inlineData.mimeType === 'audio/pcm') {
                        const audioBuffer = Buffer.from(part.inlineData.data, 'base64');
                        if (this.callbacks.onAudioResponse) {
                            this.callbacks.onAudioResponse(audioBuffer, this.language);
                        }
                    }

                    // 텍스트 데이터 (자막)
                    if (part.text) {
                        if (this.callbacks.onTextResponse) {
                            this.callbacks.onTextResponse(part.text, this.language);
                        }
                    }
                });
            }

            // 도구 호출 (통찰적 질문 등)
            if (response.toolCall) {
                console.log(`💡 도구 호출 [${this.language}]:`, response.toolCall);
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
        if (this.ws) {
            this.ws.close();
            this.isConnected = false;
        }
    }
}

export default GeminiLiveHandler;
