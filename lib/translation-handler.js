/**
 * Gemini 텍스트 번역 핸들러
 * 한국어 텍스트를 다국어로 실시간 번역
 */

import { GoogleGenAI } from '@google/genai';

class TranslationHandler {
    constructor(apiKey) {
        this.ai = new GoogleGenAI({ apiKey });
        this.model = 'gemini-2.0-flash';

        // 언어별 설정
        this.languageConfig = {
            ru: { name: 'Russian', nativeName: 'Русский' },
            zh: { name: 'Chinese (Simplified)', nativeName: '中文' },
            vi: { name: 'Vietnamese', nativeName: 'Tiếng Việt' },
            en: { name: 'English', nativeName: 'English' }
        };

        // 번역 캐시 (중복 번역 방지)
        this.translationCache = new Map();
        this.CACHE_SIZE = 100;
    }

    /**
     * 텍스트 번역
     * @param {string} text - 한국어 원문
     * @param {string} targetLang - 대상 언어 코드 (ru, zh, vi, en)
     * @returns {Promise<string>} 번역된 텍스트
     */
    async translate(text, targetLang) {
        if (!text || !text.trim()) return '';

        const cacheKey = `${text}:${targetLang}`;

        // 캐시 확인
        if (this.translationCache.has(cacheKey)) {
            return this.translationCache.get(cacheKey);
        }

        const langConfig = this.languageConfig[targetLang];
        if (!langConfig) {
            console.error(`❌ 지원하지 않는 언어: ${targetLang}`);
            return text;
        }

        try {
            const prompt = this.buildPrompt(text, langConfig, targetLang);

            const response = await this.ai.models.generateContent({
                model: this.model,
                contents: prompt
            });

            const translatedText = response.text?.trim() || text;

            // 캐시 저장
            this.cacheTranslation(cacheKey, translatedText);

            console.log(`🌐 번역 [${targetLang}]: "${text.substring(0, 30)}..." → "${translatedText.substring(0, 30)}..."`);

            return translatedText;

        } catch (error) {
            console.error(`❌ 번역 오류 [${targetLang}]:`, error.message);
            return text;
        }
    }

    /**
     * 번역 프롬프트 생성
     */
    buildPrompt(text, langConfig, targetLang) {
        return `You are a professional theological interpreter specializing in Korean Christian sermons.

Translate the following Korean text into ${langConfig.name} (${langConfig.nativeName}).

**CRITICAL RULES:**
1. Translate ONLY the text, do not add explanations
2. Keep theological terms accurate (e.g., 은혜=grace, 구원=salvation, 성령=Holy Spirit)
3. Maintain the emotional tone of the original
4. Use formal, respectful religious language
5. Output ONLY the translated text, nothing else

Korean text: "${text}"

${langConfig.name} translation:`;
    }

    /**
     * 캐시에 번역 저장
     */
    cacheTranslation(key, value) {
        // 캐시 크기 제한
        if (this.translationCache.size >= this.CACHE_SIZE) {
            const firstKey = this.translationCache.keys().next().value;
            this.translationCache.delete(firstKey);
        }
        this.translationCache.set(key, value);
    }

    /**
     * 모든 언어로 동시 번역
     * @param {string} text - 한국어 원문
     * @returns {Promise<Object>} 언어별 번역 결과
     */
    async translateToAll(text) {
        const languages = Object.keys(this.languageConfig);

        const translations = await Promise.all(
            languages.map(async (lang) => {
                const translated = await this.translate(text, lang);
                return { lang, text: translated };
            })
        );

        const result = {};
        translations.forEach(({ lang, text }) => {
            result[lang] = text;
        });

        return result;
    }
}

export default TranslationHandler;
