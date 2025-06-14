const { lint } = require('../src/main');
const fs = require('fs');
const path = require('path');

// テスト用のサンプルファイルを作成
const testFilePath = path.join(__dirname, 'sample.md');
const testContent = `# テスト記事

これはJavascriptの記事です。Githubで公開しています。

一文が非常に長くて読みにくい文章の例です。この文章は120文字を超えているため、読みやすさの観点から分割することを推奨される可能性があります。

APIキーを設定します。WEB APIを利用します。

以下の通りです。全てのファイルを確認します。

日本語とEnglishが混在している文章です。
`;

describe('Main lint function', () => {
  beforeAll(() => {
    // テスト用ファイルを作成
    fs.writeFileSync(testFilePath, testContent);
  });

  afterAll(() => {
    // テスト用ファイルを削除
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  test('should detect typos and style issues', async () => {
    const results = await lint(testFilePath);
    
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);

    // 誤字の検出
    const typoResults = results.filter(r => r.message.includes('Javascript') || r.message.includes('Github'));
    expect(typoResults.length).toBeGreaterThan(0);

    // 読みやすさの問題検出
    const readabilityResults = results.filter(r => r.message.includes('長すぎ') || r.message.includes('スペース'));
    expect(readabilityResults.length).toBeGreaterThan(0);
  });

  test('should return empty array for non-existent files', async () => {
    const results = await lint('non-existent-file.md');
    expect(results).toEqual([]);
  });

  test('should handle empty markdown files', async () => {
    const emptyFilePath = path.join(__dirname, 'empty.md');
    fs.writeFileSync(emptyFilePath, '');
    
    const results = await lint(emptyFilePath);
    expect(results).toEqual([]);
    
    fs.unlinkSync(emptyFilePath);
  });
});