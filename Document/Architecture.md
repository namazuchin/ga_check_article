# 技術記事 校閲Action アーキテクチャ設計

## 1. 概要

このドキュメントは、GitHub Actionsで動作する技術ブログ記事校閲ツールのシステムアーキテクチャについて記述します。
このActionは、指定されたMarkdownファイルに対して校閲処理を実行し、誤字脱字、固有名詞の誤り、読みにくい箇所などを検出し、reviewdogを通じてPull Requestにフィードバックします。

## 2. システム構成

本システムは以下の要素で構成されます。

*   **校閲Actionリポジトリ (本リポジトリ)**:
    *   Node.jsで記述された校閲ロジック。
    *   `action.yml` で定義されたGitHub Action。
    *   `reviewdog` を利用して校閲結果をPRに通知。
*   **ブログ用リポジトリ (利用側)**:
    *   ユーザーがMarkdown形式で記事を管理。
    *   PR作成/更新時に、校閲Actionを呼び出すGitHub Actionsワークフローを設定。

## 3. 処理フロー

1.  **執筆者**: ブログ用リポジトリで記事のPRを作成または更新。
2.  **GitHub Actions (ブログ用リポジトリ)**: PRイベントをトリガーにワークフローが起動。
3.  **ワークフロー**:
    *   リポジトリをチェックアウト。
    *   (オプション) 変更のあったMarkdownファイルのみを特定。
    *   校閲Action (本リポジトリのAction) を呼び出す。入力として `github_token` や対象ファイルパスなどを渡す。
4.  **校閲Action (Node.js)**:
    *   Actionのエントリーポイント (`index.js`) が実行される。
    *   指定されたMarkdownファイルを取得。
    *   校閲ロジック（誤字脱字、固有名詞、表現、読みやすさ等）を実行。
        *   各種チェッカーは `src/checkers/` 以下にモジュールとして実装。
        *   カスタム辞書 (`custom_dict/`) を利用可能。
    *   校閲結果を `reviewdog` が解釈できる形式 (例: RDFormat, Checkstyle) で標準出力に出力。
5.  **reviewdog**:
    *   校閲Action内で `reviewdog` を実行。
    *   標準入力から校閲結果を受け取る。
    *   GitHub API を利用して、PRにコメントやアノテーションとしてフィードバックを投稿。
6.  **執筆者**: PR上で校閲結果を確認し、記事を修正。

## 4. 校閲ツールリポジトリのファイル＆フォルダ構成

```
.
├── action.yml               # GitHub Actionの定義ファイル
├── package.json             # Node.jsプロジェクトの定義、依存関係
├── package-lock.json        # 依存関係のロックファイル
├── dist/                    # ビルド後のJavaScriptファイル (nccなどでバンドル)
│   └── index.js             # Actionのエントリーポイント (バンドル後)
├── src/                     # Actionのソースコード (TypeScript or JavaScript)
│   ├── index.js             # Actionのエントリーポイント (ビルド前)
│   ├── main.js              # メインの校閲処理スクリプト
│   ├── checkers/            # 各種チェック機能ごとのモジュール
│   │   ├── typo_checker.js       # 誤字脱字チェック
│   │   ├── proper_noun_checker.js # 固有名詞チェック
│   │   └── readability_checker.js # 読みやすさチェック
│   └── utils.js             # 共通ユーティリティ
├── custom_dict/             # カスタム辞書ファイル
│   └── nouns.yml            # (例) 名詞リスト
├── .github/                 # GitHub関連ファイル
│   └── workflows/           # CI/CDワークフロー (例: Action自体のテスト、リリース)
│       └── main.yml
├── README.md                # Actionの説明、セットアップ方法、使用例 (利用者向け)
└── LICENSE                  # ライセンスファイル
```

## 5. 主要コンポーネントと技術スタック

*   **プログラミング言語**: Node.js (JavaScript または TypeScriptを推奨し、ビルドしてJavaScriptにする)
*   **主要ライブラリ/ツール**:
    *   `@actions/core`: GitHub Actionsの入出力、ログなどを扱うためのツールキット。
    *   `@actions/github`: GitHub APIクライアントとコンテキスト情報へのアクセス。
    *   `@vercel/ncc`: Node.jsプロジェクトを単一ファイルにコンパイル/バンドルするためのツール。依存関係を含めて `dist/index.js` を生成。
    *   `reviewdog`: 校閲結果をGitHub PRに統合するためのツール。各種リンターの出力をサポート。
    *   テキスト処理ライブラリ:
        *   `textlint` とその各種ルールプラグイン (推奨)
        *   形態素解析器 (例: `kuromoji.js`)
        *   その他、校閲要件に応じたNPMパッケージ
