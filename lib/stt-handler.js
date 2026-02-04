/**
 * Google Cloud Speech-to-Text 스트리밍 핸들러
 * 한국어 설교 음성을 실시간 텍스트로 변환
 */

import { SpeechClient } from '@google-cloud/speech';

class STTHandler {
    constructor() {
        this.client = new SpeechClient();
        this.recognizeStream = null;
        this.isStreaming = false;

        // 콜백 함수들
        this.callbacks = {
            onInterimResult: null,  // 중간 결과 (실시간 자막용)
            onFinalResult: null,    // 최종 결과 (번역 트리거용)
            onError: null
        };

        // 스트리밍 설정
        this.streamingConfig = {
            config: {
                encoding: 'LINEAR16',
                sampleRateHertz: 16000,
                languageCode: 'ko-KR',
                enableAutomaticPunctuation: true,
                model: 'latest_long',  // 긴 음성에 최적화
                useEnhanced: true,     // 향상된 모델 사용
            },
            interimResults: true,  // 중간 결과 활성화 (실시간 자막)
        };

        // 스트림 재시작 타이머 (Google STT 5분 제한 대응)
        this.restartTimer = null;
        this.RESTART_INTERVAL = 280000; // 4분 40초마다 재시작 (5분 전)
    }

    /**
     * 콜백 등록
     */
    on(event, callback) {
        const callbackName = `on${event.charAt(0).toUpperCase() + event.slice(1)}`;
        if (this.callbacks.hasOwnProperty(callbackName)) {
            this.callbacks[callbackName] = callback;
        }
    }

    /**
     * 스트리밍 시작
     */
    startStreaming() {
        if (this.isStreaming) {
            console.log('⚠️ STT 스트리밍 이미 진행 중');
            return;
        }

        try {
            this.recognizeStream = this.client
                .streamingRecognize(this.streamingConfig)
                .on('error', (error) => {
                    console.error('❌ STT 스트리밍 오류:', error.message);
                    if (this.callbacks.onError) {
                        this.callbacks.onError(error);
                    }
                    // 오류 시 재시작 시도
                    this.restartStreaming();
                })
                .on('data', (data) => {
                    this.handleResponse(data);
                });

            this.isStreaming = true;
            console.log('🎤 STT 스트리밍 시작');

            // 5분 제한 대응: 주기적 재시작
            this.scheduleRestart();

        } catch (error) {
            console.error('❌ STT 스트리밍 시작 실패:', error);
        }
    }

    /**
     * 오디오 청크 전송
     */
    sendAudio(audioChunk) {
        if (!this.isStreaming || !this.recognizeStream) {
            // 스트리밍이 시작되지 않았으면 시작
            this.startStreaming();
        }

        try {
            if (this.recognizeStream && !this.recognizeStream.destroyed) {
                this.recognizeStream.write(audioChunk);
            }
        } catch (error) {
            console.error('❌ STT 오디오 전송 오류:', error.message);
        }
    }

    /**
     * 응답 처리
     */
    handleResponse(data) {
        if (!data.results || data.results.length === 0) return;

        const result = data.results[0];
        const transcript = result.alternatives[0]?.transcript || '';

        if (!transcript) return;

        if (result.isFinal) {
            // 최종 결과 - 번역 트리거
            console.log(`📝 STT 최종: "${transcript}"`);
            if (this.callbacks.onFinalResult) {
                this.callbacks.onFinalResult(transcript);
            }
        } else {
            // 중간 결과 - 실시간 자막
            console.log(`📝 STT 중간: "${transcript}"`);
            if (this.callbacks.onInterimResult) {
                this.callbacks.onInterimResult(transcript);
            }
        }
    }

    /**
     * 스트리밍 재시작 (5분 제한 대응)
     */
    restartStreaming() {
        console.log('🔄 STT 스트리밍 재시작...');
        this.stopStreaming();

        // 약간의 지연 후 재시작
        setTimeout(() => {
            this.startStreaming();
        }, 100);
    }

    /**
     * 주기적 재시작 스케줄
     */
    scheduleRestart() {
        if (this.restartTimer) {
            clearTimeout(this.restartTimer);
        }

        this.restartTimer = setTimeout(() => {
            if (this.isStreaming) {
                console.log('⏰ STT 5분 제한 임박 - 재시작');
                this.restartStreaming();
            }
        }, this.RESTART_INTERVAL);
    }

    /**
     * 스트리밍 중지
     */
    stopStreaming() {
        if (this.restartTimer) {
            clearTimeout(this.restartTimer);
            this.restartTimer = null;
        }

        if (this.recognizeStream) {
            try {
                this.recognizeStream.end();
            } catch (e) {
                // 이미 종료된 스트림 무시
            }
            this.recognizeStream = null;
        }

        this.isStreaming = false;
        console.log('🛑 STT 스트리밍 중지');
    }
}

export default STTHandler;
