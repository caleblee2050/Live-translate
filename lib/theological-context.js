import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class TheologicalContext {
  constructor() {
    this.terms = null;
    this.systemPrompts = null;
    this.loadData();
  }

  loadData() {
    try {
      // 신학 용어 사전 로드
      const termsPath = join(__dirname, '../config/theological-terms.json');
      this.terms = JSON.parse(fs.readFileSync(termsPath, 'utf-8'));

      // 시스템 프롬프트 로드
      const promptsPath = join(__dirname, '../config/system-prompts.json');
      this.systemPrompts = JSON.parse(fs.readFileSync(promptsPath, 'utf-8'));

      console.log('✅ 신학 컨텍스트 데이터 로드 완료');
    } catch (error) {
      console.error('❌ 신학 컨텍스트 데이터 로드 실패:', error);
      throw error;
    }
  }

  /**
   * 특정 언어의 시스템 프롬프트 생성
   * @param {string} language - 언어 코드 (ru/zh/vi)
   * @param {object} context - 추가 컨텍스트 (설교 본문, 키워드 등)
   * @returns {string} 시스템 프롬프트
   */
  buildSystemPrompt(language, context = {}) {
    const prompt = this.systemPrompts[language];
    if (!prompt) {
      throw new Error(`지원하지 않는 언어: ${language}`);
    }

    let systemMessage = `${prompt.role}\n\n`;
    systemMessage += `**임무**: ${prompt.task}\n\n`;
    systemMessage += `**지침**:\n`;
    prompt.guidelines.forEach((guideline, index) => {
      systemMessage += `${index + 1}. ${guideline}\n`;
    });

    // 사전 로딩된 컨텍스트 추가 (참고용)
    if (context.sermonText || (context.keywords && context.keywords.length > 0)) {
      systemMessage += `\n**📋 사전 제공된 참고 자료 (REFERENCE ONLY)**:\n`;
      systemMessage += `⚠️ 아래 내용은 참고용입니다. 실제 화자의 발화 내용과 다를 수 있으니, 항상 실제 음성을 우선하여 번역하세요.\n`;

      if (context.sermonText) {
        systemMessage += `\n오늘의 예상 본문: ${context.sermonText}\n`;
      }

      if (context.keywords && context.keywords.length > 0) {
        systemMessage += `예상 핵심 키워드: ${context.keywords.join(', ')}\n`;
      }

      systemMessage += `\n`;
    }

    // 신학 용어 사전 추가
    systemMessage += `\n**신학 용어 번역 규칙**:\n`;
    Object.entries(this.terms.terms).forEach(([korean, translations]) => {
      systemMessage += `- "${korean}" → "${translations[language]}" (${translations.context})\n`;
    });

    // 성경 인명 번역
    systemMessage += `\n**성경 인명 표기**:\n`;
    Object.entries(this.terms.biblicalNames).forEach(([korean, translations]) => {
      systemMessage += `- ${korean} → ${translations[language]}\n`;
    });

    // 성경 지명 번역
    systemMessage += `\n**성경 지명 표기**:\n`;
    Object.entries(this.terms.biblicalPlaces).forEach(([korean, translations]) => {
      systemMessage += `- ${korean} → ${translations[language]}\n`;
    });

    systemMessage += `\n**사고 유도 질문**: 중요한 포인트 후 간단히 "${prompt.reflectionPrompt}" 같은 질문을 제공하세요.\n`;

    // 동시통역 핵심 지침 (CRITICAL)
    systemMessage += `\n**⚡ 동시통역 모드 (CRITICAL - 반드시 따르세요)**:\n`;
    systemMessage += `- 화자가 말하는 동안 실시간으로 번역하세요. 문장이 끝날 때까지 기다리지 마세요!\n`;
    systemMessage += `- 2-3개의 단어 그룹(청크)을 듣자마자 즉시 번역을 시작하세요.\n`;
    systemMessage += `- 문맥이 불완전해도 예측하여 번역하고, 필요시 자연스럽게 수정하세요.\n`;
    systemMessage += `- "그래서", "그리고", "즉" 같은 연결어를 사용해 자연스럽게 이어가세요.\n`;
    systemMessage += `- 절대로 침묵하며 기다리지 마세요. 항상 말하면서 번역하세요.\n`;

    return systemMessage;
  }

  /**
   * 특정 용어의 번역 가져오기
   * @param {string} koreanTerm - 한국어 용어
   * @param {string} language - 대상 언어
   * @returns {string|null} 번역된 용어
   */
  getTranslation(koreanTerm, language) {
    // 일반 신학 용어
    if (this.terms.terms[koreanTerm]) {
      return this.terms.terms[koreanTerm][language];
    }

    // 성경 인명
    if (this.terms.biblicalNames[koreanTerm]) {
      return this.terms.biblicalNames[koreanTerm][language];
    }

    // 성경 지명
    if (this.terms.biblicalPlaces[koreanTerm]) {
      return this.terms.biblicalPlaces[koreanTerm][language];
    }

    return null;
  }

  /**
   * 통찰적 질문 생성
   * @param {string} language - 언어 코드
   * @returns {string} 질문
   */
  getReflectionPrompt(language) {
    return this.systemPrompts[language]?.reflectionPrompt || '';
  }

  /**
   * 지원되는 언어 목록
   * @returns {string[]} 언어 코드 배열
   */
  getSupportedLanguages() {
    return Object.keys(this.systemPrompts);
  }
}

export default TheologicalContext;
