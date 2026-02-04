/**
 * Google Cloud Text-to-Speech 핸들러
 * 번역된 텍스트를 자연스러운 음성으로 변환
 */

import { TextToSpeechClient } from '@google-cloud/text-to-speech';

class TTSHandler {
    constructor() {
        this.client = new TextToSpeechClient();

        // 언어별 음성 설정
        this.voiceConfig = {
            ru: {
                languageCode: 'ru-RU',
                name: 'ru-RU-Wavenet-B',  // 남성 음성
                ssmlGender: 'MALE'
            },
            zh: {
                languageCode: 'cmn-CN',
                name: 'cmn-CN-Wavenet-B',  // 남성 음성
                ssmlGender: 'MALE'
            },
            vi: {
                languageCode: 'vi-VN',
                name: 'vi-VN-Wavenet-B',  // 남성 음성
                ssmlGender: 'MALE'
            },
            en: {
                languageCode: 'en-US',
                name: 'en-US-Wavenet-D',  // 남성 음성
                ssmlGender: 'MALE'
            }
        };

        // 오디오 설정
        this.audioConfig = {
            audioEncoding: 'LINEAR16',
            sampleRateHertz: 24000,  // 클라이언트와 일치
            speakingRate: 1.0,       // 기본 속도
            pitch: 0.0               // 기본 피치
        };
    }

    /**
     * 텍스트를 음성으로 변환
     * @param {string} text - 번역된 텍스트
     * @param {string} language - 언어 코드 (ru, zh, vi, en)
     * @returns {Promise<Buffer>} PCM 오디오 데이터
     */
    async synthesize(text, language) {
        if (!text || !text.trim()) return null;

        const voiceCfg = this.voiceConfig[language];
        if (!voiceCfg) {
            console.error(`❌ TTS 지원하지 않는 언어: ${language}`);
            return null;
        }

        try {
            const request = {
                input: { text },
                voice: voiceCfg,
                audioConfig: this.audioConfig
            };

            const [response] = await this.client.synthesizeSpeech(request);

            console.log(`🔊 TTS 생성 [${language}]: ${text.substring(0, 30)}... (${response.audioContent.length} bytes)`);

            return response.audioContent;

        } catch (error) {
            console.error(`❌ TTS 오류 [${language}]:`, error.message);
            return null;
        }
    }

    /**
     * 음성 설정 업데이트
     */
    setVoiceConfig(language, config) {
        if (this.voiceConfig[language]) {
            this.voiceConfig[language] = { ...this.voiceConfig[language], ...config };
        }
    }

    /**
     * 오디오 설정 업데이트
     */
    setAudioConfig(config) {
        this.audioConfig = { ...this.audioConfig, ...config };
    }

    /**
     * 속도 조절
     */
    setSpeakingRate(rate) {
        this.audioConfig.speakingRate = Math.max(0.5, Math.min(2.0, rate));
    }
}

export default TTSHandler;
