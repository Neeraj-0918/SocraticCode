(function () {
  // Acquire VS Code API
  const vscode = acquireVsCodeApi();

  // DOM Elements
  const btnAnalyze = document.getElementById('btn-analyze');
  const btnAsk = document.getElementById('btn-ask');
  const btnNextHint = document.getElementById('btn-next-hint');
  const btnDashboard = document.getElementById('btn-dashboard');
  const btnClear = document.getElementById('btn-clear');
  const questionInput = document.getElementById('question-input');
  const langBadge = document.getElementById('lang-badge');
  const providerBadge = document.getElementById('provider-badge');
  const analysisResults = document.getElementById('analysis-results');
  const hintsContainer = document.getElementById('hints-container');
  const hintLevelIndicator = document.getElementById('hint-level-indicator');

  // Event Listeners
  btnAnalyze.addEventListener('click', () => {
    vscode.postMessage({ type: 'analyzeFile' });
  });

  btnAsk.addEventListener('click', () => {
    const text = questionInput.value.trim();
    vscode.postMessage({ type: 'askQuestion', text });
    questionInput.value = '';
  });

  questionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      btnAsk.click();
    }
  });

  btnNextHint.addEventListener('click', () => {
    vscode.postMessage({ type: 'requestNextHint' });
  });

  btnDashboard.addEventListener('click', () => {
    vscode.postMessage({ type: 'openDashboard' });
  });

  btnClear.addEventListener('click', () => {
    vscode.postMessage({ type: 'clearSession' });
  });

  // Handle incoming messages from extension host
  window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.type) {
      case 'updateStatus': {
        if (message.language) langBadge.textContent = message.language;
        if (message.provider) {
          providerBadge.textContent = message.provider;
          providerBadge.className = message.isAi ? 'badge mode-ai' : 'badge mode-demo';
        }
        break;
      }
      case 'analysisResult': {
        if (message.html) {
          analysisResults.innerHTML = message.html;
          analysisResults.classList.remove('empty');
        }
        break;
      }
      case 'hintResult': {
        if (message.level) {
          hintLevelIndicator.textContent = `Level ${message.level}/3`;
          if (message.level < 3) {
            btnNextHint.disabled = false;
            btnNextHint.textContent = `Request Next Hint (L${message.level + 1})`;
          } else {
            btnNextHint.disabled = true;
            btnNextHint.textContent = 'All Hints Revealed';
          }
        }
        if (message.cardHtml) {
          const emptyCard = hintsContainer.querySelector('.empty-card');
          if (emptyCard) {
            emptyCard.remove();
          }
          hintsContainer.innerHTML += message.cardHtml;
          // Scroll to the latest hint
          hintsContainer.scrollTop = hintsContainer.scrollHeight;
        }
        break;
      }
      case 'clearSession': {
        hintsContainer.innerHTML = '<div class="hint-card empty-card"><p class="placeholder-text">Hints will guide you step-by-step: Conceptual → Logical Reasoning → Structural Guidance.</p></div>';
        hintLevelIndicator.textContent = 'Level 0/3';
        btnNextHint.disabled = true;
        btnNextHint.textContent = 'Request Next Hint (L1)';
        analysisResults.innerHTML = '<p class="placeholder-text">Click "Analyze File" or select code in the editor to inspect AST structure.</p>';
        analysisResults.classList.add('empty');
        break;
      }
    }
  });
})();