*   **実行環境**: GitHub Actionsランナー (通常は `ubuntu-latest`)

## 6. `action.yml` の主要項目 (案)

```yaml
name: 'Article Linter with reviewdog'
description: 'Lints Markdown articles and reports findings via reviewdog.'
author: 'Your Name/Organization'

inputs:
  github_token:
    description: 'GitHub token to post comments to PRs.'
    required: true
    default: '${{ github.token }}'
  target_files:
    description: 'Glob pattern for Markdown files to lint. Defaults to all .md files in the PR.'
    required: false
  custom_dictionary_path:
    description: 'Path to a custom dictionary file for proper noun checking.'
    required: false
  reviewdog_reporter:
    description: 'Reporter for reviewdog (e.g., github-pr-check, github-pr-review).'
    required: false
    default: 'github-pr-check' # Check Runとして報告
  reviewdog_level:
    description: 'Reporting level for reviewdog (info, warning, error).'
    required: false
    default: 'warning'
  # textlint_rules_path: (例)
  #   description: 'Path to textlint rules config file.'
  #   required: false

runs:
  using: 'node20' # または 'node16'
  main: 'dist/index.js'

branding:
  icon: 'check-circle'
  color: 'green'
```

## 7. 校閲ロジックの概要

`src/main.js` (またはそれに類するファイル) が中心となり、以下の処理を行う。

1.  **ファイル読み込み**: `target_files` で指定されたMarkdownファイルを読み込む。
2.  **チェッカーの実行**:
    *   **誤字脱字**: `textlint-rule-spellcheck-technical-word` や `textlint-rule-prh` などを活用。
    *   **固有名詞**: `custom_dictionary_path` で指定された辞書と照合。`textlint-rule-prh` でカスタム辞書を扱うことも可能。
    *   **表現・スタイル**: `textlint` の各種ルール (例: `textlint-rule-preset-japanese`, `textlint-rule-max-ten`, `textlint-rule-no-doubled-joshi` など) を適用。
    *   **読みやすさ**: 一文の長さ (`textlint-rule-sentence-length`)、漢字の割合などをチェック。
3.  **結果のフォーマット**: 各チェッカーからの指摘事項を `reviewdog` が解釈できる形式（RDFormat JSON Lines が推奨）に変換して標準出力へ。

    例 (RDFormat JSON Lines):
    ```json
    {"message":"一文が長すぎます(現在120文字、推奨80文字以下)","location":{"path":"src/sample.md","range":{"start":{"line":10,"column":1}}},"severity":"WARNING"}
    {"message":"「技術ブログ」の表記ゆれです。「技術ブログ」を推奨します。","location":{"path":"src/sample.md","range":{"start":{"line":15,"column":5},"end":{"line":15,"column":10}}},"severity":"ERROR","suggestions":[{"range":{"start":{"line":15,"column":5},"end":{"line":15,"column":10}},"text":"技術ブログ"}]}
    ```

## 8. reviewdog連携

Actionの `index.js` (エントリーポイント) 内で、`reviewdog` の実行ファイルをダウンロード・セットアップし、校閲スクリプトの出力をパイプで渡す。

