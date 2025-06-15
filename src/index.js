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

    // デバッグ用ログ
    core.info(`校閲結果数: ${lintResults.length}`);
    
    // RDJson出力の詳細をログ出力（先頭の2行のみ）
    const lines = rdjsonResults.split('\n');
    core.info(`RDJson形式確認 (最初の2行):`);
    lines.slice(0, 2).forEach((line, index) => {
      if (line.trim()) {
        core.info(`Line ${index + 1}: ${line}`);
        try {
          const parsed = JSON.parse(line);
          core.info(`Line ${index + 1} parsed successfully: ${JSON.stringify(parsed, null, 2)}`);
        } catch (e) {
          core.error(`Line ${index + 1} JSON parse error: ${e.message}`);
        }
      }
    });

    // 5. reviewdogの実行
    const reviewdogFlags = [
      `-reporter=${reporter}`,
      `-level=${level}`,
      '-f=rdjson'
    ];

    try {
      // rdjsonlフォーマット（JSON Lines）を使用してみる
      const reviewdogFlagsJsonl = [
        `-reporter=${reporter}`,
        `-level=${level}`,
        '-f=rdjsonl'  // rdjsonlに変更
      ];

      await exec.exec(reviewdogPath, reviewdogFlagsJsonl, {
        env: { ...process.env, REVIEWDOG_GITHUB_API_TOKEN: githubToken },
        input: Buffer.from(rdjsonResults + '\n') // 末尾に改行を追加
      });
      
      core.info('校閲処理とreviewdogによるレポートが完了しました。');
    } catch (execError) {
      core.error(`reviewdog実行エラー: ${execError.message}`);
      core.error(`RDJson データ: ${rdjsonResults.substring(0, 500)}...`);
      throw execError;
    }

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
  const context = github.context;
  
  // PRイベントでない場合は従来の動作（全ファイル対象）
  if (context.eventName !== 'pull_request' && context.eventName !== 'pull_request_target') {
    const glob = require('glob');
    return glob.sync(targetFilesPattern, { 
      ignore: ['node_modules/**', '.git/**', 'dist/**'],
      cwd: process.env.GITHUB_WORKSPACE || process.cwd()
    });
  }
  
  // PRイベントの場合、環境変数からファイルリストを取得
  core.info(`GitHub Event: ${context.eventName}`);
  core.info(`PR Number: ${context.payload.pull_request?.number}`);
  
  try {
    // GitHub Actionsの環境では、actions/checkout@v4で変更ファイルを取得
    let changedFiles = [];
    
    // 方法1: git diff-treeを使用（より確実）
    const headSha = context.payload.pull_request?.head?.sha;
    const baseSha = context.payload.pull_request?.base?.sha;
    
    if (headSha && baseSha) {
      core.info(`Head SHA: ${headSha}, Base SHA: ${baseSha}`);
      
      const { stdout } = await exec.getExecOutput('git', [
        'diff-tree', '--no-commit-id', '--name-only', '-r', baseSha, headSha
      ]);
      
      changedFiles = stdout.trim().split('\n').filter(file => file);
    } else {
      // 方法2: git diff HEADを使用
      const { stdout } = await exec.getExecOutput('git', [
        'diff', '--name-only', 'HEAD~1', 'HEAD'
      ]);
      
      changedFiles = stdout.trim().split('\n').filter(file => file);
    }
    
    core.info(`Git diff結果: ${changedFiles.join(', ')}`);
    
    // .mdファイルのみフィルタ
    const changedMdFiles = changedFiles.filter(file => 
      file.endsWith('.md')
    );
    
    // targetFilesPatternでさらにフィルタ（globパターンマッチ）
    const minimatch = require('minimatch');
    const filteredFiles = changedMdFiles.filter(filename => 
      minimatch(filename, targetFilesPattern)
    );
    
    if (filteredFiles.length === 0) {
      core.info('PRで変更されたMDファイルがありません。');
      return [];
    }
    
    core.info(`PRで変更されたMDファイル: ${filteredFiles.join(', ')}`);
    return filteredFiles;
    
  } catch (error) {
    core.error(`PR変更ファイル取得エラー: ${error.message}`);
    core.error(`Error stack: ${error.stack}`);
    
    // エラー時は空配列を返す（全ファイル校閲を避ける）
    core.warning('PR変更ファイル取得に失敗したため、校閲をスキップします。');
    return [];
  }
}

function formatResultsForReviewdog(lintResults) {
  if (lintResults.length === 0) {
    return '';
  }

  const rdjsonLines = lintResults.map(result => {
    const diagnostic = {
      message: result.message || '',
      location: {
        path: result.filePath || '',
        range: {
          start: {
            line: parseInt(result.line) || 1,
            column: parseInt(result.column) || 1
          }
        }
      },
      severity: result.severity === 'error' ? 'ERROR' : 'WARNING'
    };

    // endの範囲指定がある場合のみ追加
    if (result.endLine && result.endColumn) {
      diagnostic.location.range.end = {
        line: parseInt(result.endLine),
        column: parseInt(result.endColumn)
      };
    }

    // sourceフィールドを追加（reviewdogの期待する形式）
    if (result.ruleId || result.rule) {
      diagnostic.source = {
        name: result.ruleId || result.rule || 'lint'
      };
    }

    return JSON.stringify(diagnostic);
  }).filter(line => line); // 空行を除去

  // JSON Lines形式で返す（各行が1つのJSON、末尾に改行なし）
  return rdjsonLines.join('\n');
}

run();