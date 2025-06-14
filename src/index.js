const core = require('@actions/core');
const exec = require('@actions/exec');
const tc = require('@actions/tool-cache');
const path = require('path');
const fs = require('fs');
const main = require('./main');

async function run() {
  try {
    const githubToken = core.getInput('github_token', { required: true });
    const targetFiles = core.getInput('target_files') || '**/*.md';
    const customDictionaryPath = core.getInput('custom_dictionary_path');
    const reporter = core.getInput('reviewdog_reporter') || 'github-pr-check';
    const level = core.getInput('reviewdog_level') || 'warning';

    core.info(`Target files: ${targetFiles}`);
    core.info(`Reporter: ${reporter}`);
    core.info(`Level: ${level}`);

    // 1. reviewdogのセットアップ
    const reviewdogPath = await setupReviewdog();

    // 2. 校閲ロジックの実行
    const lintResults = await main.lint(targetFiles, customDictionaryPath);
    
    // 3. RDFormat JSONに変換
    const rdjsonResults = formatResultsForReviewdog(lintResults);

    if (rdjsonResults.trim() === '') {
      core.info('校閲結果なし: 問題は見つかりませんでした。');
      return;
    }

    // 4. reviewdogの実行
    const reviewdogFlags = [
      `-reporter=${reporter}`,
      `-level=${level}`,
      '-f=rdjson'
    ];

    await exec.exec(reviewdogPath, reviewdogFlags, {
      env: { ...process.env, REVIEWDOG_GITHUB_API_TOKEN: githubToken },
      input: Buffer.from(rdjsonResults)
    });

    core.info('校閲処理とreviewdogによるレポートが完了しました。');

  } catch (error) {
    core.setFailed(error.message);
  }
}

async function setupReviewdog() {
  const version = '0.17.0';
  const platform = process.platform === 'win32' ? 'windows' : (process.platform === 'darwin' ? 'darwin' : 'linux');
  const arch = process.arch === 'x64' ? 'amd64' : 'arm64';
  const downloadUrl = `https://github.com/reviewdog/reviewdog/releases/download/v${version}/reviewdog_${version}_${platform}_${arch}.tar.gz`;
  
  const cachedPath = tc.find('reviewdog', version);
  if (cachedPath) {
    core.info(`Found reviewdog in cache @ ${cachedPath}`);
    return path.join(cachedPath, 'reviewdog');
  }

  core.info(`Downloading reviewdog from ${downloadUrl}`);
  const reviewdogTarPath = await tc.downloadTool(downloadUrl);
  const reviewdogExtractedPath = await tc.extractTar(reviewdogTarPath);
  const reviewdogBinPath = path.join(reviewdogExtractedPath, 'reviewdog');

  // 実行権限を付与
  if (process.platform !== 'win32') {
    fs.chmodSync(reviewdogBinPath, '755');
  }

  const cachedDir = await tc.cacheFile(reviewdogBinPath, 'reviewdog', 'reviewdog', version);
  return path.join(cachedDir, 'reviewdog');
}

function formatResultsForReviewdog(lintResults) {
  return lintResults.map(result => {
    const rdjson = {
      message: result.message,
      location: {
        path: result.filePath,
        range: {
          start: {
            line: result.line,
            column: result.column
          }
        }
      },
      severity: result.severity || 'WARNING'
    };

    if (result.endLine && result.endColumn) {
      rdjson.location.range.end = {
        line: result.endLine,
        column: result.endColumn
      };
    }

    if (result.suggestions && result.suggestions.length > 0) {
      rdjson.suggestions = result.suggestions.map(suggestion => ({
        range: {
          start: { line: result.line, column: result.column },
          end: { line: result.endLine || result.line, column: result.endColumn || result.column }
        },
        text: suggestion
      }));
    }

    return JSON.stringify(rdjson);
  }).join('\n');
}

run();