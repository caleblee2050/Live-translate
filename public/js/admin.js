let keywords = [];

/**
 * 시스템 상태 확인
 */
async function checkSystemStatus() {
    try {
        const response = await fetch('/api/status');
        const status = await response.json();

        const statusHtml = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
        <div style="background: var(--bg-darker); padding: 1rem; border-radius: 8px;">
          <div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">서버 상태</div>
          <div style="font-size: 1.25rem; font-weight: 600; color: var(--success);">
            ${status.server === 'running' ? '✅ 실행 중' : '❌ 중지'}
          </div>
        </div>
        
        <div style="background: var(--bg-darker); padding: 1rem; border-radius: 8px;">
          <div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">러시아어 API</div>
          <div style="font-size: 1.25rem; font-weight: 600; color: ${status.gemini.ru === 'connected' ? 'var(--success)' : 'var(--error)'};">
            ${status.gemini.ru === 'connected' ? '✅ 연결됨' : '❌ 연결 안됨'}
          </div>
        </div>
        
        <div style="background: var(--bg-darker); padding: 1rem; border-radius: 8px;">
          <div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">중국어 API</div>
          <div style="font-size: 1.25rem; font-weight: 600; color: ${status.gemini.zh === 'connected' ? 'var(--success)' : 'var(--error)'};">
            ${status.gemini.zh === 'connected' ? '✅ 연결됨' : '❌ 연결 안됨'}
          </div>
        </div>
        
        <div style="background: var(--bg-darker); padding: 1rem; border-radius: 8px;">
          <div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">베트남어 API</div>
          <div style="font-size: 1.25rem; font-weight: 600; color: ${status.gemini.vi === 'connected' ? 'var(--success)' : 'var(--error)'};">
            ${status.gemini.vi === 'connected' ? '✅ 연결됨' : '❌ 연결 안됨'}
          </div>
        </div>
        
        <div style="background: var(--bg-darker); padding: 1rem; border-radius: 8px;">
          <div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">접속자 (러시아어)</div>
          <div style="font-size: 1.25rem; font-weight: 600;">
            👥 ${status.clients.ru || 0}명
          </div>
        </div>
        
        <div style="background: var(--bg-darker); padding: 1rem; border-radius: 8px;">
          <div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">접속자 (중국어)</div>
          <div style="font-size: 1.25rem; font-weight: 600;">
            👥 ${status.clients.zh || 0}명
          </div>
        </div>
        
        <div style="background: var(--bg-darker); padding: 1rem; border-radius: 8px;">
          <div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">접속자 (베트남어)</div>
          <div style="font-size: 1.25rem; font-weight: 600;">
            👥 ${status.clients.vi || 0}명
          </div>
        </div>
      </div>
    `;

        document.getElementById('systemStatus').innerHTML = statusHtml;
    } catch (error) {
        console.error('상태 확인 오류:', error);
        document.getElementById('systemStatus').innerHTML = '<p style="color: var(--error);">❌ 서버와 연결할 수 없습니다.</p>';
    }
}

/**
 * 키워드 추가
 */
function addKeyword(event) {
    if (event.key === 'Enter') {
        event.preventDefault();

        const input = document.getElementById('keywordInput');
        const keyword = input.value.trim();

        if (keyword && !keywords.includes(keyword)) {
            keywords.push(keyword);
            renderKeywords();
            input.value = '';
        }
    }
}

/**
 * 키워드 제거
 */
function removeKeyword(keyword) {
    keywords = keywords.filter(k => k !== keyword);
    renderKeywords();
}

/**
 * 키워드 렌더링
 */
function renderKeywords() {
    const container = document.getElementById('keywords');
    container.innerHTML = keywords.map(keyword => `
    <div class="tag">
      <span>${keyword}</span>
      <span class="tag-remove" onclick="removeKeyword('${keyword}')">×</span>
    </div>
  `).join('');
}

/**
 * 컨텍스트 제출
 */
async function submitContext(event) {
    event.preventDefault();

    const sermonText = document.getElementById('sermonText').value.trim();

    if (!sermonText) {
        alert('설교 본문을 입력해주세요.');
        return;
    }

    try {
        const response = await fetch('/api/inject-context', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sermonText,
                keywords
            })
        });

        const result = await response.json();

        if (result.success) {
            alert('✅ 컨텍스트가 성공적으로 주입되었습니다!\n\n이제 설교를 시작하면 더 정확한 번역이 제공됩니다.');
        } else {
            alert('❌ 컨텍스트 주입 실패: ' + result.message);
        }
    } catch (error) {
        console.error('컨텍스트 주입 오류:', error);
        alert('❌ 서버와 통신할 수 없습니다.');
    }
}

/**
 * 신학 용어 목록 표시
 */
function displayTheologicalTerms() {
    const terms = {
        "은혜": { ru: "благодать", zh: "恩典", vi: "ân điển" },
        "구원": { ru: "спасение", zh: "救恩", vi: "sự cứu rỗi" },
        "성령": { ru: "Святой Дух", zh: "圣灵", vi: "Chúa Thánh Thần" },
        "복음": { ru: "Евангелие", zh: "福音", vi: "Tin Mừng" },
        "회개": { ru: "покаяние", zh: "悔改", vi: "sự ăn năn" },
        "믿음": { ru: "вера", zh: "信心", vi: "đức tin" },
        "축복": { ru: "благословение", zh: "祝福", vi: "phước lành" },
        "기도": { ru: "молитва", zh: "祷告", vi: "cầu nguyện" }
    };

    const termsHtml = `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem;">
      ${Object.entries(terms).map(([korean, translations]) => `
        <div style="background: var(--bg-darker); padding: 1rem; border-radius: 8px; border-left: 3px solid var(--primary);">
          <div style="font-weight: 600; margin-bottom: 0.5rem;">${korean}</div>
          <div style="font-size: 0.875rem; color: var(--text-secondary);">
            <div>🇷🇺 ${translations.ru}</div>
            <div>🇨🇳 ${translations.zh}</div>
            <div>🇻🇳 ${translations.vi}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

    document.getElementById('termsList').innerHTML = termsHtml;
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    checkSystemStatus();
    displayTheologicalTerms();

    // 5초마다 상태 업데이트
    setInterval(checkSystemStatus, 5000);
});
