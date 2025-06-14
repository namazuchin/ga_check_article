const fs = require('fs');
const yaml = require('js-yaml');

function loadCustomDictionary(dictionaryPath) {
  if (!dictionaryPath || !fs.existsSync(dictionaryPath)) {
    return {};
  }

  try {
    const content = fs.readFileSync(dictionaryPath, 'utf8');
    const ext = dictionaryPath.toLowerCase().split('.').pop();
    
    if (ext === 'yml' || ext === 'yaml') {
      return yaml.load(content) || {};
    } else if (ext === 'json') {
      return JSON.parse(content);
    } else {
      // プレーンテキストの場合、1行1語として処理
      return content.split('\n')
        .filter(line => line.trim())
        .reduce((dict, word) => {
          dict[word.trim()] = true;
          return dict;
        }, {});
    }
  } catch (error) {
    console.warn(`辞書ファイルの読み込みに失敗しました: ${dictionaryPath}`, error.message);
    return {};
  }
}

function createLintResult(filePath, line, column, message, severity = 'WARNING', endLine = null, endColumn = null, suggestions = []) {
  return {
    filePath,
    line,
    column,
    endLine,
    endColumn,
    message,
    severity,
    suggestions
  };
}

function extractTextFromMarkdown(content) {
  // 簡易的なMarkdownパーサー
  // コードブロック、インラインコード、リンクなどを除外
  return content
    .replace(/```[\s\S]*?```/g, '') // コードブロック除去
    .replace(/`[^`]+`/g, '') // インラインコード除去
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // リンクテキストのみ抽出
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1') // 画像のalt textのみ抽出
    .replace(/^#+\s*/gm, '') // ヘッダーマーク除去
    .replace(/^\s*[-*+]\s+/gm, '') // リストマーク除去
    .replace(/^\s*\d+\.\s+/gm, '') // 番号付きリストマーク除去
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold除去
    .replace(/\*([^*]+)\*/g, '$1') // Italic除去
    .replace(/~~([^~]+)~~/g, '$1') // 取り消し線除去
    .trim();
}

function getLineAndColumn(content, position) {
  const lines = content.substring(0, position).split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  };
}

module.exports = {
  loadCustomDictionary,
  createLintResult,
  extractTextFromMarkdown,
  getLineAndColumn
};