```javascript
// src/index.js (概略)
const core = require('@actions/core');
const exec = require('@actions/exec');
const tc = require('@actions/tool-cache'); // reviewdogダウンロード用
const path = require('path');
const fs = require('fs');

async function run() {
  try {
    const githubToken = core.getInput('github_token', { required: true });
    const targetFiles = core.getInput('target_files'); // TODO: glob展開や変更ファイル取得
    const reporter = core.getInput('reviewdog_reporter') || 'github-pr-check';
    const level = core.getInput('reviewdog_level') || 'warning';

    // 1. reviewdogのセットアップ
    const reviewdogPath = await setupReviewdog();

    // 2. 校閲ロジックの実行と結果の出力 (この出力をreviewdogに渡す)
    //    ここでは仮に 'node src/main.js ${targetFiles}' のようなコマンドを実行し、
    //    その標準出力をreviewdogに渡すことを想定。
    //    実際にはmain.jsを直接呼び出し、その結果を文字列として受け取るなどする。
    let reviewdogOutput = '';
    const options = {
        listeners: {
            stdout: (data) => { reviewdogOutput += data.toString(); }
        },
        // cwd: process.env.GITHUB_WORKSPACE // 必要に応じて
    };
    // await exec.exec('node', [path.join(__dirname, 'main.js'), /* args for main.js */], options);
    // 上記の代わりに、main関数を直接呼び出す
    // const lintResults = await require('./main').lint(targetFiles, /* other options */);
    // reviewdogOutput = formatResultsForReviewdog(lintResults); // RDFormatに変換


    // 校閲スクリプト (例: src/main.js) がRDFormatで結果を標準出力するなら、
    // 以下のようにreviewdogを直接実行できる。
    const reviewdogFlags = [
        `-reporter=${reporter}`,
        `-level=${level}`,
        // `-filter-mode=nofilter` や `added` なども検討
        // PRの変更箇所のみを対象にする場合は `-diff="git diff FETCH_HEAD"` のような指定も可能
        // (ただし、checkout時にfetch-depth:0 が必要)
    ];

    // 校閲スクリプトを実行し、その出力をreviewdogに渡す
    // 方法1: シェルコマンドとして実行 (main.jsが実行可能で、結果を標準出力する場合)
    // const command = `node ${path.join(__dirname, '../src/main.js')} ${targetFilesGlob} | ${reviewdogPath} -f=rdjson ${reviewdogFlags.join(' ')}`;
    // await exec.exec('bash', ['-c', command], { env: { ...process.env, REVIEWDOG_GITHUB_API_TOKEN: githubToken } });

    // 方法2: main.jsを内部的に実行し、その出力をreviewdogのstdinに渡す
    const mainScriptPath = path.join(__dirname, '../src/main.js'); // nccでビルドされた場合、`../src/main.js` は `main.js` と同じ階層になる可能性あり
                                                                    // 実際にはmain.jsもバンドルに含めるか、別ファイルとして扱う

    // ここで src/main.js を実行し、その結果 (RDJSON文字列) を得る処理を実装
    // 例:
    // const rdjsonResults = await runMainScriptAndGetRdjson(mainScriptPath, targetFiles);
    // fs.writeFileSync('results.rdjson', rdjsonResults); // 一時ファイルに書き出す

    // reviewdogの実行
    // await exec.exec(reviewdogPath, [
    //     '-f=rdjson',
    //     ...reviewdogFlags,
    //     '-tee' // reviewdogのログも表示する場合
    // ], {
    //     env: { ...process.env, REVIEWDOG_GITHUB_API_TOKEN: githubToken },
    //     input: Buffer.from(rdjsonResults) // 文字列を標準入力として渡す
    //     // もしファイルから読むなら:
    //     // input: fs.createReadStream('results.rdjson')
    // });

    core.info('校閲処理とreviewdogによるレポートが完了しました。');

  } catch (error) {
    core.setFailed(error.message);
  }
}

async function setupReviewdog() {
  // reviewdogのバージョンやダウンロードURLを指定
  const version = '0.14.1'; // 例: 最新バージョンを確認して指定
  const downloadUrl = `https://github.com/reviewdog/reviewdog/releases/download/v${version}/reviewdog_${version}_linux_amd64.tar.gz`;
  const cachedPath = tc.find('reviewdog', version);
  if (cachedPath) {
    core.info(`Found in cache @ ${cachedPath}`);
    return path.join(cachedPath, 'reviewdog');
  }
  const reviewdogTarPath = await tc.downloadTool(downloadUrl);
  const reviewdogExtractedPath = await tc.extractTar(reviewdogTarPath, '/tmp/reviewdog_extracted'); // 展開先を指定
  const reviewdogBinPath = path.join(reviewdogExtractedPath, 'reviewdog'); // 展開後のバイナリパス

  // 実行権限を付与 (Windows以外)
  if (process.platform !== 'win32') {
    fs.chmodSync(reviewdogBinPath, '755');
  }
  const cachedDir = await tc.cacheFile(reviewdogBinPath, 'reviewdog', 'reviewdog', version);
  return path.join(cachedDir, 'reviewdog');
}

run();
```
上記の `src/index.js` の例は、`reviewdog` のセットアップと呼び出しの骨子です。実際の校閲ロジック (`src/main.js`) は別途実装し、RDFormatで結果を出力するようにします。

## 9. 今後の拡張性

*   より多くの校閲ルールへの対応。
*   機械学習を用いた高度な文章校正機能の導入。
*   ユーザーによるルールセットのカスタマイズ性の向上。 