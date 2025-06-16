const { createLintResult, loadCustomDictionary, getLineAndColumn } = require('../utils');

// 一般的な固有名詞の表記ゆれ
const commonProperNouns = {
  'github': 'GitHub',
  'Github': 'GitHub',
  'javascript': 'JavaScript',
  'Javascript': 'JavaScript',
  'typescript': 'TypeScript',
  'Typescript': 'TypeScript',
  'nodejs': 'Node.js',
  'Nodejs': 'Node.js',
  'reactjs': 'React.js',
  'Reactjs': 'React.js',
  'vuejs': 'Vue.js',
  'Vuejs': 'Vue.js',
  'webpack': 'webpack',
  'Webpack': 'webpack',
  'eslint': 'ESLint',
  'Eslint': 'ESLint',
  'aws': 'AWS',
  'Aws': 'AWS',
  'gcp': 'GCP',
  'Gcp': 'GCP',
  'mysql': 'MySQL',
  'Mysql': 'MySQL',
  'postgresql': 'PostgreSQL',
  'Postgresql': 'PostgreSQL',
  'redis': 'Redis',
  'docker': 'Docker',
  'kubernetes': 'Kubernetes',
  'Kubernetes': 'Kubernetes',
  'ios': 'iOS',
  'Ios': 'iOS',
  'macos': 'macOS',
  'Macos': 'macOS',
  'MacOS': 'macOS'
};

async function check(filePath, content, customDictionaryPath) {
  const results = [];
  
  // カスタム辞書の読み込み
  let customDict = {};
  if (customDictionaryPath) {
    customDict = loadCustomDictionary(customDictionaryPath);
  }

  // 共通の固有名詞チェック
  const allProperNouns = { ...commonProperNouns, ...customDict };
  
  for (const [incorrect, correct] of Object.entries(allProperNouns)) {
    if (typeof correct !== 'string') continue;
    
    const regex = new RegExp(`\\b${incorrect}\\b`, 'g');
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      const pos = getLineAndColumn(content, match.index);
      results.push(createLintResult(
        filePath,
        pos.line,
        pos.column,
        `「${incorrect}」は「${correct}」の誤記の可能性があります。`,
        'WARNING',
        pos.line,
        pos.column + incorrect.length,
        [correct]
      ));
    }
  }

  // 技術用語の一般的な表記ミス
  const techTermPatterns = [
    {
      pattern: /\bAPI\s*キー\b/g,
      correct: 'APIキー',
      message: 'APIキーは一語で表記することを推奨します。'
    },
    {
      pattern: /\bWEB\s*API\b/g,
      correct: 'Web API',
      message: 'Web APIの表記を推奨します。'
    },
    {
      pattern: /\bweb\s*api\b/gi,
      correct: 'Web API',
      message: 'Web APIの表記を推奨します。'
    }
  ];

  for (const { pattern, correct, message } of techTermPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const pos = getLineAndColumn(content, match.index);
      results.push(createLintResult(
        filePath,
        pos.line,
        pos.column,
        message,
        'INFO',
        pos.line,
        pos.column + match[0].length,
        [correct]
      ));
    }
  }

  return results;
}

module.exports = {
  check
};
