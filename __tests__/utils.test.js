const { 
  loadCustomDictionary, 
  createLintResult, 
  extractTextFromMarkdown, 
  getLineAndColumn 
} = require('../src/utils');
const fs = require('fs');
const path = require('path');

describe('Utils functions', () => {
  describe('extractTextFromMarkdown', () => {
    test('should extract text from markdown', () => {
      const markdown = `# タイトル
      
**太字**の文章と*イタリック*の文章です。

\`\`\`javascript
const code = 'これは除外される';
\`\`\`

[リンク](http://example.com)の文章です。`;

      const result = extractTextFromMarkdown(markdown);
      expect(result).toContain('タイトル');
      expect(result).toContain('太字の文章とイタリックの文章です');
      expect(result).toContain('リンクの文章です');
      expect(result).not.toContain('const code');
    });
  });

  describe('getLineAndColumn', () => {
    test('should return correct line and column', () => {
      const content = `line1
line2
line3`;
      
      const pos = getLineAndColumn(content, 6); // 'line2'の開始位置
      expect(pos.line).toBe(2);
      expect(pos.column).toBe(1);
    });
  });

  describe('createLintResult', () => {
    test('should create lint result object', () => {
      const result = createLintResult('test.md', 1, 1, 'Test message', 'WARNING');
      
      expect(result).toEqual({
        filePath: 'test.md',
        line: 1,
        column: 1,
        endLine: null,
        endColumn: null,
        message: 'Test message',
        severity: 'WARNING',
        suggestions: []
      });
    });
  });

  describe('loadCustomDictionary', () => {
    test('should load YAML dictionary', () => {
      const dictPath = path.join(__dirname, 'test-dict.yml');
      const dictContent = `JavaScript:
  - javascript
  - Javascript`;
      
      fs.writeFileSync(dictPath, dictContent);
      
      const dict = loadCustomDictionary(dictPath);
      expect(dict.JavaScript).toEqual(['javascript', 'Javascript']);
      
      fs.unlinkSync(dictPath);
    });

    test('should return empty object for non-existent file', () => {
      const dict = loadCustomDictionary('non-existent.yml');
      expect(dict).toEqual({});
    });
  });
});