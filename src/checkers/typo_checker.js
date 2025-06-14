const { createLintResult, extractTextFromMarkdown, getLineAndColumn } = require('../utils');

// 一般的な技術用語の誤記チェック
const commonTypos = {
  'Javascript': 'JavaScript',
  'javascript': 'JavaScript',
  'Github': 'GitHub',
  'github': 'GitHub',
  'Nodejs': 'Node.js',
  'nodejs': 'Node.js',
  'Reactjs': 'React.js',
  'reactjs': 'React.js',
  'Vuejs': 'Vue.js',
  'vuejs': 'Vue.js',
  'Typescript': 'TypeScript',
  'typescript': 'TypeScript',
  'Html': 'HTML',
  'Css': 'CSS',
  'Api': 'API',
  'Url': 'URL',
  'Json': 'JSON',
  'Xml': 'XML',
  'Sql': 'SQL',
  'Aws': 'AWS',
  'Gcp': 'GCP',
  'Ios': 'iOS',
  'Macos': 'macOS',
  'Mysql': 'MySQL',
  'Postgresql': 'PostgreSQL',
  'Redis': 'Redis',
  'Docker': 'Docker',
  'Kubernetes': 'Kubernetes',
  'Webpack': 'webpack',
  'Eslint': 'ESLint',
  'Prettier': 'Prettier'
};

// よくある日本語の誤記
const japaneseTypos = {
  '以下の通りです。': '以下のとおりです。',
  '通り': 'とおり',
  '既に': 'すでに',
  '全て': 'すべて',
  '更に': 'さらに',
  '殆ど': 'ほとんど',
  '何故': 'なぜ',
  '何処': 'どこ',
  '何時': 'いつ',
  '其の': 'その',
  '此の': 'この',
  '彼の': 'あの'
};

async function check(filePath, content) {
  const results = [];
  const text = extractTextFromMarkdown(content);
  
  // 技術用語の誤記チェック
  for (const [typo, correct] of Object.entries(commonTypos)) {
    const regex = new RegExp(`\\b${typo}\\b`, 'g');
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      const pos = getLineAndColumn(content, match.index);
      results.push(createLintResult(
        filePath,
        pos.line,
        pos.column,
        `「${typo}」は「${correct}」の誤記の可能性があります。`,
        'WARNING',
        pos.line,
        pos.column + typo.length,
        [correct]
      ));
    }
  }

  // 日本語の誤記チェック
  for (const [typo, correct] of Object.entries(japaneseTypos)) {
    const index = content.indexOf(typo);
    if (index !== -1) {
      const pos = getLineAndColumn(content, index);
      results.push(createLintResult(
        filePath,
        pos.line,
        pos.column,
        `「${typo}」は「${correct}」を推奨します。`,
        'WARNING',
        pos.line,
        pos.column + typo.length,
        [correct]
      ));
    }
  }

  // 長音符の誤用チェック（カタカナ語）
  const longVowelPattern = /[ァ-ヴ][ー]{2,}/g;
  let match;
  while ((match = longVowelPattern.exec(content)) !== null) {
    const pos = getLineAndColumn(content, match.index);
    results.push(createLintResult(
      filePath,
      pos.line,
      pos.column,
      `長音符が連続しています: 「${match[0]}」`,
      'INFO'
    ));
  }

  return results;
}

module.exports = {
  check
};