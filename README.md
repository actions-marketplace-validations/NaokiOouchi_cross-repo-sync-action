# Cross Repo Sync Action

[![CI](https://github.com/NaokiOouchi/cross-repo-sync-action/actions/workflows/ci.yml/badge.svg)](https://github.com/NaokiOouchi/cross-repo-sync-action/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

GitHub Action to sync files from a source repository to multiple target repositories via pull requests.

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
```

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

### Dry run

```yaml
- uses: NaokiOouchi/cross-repo-sync-action@v1
  with:
    token: ${{ secrets.PAT }}
    dry-run: 'true'
```

## License

MIT
