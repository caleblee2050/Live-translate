/**
 * 오디오 스트림 처리 유틸리티
 */
class AudioProcessor {
    constructor() {
        this.sampleRate = 16000; // Gemini 입력: 16kHz
        this.channels = 1; // Mono
        this.bitDepth = 16; // 16-bit PCM
    }

    /**
     * WebRTC/브라우저 오디오를 Gemini 포맷으로 변환
     * @param {ArrayBuffer} inputBuffer - 입력 오디오 버퍼
     * @param {number} inputSampleRate - 입력 샘플레이트
     * @returns {Buffer} PCM 버퍼 (16kHz, 16-bit, mono)
     */
    convertToGeminiFormat(inputBuffer, inputSampleRate = 48000) {
        // 리샘플링 (48kHz → 16kHz)
        const resampled = this.resample(inputBuffer, inputSampleRate, this.sampleRate);

        // Float32 → Int16 변환
        const pcm = this.floatTo16BitPCM(resampled);

        return Buffer.from(pcm.buffer);
    }

    /**
     * 리샘플링
     * @param {Float32Array} buffer - 입력 버퍼
     * @param {number} fromRate - 원본 샘플레이트
     * @param {number} toRate - 대상 샘플레이트
     * @returns {Float32Array} 리샘플된 버퍼
     */
    resample(buffer, fromRate, toRate) {
        if (fromRate === toRate) {
            return buffer;
        }

        const ratio = fromRate / toRate;
        const newLength = Math.round(buffer.length / ratio);
        const result = new Float32Array(newLength);

        for (let i = 0; i < newLength; i++) {
            const srcIndex = i * ratio;
            const srcIndexFloor = Math.floor(srcIndex);
            const srcIndexCeil = Math.min(srcIndexFloor + 1, buffer.length - 1);
            const fraction = srcIndex - srcIndexFloor;

            // 선형 보간
            result[i] = buffer[srcIndexFloor] * (1 - fraction) +
                buffer[srcIndexCeil] * fraction;
        }

        return result;
    }

    /**
     * Float32 → Int16 PCM 변환
     * @param {Float32Array} float32Array - Float32 오디오 데이터
     * @returns {Int16Array} Int16 PCM 데이터
     */
    floatTo16BitPCM(float32Array) {
        const int16Array = new Int16Array(float32Array.length);

        for (let i = 0; i < float32Array.length; i++) {
            // Float32 값 (-1.0 ~ 1.0)을 Int16 범위로 변환
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        return int16Array;
    }

    /**
     * Gemini 출력 오디오(24kHz)를 브라우저 재생용으로 변환
     * @param {Buffer} pcmBuffer - Gemini 출력 PCM (24kHz)
     * @returns {Buffer} 재생 가능한 오디오 버퍼
     */
    convertFromGeminiFormat(pcmBuffer) {
        // 24kHz, 16-bit PCM을 그대로 반환
        // 브라우저의 Web Audio API가 자동으로 리샘플링 처리
        return pcmBuffer;
    }

    /**
     * 오디오 청크 버퍼링
     */
    createChunker(chunkSize = 4096) {
        let buffer = Buffer.alloc(0);

        return {
            add: (data) => {
                buffer = Buffer.concat([buffer, data]);
            },

            getChunks: () => {
                const chunks = [];
                while (buffer.length >= chunkSize) {
                    chunks.push(buffer.slice(0, chunkSize));
                    buffer = buffer.slice(chunkSize);
                }
                return chunks;
            },

            flush: () => {
                if (buffer.length > 0) {
                    const chunk = buffer;
                    buffer = Buffer.alloc(0);
                    return chunk;
                }
                return null;
            }
        };
    }

    /**
     * 간단한 노이즈 게이트
     * @param {Buffer} pcmBuffer - PCM 버퍼
     * @param {number} threshold - 임계값 (0-1)
     * @returns {Buffer} 처리된 버퍼
     */
    applyNoiseGate(pcmBuffer, threshold = 0.01) {
        const int16Array = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.length / 2);
        const maxAmplitude = 0x7FFF;
        const thresholdValue = threshold * maxAmplitude;

        for (let i = 0; i < int16Array.length; i++) {
            if (Math.abs(int16Array[i]) < thresholdValue) {
                int16Array[i] = 0;
            }
        }

        return Buffer.from(int16Array.buffer);
    }
}

export default AudioProcessor;
