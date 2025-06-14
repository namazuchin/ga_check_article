const { createLintResult, extractTextFromMarkdown, getLineAndColumn } = require('../utils');

async function check(filePath, content) {
  const results = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;
    const text = extractTextFromMarkdown(line);
    
    if (!text.trim()) continue;

    // 一文の長さチェック
    const sentences = text.split(/[。！？]/).filter(s => s.trim());
    for (const sentence of sentences) {
      if (sentence.length > 120) {
        const sentenceStart = line.indexOf(sentence);
        results.push(createLintResult(
          filePath,
          lineNumber,
          sentenceStart + 1,
          `一文が長すぎます。現在${sentence.length}文字です。120文字以下を推奨します。`,
          'INFO'
        ));
      }
    }

    // 連続する助詞のチェック
    const consecutiveParticles = /[がのをにへとでや]{2,}/g;
    let match;
    while ((match = consecutiveParticles.exec(line)) !== null) {
      const pos = getLineAndColumn(content, match.index);
      results.push(createLintResult(
        filePath,
        pos.line,
        pos.column,
        `助詞が連続しています: 「${match[0]}」`,
        'INFO'
      ));
    }

    // 同じ助詞の連続使用チェック
    const duplicateParticles = /(が.*が|の.*の|を.*を|に.*に|へ.*へ|と.*と|で.*で|や.*や)/;
    if (duplicateParticles.test(text)) {
      results.push(createLintResult(
        filePath,
        lineNumber,
        1,
        '同じ助詞が重複して使用されている可能性があります。',
        'INFO'
      ));
    }

    // 読点の多用チェック
    const commaCount = (line.match(/、/g) || []).length;
    if (commaCount > 4) {
      results.push(createLintResult(
        filePath,
        lineNumber,
        1,
        `読点が多すぎます。現在${commaCount}個です。文を分割することを検討してください。`,
        'INFO'
      ));
    }

    // カタカナ語の長音符チェック
    const katakanaLongVowel = /[ァ-ヴ]ー{2,}/g;
    while ((match = katakanaLongVowel.exec(line)) !== null) {
      const pos = getLineAndColumn(content, match.index);
      results.push(createLintResult(
        filePath,
        pos.line,
        pos.column,
        `カタカナ語の長音符が不適切な可能性があります: 「${match[0]}」`,
        'INFO'
      ));
    }

    // 半角と全角の混在チェック
    const mixedWidth = /[０-９][0-9]|[0-9][０-９]|[Ａ-Ｚａ-ｚ][A-Za-z]|[A-Za-z][Ａ-Ｚａ-ｚ]/;
    if (mixedWidth.test(line)) {
      results.push(createLintResult(
        filePath,
        lineNumber,
        1,
        '半角と全角の文字が混在しています。統一することを推奨します。',
        'INFO'
      ));
    }

    // 感嘆符・疑問符の後のスペースチェック
    const punctuationSpace = /[！？][^\s　]/;
    if (punctuationSpace.test(line)) {
      results.push(createLintResult(
        filePath,
        lineNumber,
        1,
        '感嘆符・疑問符の後にはスペースを入れることを推奨します。',
        'INFO'
      ));
    }

    // 英数字の前後のスペースチェック（日本語技術文書での推奨）
    const noSpaceAroundAlphanumeric = /[ぁ-んァ-ヶ一-龠々][a-zA-Z0-9]|[a-zA-Z0-9][ぁ-んァ-ヶ一-龠々]/;
    if (noSpaceAroundAlphanumeric.test(line)) {
      results.push(createLintResult(
        filePath,
        lineNumber,
        1,
        '日本語と英数字の間にはスペースを入れることを推奨します。',
        'INFO'
      ));
    }
  }

  return results;
}

module.exports = {
  check
};