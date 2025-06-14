# 技術記事校閲Action

GitHub Actionsで動作するMarkdown形式の技術ブログ記事校閲ツールです。Pull Requestに対して自動的に校閲を実行し、reviewdog（コードレビュー自動化ツール）を通じてフィードバックを提供します。

## 機能

- **誤字脱字の検出**: 一般的な技術用語の誤記をチェック
- **固有名詞の表記ゆれ**: JavaScript、GitHub、AWS等の正しい表記を提案
- **読みやすさの改善**: 文の長さ、助詞の重複、読点の多用等をチェック
- **カスタム辞書対応**: プロジェクト固有の用語辞書を追加可能

## 使用方法

### 基本的な使用例

```yaml
name: Article Review
on:
  pull_request:
    paths:
      - '**/*.md'

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: namazuchin/ga_check_article@v1
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        target_files: 'articles/**/*.md'
```

### パラメーター

| パラメーター | 必須 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `github_token` | Yes | `${{ github.token }}` | GitHub API アクセス用トークン |
| `target_files` | No | `**/*.md` | 校閲対象のファイルパターン |
| `custom_dictionary_path` | No | - | カスタム辞書ファイルのパス |
| `reviewdog_reporter` | No | `github-pr-check` | reviewdog（コードレビュー自動化ツール）のレポーター設定 |
| `reviewdog_level` | No | `warning` | 報告レベル (info/warning/error) |

### カスタム辞書

YAML形式でカスタム辞書を作成できます：

```yaml
# custom_dict.yml
正しい表記:
  - 誤った表記1
  - 誤った表記2

JavaScript:
  - javascript
  - Javascript
```

## 開発

### ローカル環境でのセットアップ

```bash
npm install
npm run build
```

### テスト実行

```bash
npm test
```

## ライセンス

MIT License
