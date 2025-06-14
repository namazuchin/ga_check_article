const glob = require('glob');
const fs = require('fs');
const path = require('path');
const typoChecker = require('./checkers/typo_checker');
const properNounChecker = require('./checkers/proper_noun_checker');
const readabilityChecker = require('./checkers/readability_checker');

async function lint(targetFiles, customDictionaryPath) {
  const allResults = [];

  // globパターンでファイルを取得
  const files = glob.sync(targetFiles, { 
    ignore: ['node_modules/**', '.git/**', 'dist/**'],
    cwd: process.env.GITHUB_WORKSPACE || process.cwd()
  });

  if (files.length === 0) {
    console.log('対象ファイルが見つかりません');
    return allResults;
  }

  console.log(`対象ファイル数: ${files.length}`);

  for (const filePath of files) {
    const absolutePath = path.resolve(process.env.GITHUB_WORKSPACE || process.cwd(), filePath);
    
    if (!fs.existsSync(absolutePath)) {
      console.log(`ファイルが見つかりません: ${absolutePath}`);
      continue;
    }

    const content = fs.readFileSync(absolutePath, 'utf8');
    console.log(`校閲中: ${filePath}`);

    // 各チェッカーを実行
    const typoResults = await typoChecker.check(filePath, content);
    const properNounResults = await properNounChecker.check(filePath, content, customDictionaryPath);
    const readabilityResults = await readabilityChecker.check(filePath, content);

    allResults.push(...typoResults, ...properNounResults, ...readabilityResults);
  }

  console.log(`総指摘数: ${allResults.length}`);
  return allResults;
}

async function lintFiles(files, customDictionaryPath) {
  const allResults = [];

  if (files.length === 0) {
    console.log('対象ファイルが見つかりません');
    return allResults;
  }

  console.log(`対象ファイル数: ${files.length}`);

  for (const filePath of files) {
    const absolutePath = path.resolve(process.env.GITHUB_WORKSPACE || process.cwd(), filePath);
    
    if (!fs.existsSync(absolutePath)) {
      console.log(`ファイルが見つかりません: ${absolutePath}`);
      continue;
    }

    const content = fs.readFileSync(absolutePath, 'utf8');
    console.log(`校閲中: ${filePath}`);

    // 各チェッカーを実行
    const typoResults = await typoChecker.check(filePath, content);
    const properNounResults = await properNounChecker.check(filePath, content, customDictionaryPath);
    const readabilityResults = await readabilityChecker.check(filePath, content);

    allResults.push(...typoResults, ...properNounResults, ...readabilityResults);
  }

  console.log(`総指摘数: ${allResults.length}`);
  return allResults;
}

module.exports = {
  lint,
  lintFiles
};