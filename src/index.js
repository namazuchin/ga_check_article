const core = require('@actions/core');
const exec = require('@actions/exec');
const tc = require('@actions/tool-cache');
const github = require('@actions/github');
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

    // 2. PRで変更されたMDファイルを取得
    const changedMdFiles = await getChangedMarkdownFiles(githubToken, targetFiles);
    
    if (changedMdFiles.length === 0) {
      core.info('PRで変更されたMarkdownファイルがありません。');
      return;
    }

    // 3. 校閲ロジックの実行
    const lintResults = await main.lintFiles(changedMdFiles, customDictionaryPath);
    
    // 4. RDFormat JSONに変換
    const rdjsonResults = formatResultsForReviewdog(lintResults);

    if (rdjsonResults.trim() === '') {
      core.info('校閲結果なし: 問題は見つかりませんでした。');
      return;
    }

    // 5. reviewdogの実行
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
  const version = '0.20.3';
  const platform = process.platform === 'win32' ? 'windows' : (process.platform === 'darwin' ? 'darwin' : 'linux');
  const arch = process.arch === 'x64' ? 'x86_64' : 'arm64';
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

async function getChangedMarkdownFiles(githubToken, targetFilesPattern) {
  const octokit = github.getOctokit(githubToken);
  const context = github.context;
  
  // PRイベントでない場合は従来の動作（全ファイル対象）
  if (context.eventName !== 'pull_request' && context.eventName !== 'pull_request_target') {
    const glob = require('glob');
    return glob.sync(targetFilesPattern, { 
      ignore: ['node_modules/**', '.git/**', 'dist/**'],
      cwd: process.env.GITHUB_WORKSPACE || process.cwd()
    });
  }
  
  try {
    const { data: prFiles } = await octokit.rest.pulls.listFiles({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: context.payload.pull_request.number,
    });
    
    // .mdファイルかつ削除されていないファイルのみフィルタ
    const changedMdFiles = prFiles
      .filter(file => file.filename.endsWith('.md') && file.status !== 'removed')
      .map(file => file.filename);
    
    // targetFilesPatternでさらにフィルタ（globパターンマッチ）
    const minimatch = require('minimatch');
    const filteredFiles = changedMdFiles.filter(filename => 
      minimatch(filename, targetFilesPattern)
    );
    
    core.info(`PRで変更されたMDファイル: ${filteredFiles.join(', ')}`);
    return filteredFiles;
    
  } catch (error) {
    core.warning(`PR変更ファイル取得エラー: ${error.message}`);
    // エラー時は従来の動作にフォールバック
    const glob = require('glob');
    return glob.sync(targetFilesPattern, { 
      ignore: ['node_modules/**', '.git/**', 'dist/**'],
      cwd: process.env.GITHUB_WORKSPACE || process.cwd()
    });
  }
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