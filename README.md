# Cross Repo Sync Action

[![CI](https://github.com/NaokiOouchi/cross-repo-sync-action/actions/workflows/ci.yml/badge.svg)](https://github.com/NaokiOouchi/cross-repo-sync-action/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

GitHub Action to sync files from a source repository to multiple target repositories via pull requests.

**English** | [日本語](./README.ja.md)

## Use Cases

- Share Copilot instructions (`.github/copilot-instructions.md`) across repos
- Distribute shared lint/formatter configs (`.eslintrc`, `.prettierrc`)
- Sync Cursor rules (`.cursor/rules/`) or Claude Code rules
- Keep any shared files in sync across your organization

## Quick Start

### 1. Create a sync config

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

### 2. Add the workflow

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

### 3. Set up a PAT

Create a [Fine-grained Personal Access Token](https://github.com/settings/tokens?type=beta) with:
- **Repository access**: Select target repositories
- **Permissions**:
  - Contents: Read and write
  - Pull requests: Read and write

Add it as a repository secret named `PAT`.

## How It Works

1. Reads `sync-config.yml` to determine which files go where
2. For each target repo, compares source files against the target
3. If changes exist, creates a branch (`cross-repo-sync/update`) and opens a PR
4. On subsequent runs, updates the existing PR (no duplicates)
5. If no changes are needed, skips silently

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `token` | GitHub token with write access to target repos | Yes | - |
| `config-path` | Path to sync config file | No | `sync-config.yml` |
| `dry-run` | Log changes without creating PRs | No | `false` |
| `pr-title-prefix` | Prefix for PR titles | No | `chore: sync files from` |
| `commit-message-prefix` | Prefix for commit messages | No | `chore: sync files from` |

## Outputs

| Output | Description |
|--------|-------------|
| `pr-urls` | JSON array of created/updated PR URLs |
| `repos-synced` | Number of repositories that were synced |

## Config Reference

```yaml
sync:
  - src: path/to/source/file    # File path in this repository
    dest: path/in/target/repo    # Destination path in target repos
    repos:                       # List of target repositories
      - owner/repo-name
    delete: false                # (optional) Delete files in dest not in src
```

- `src` ending with `/` is treated as a directory (all files synced recursively)
- `delete: true` removes files in the target directory that don't exist in the source

## Examples

### Share Copilot instructions to all repos

```yaml
sync:
  - src: copilot-instructions.md
    dest: .github/copilot-instructions.md
    repos:
      - my-org/frontend
      - my-org/backend
      - my-org/mobile
```

### Distribute multiple config files

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

### Sync an entire directory

```yaml
sync:
  - src: configs/
    dest: .github/configs/
    repos:
      - my-org/frontend
      - my-org/backend
```

### Sync a directory and remove orphaned files

```yaml
sync:
  - src: configs/
    dest: .github/configs/
    delete: true
    repos:
      - my-org/frontend
```

Files in `.github/configs/` on the target that don't exist in `configs/` will be deleted.

### Dry run

```yaml
- uses: NaokiOouchi/cross-repo-sync-action@v1
  with:
    token: ${{ secrets.PAT }}
    dry-run: 'true'
```

## Authentication

### Personal Access Token (PAT)

The simplest setup. See [Quick Start](#3-set-up-a-pat) above.

PRs will be created as **your user account**.

### GitHub App (recommended for teams)

Using a GitHub App, PRs appear as a bot account (e.g., `my-sync-bot[bot]`).

1. [Create a GitHub App](https://github.com/settings/apps/new):
   - **Permissions**: Contents (Read & write), Pull requests (Read & write)
   - **Where can this app be installed?**: Only on this account
2. Install the app on your target repositories
3. Use [actions/create-github-app-token](https://github.com/actions/create-github-app-token) in your workflow:

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

## License

MIT
