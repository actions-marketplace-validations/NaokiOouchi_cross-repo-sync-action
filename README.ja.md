# Cross Repo Sync Action

[![CI](https://github.com/NaokiOouchi/cross-repo-sync-action/actions/workflows/ci.yml/badge.svg)](https://github.com/NaokiOouchi/cross-repo-sync-action/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

ソースリポジトリのファイルを複数のターゲットリポジトリにPull Request経由で同期するGitHub Actionです。

[English](./README.md) | **日本語**

## ユースケース

- Copilotの指示ファイル (`.github/copilot-instructions.md`) を複数リポで共有
- lint/formatter設定 (`.eslintrc`, `.prettierrc`) を一括配布
- Cursorルール (`.cursor/rules/`) やClaude Codeルールの同期
- 組織内で共通ファイルを常に最新に保つ

## クイックスタート

### 1. 同期設定ファイルを作成

```yaml
# sync-config.yml
sync:
  - src: rules/coding-style.md
    dest: .github/copilot-instructions.md
    repos:
      - your-org/repo-a
      - your-org/repo-b

  - src: rules/security.md
    dest: .github/security.md
    repos:
      - your-org/repo-a
```

### 2. ワークフローを追加

```yaml
# .github/workflows/sync.yml
name: Sync Files

on:
  push:
    branches: [main]

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: NaokiOouchi/cross-repo-sync-action@v1
        with:
          token: ${{ secrets.PAT }}
```

### 3. PATを設定

[Fine-grained Personal Access Token](https://github.com/settings/tokens?type=beta) を作成します:
- **リポジトリアクセス**: ターゲットリポジトリを選択
- **権限**:
  - Contents: Read and write
  - Pull requests: Read and write

リポジトリのシークレットに `PAT` として追加してください。

## 仕組み

1. `sync-config.yml` を読み込み、どのファイルをどこに配るかを決定
2. ターゲットリポごとにソースファイルとターゲットを比較
3. 変更があればブランチ (`cross-repo-sync/update`) を作成しPRを開く
4. 再実行時は既存のPRを更新（重複PRは作られない）
5. 変更がなければスキップ

## 入力パラメータ

| パラメータ | 説明 | 必須 | デフォルト |
|-----------|------|------|-----------|
| `token` | ターゲットリポへの書き込み権限を持つGitHubトークン | はい | - |
| `config-path` | 同期設定ファイルのパス | いいえ | `sync-config.yml` |
| `dry-run` | PRを作成せずログのみ出力 | いいえ | `false` |
| `pr-title-prefix` | PRタイトルのプレフィックス | いいえ | `chore: sync files from` |
| `commit-message-prefix` | コミットメッセージのプレフィックス | いいえ | `chore: sync files from` |

## 出力

| 出力 | 説明 |
|------|------|
| `pr-urls` | 作成/更新されたPRのURLのJSON配列 |
| `repos-synced` | 同期されたリポジトリ数 |

## 設定リファレンス

```yaml
sync:
  - src: path/to/source/file    # このリポジトリ内のファイルパス
    dest: path/in/target/repo    # ターゲットリポでの配置先
    repos:                       # ターゲットリポジトリ一覧
      - owner/repo-name
    delete: false                # (任意) ソースにないファイルをターゲットから削除
```

- `src` の末尾が `/` の場合、ディレクトリとして扱い中のファイルを再帰的に同期
- `delete: true` でソースに存在しないターゲット側のファイルを削除

## 使用例

### Copilot指示ファイルを全リポに共有

```yaml
sync:
  - src: copilot-instructions.md
    dest: .github/copilot-instructions.md
    repos:
      - my-org/frontend
      - my-org/backend
      - my-org/mobile
```

### 複数の設定ファイルを配布

```yaml
sync:
  - src: configs/eslintrc.json
    dest: .eslintrc.json
    repos:
      - my-org/frontend
      - my-org/admin

  - src: configs/prettierrc.json
    dest: .prettierrc.json
    repos:
      - my-org/frontend
      - my-org/admin
      - my-org/backend

  - src: rules/security.md
    dest: .cursor/rules/security.md
    repos:
      - my-org/backend
```

### ディレクトリごと同期

```yaml
sync:
  - src: configs/
    dest: .github/configs/
    repos:
      - my-org/frontend
      - my-org/backend
```

### ディレクトリ同期 + 不要ファイル削除

```yaml
sync:
  - src: configs/
    dest: .github/configs/
    delete: true
    repos:
      - my-org/frontend
```

ターゲットの `.github/configs/` 内に存在するが、ソースの `configs/` に存在しないファイルは削除されます。

### ドライラン

```yaml
- uses: NaokiOouchi/cross-repo-sync-action@v1
  with:
    token: ${{ secrets.PAT }}
    dry-run: 'true'
```

## 認証

### Personal Access Token (PAT)

最もシンプルな方法です。上の[クイックスタート](#3-patを設定)を参照してください。

PRは**あなたのユーザーアカウント**で作成されます。

### GitHub App（チーム利用におすすめ）

GitHub Appを使うと、PRがボットアカウント（例: `my-sync-bot[bot]`）として作成されます。

1. [GitHub Appを作成](https://github.com/settings/apps/new):
   - **権限**: Contents (Read & write)、Pull requests (Read & write)
   - **インストール先**: Only on this account
2. ターゲットリポジトリにAppをインストール
3. ワークフローで [actions/create-github-app-token](https://github.com/actions/create-github-app-token) を使用:

```yaml
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/create-github-app-token@v1
        id: app-token
        with:
          app-id: ${{ vars.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}
          owner: your-org
          repositories: 'repo-a,repo-b'

      - uses: NaokiOouchi/cross-repo-sync-action@v1
        with:
          token: ${{ steps.app-token.outputs.token }}
```

## ライセンス

MIT
