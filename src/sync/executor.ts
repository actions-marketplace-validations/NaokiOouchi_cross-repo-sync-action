import * as fs from 'fs/promises'
import type { Octokit } from '@octokit/rest'
import type { RepoSyncPlan, SyncResult } from '../types'
import { getDefaultBranch, getBranchSha, createBranch, updateBranchRef } from '../github/branch'
import { getFileContent, createTreeWithFiles, createCommit } from '../github/content'
import { findExistingPR, createPR, updatePR } from '../github/pull-request'
import { computeFileChanges, hasChanges } from './differ'
import { BRANCH_NAME, PR_MARKER } from '../utils/constants'
import * as logger from '../utils/logger'

interface ExecutorOptions {
  readonly dryRun: boolean
  readonly prTitlePrefix: string
  readonly commitMessagePrefix: string
  readonly sourceRepo: string
  readonly sourceSha: string
}

export const syncRepo = async (
  octokit: Octokit,
  plan: RepoSyncPlan,
  options: ExecutorOptions
): Promise<SyncResult> => {
  const { owner, repo, repoFullName, files } = plan

  try {
    const sourceContents = await readSourceFiles(files.map((f) => f.src))

    const defaultBranch = await getDefaultBranch(octokit, owner, repo)
    const baseSha = await getBranchSha(octokit, owner, repo, defaultBranch)
    if (!baseSha) {
      throw new Error(`Could not get SHA for default branch: ${defaultBranch}`)
    }

    const targetContents = await fetchTargetContents(
      octokit,
      owner,
      repo,
      files.map((f) => f.dest),
      defaultBranch
    )

    const changes = computeFileChanges(files, sourceContents, targetContents)

    if (!hasChanges(changes)) {
      logger.info(`No changes needed for ${repoFullName}`)
      return { repoFullName, status: 'skipped', changes }
    }

    logChanges(repoFullName, changes)

    if (options.dryRun) {
      logger.info(`[DRY RUN] Would create PR for ${repoFullName}`)
      return { repoFullName, status: 'skipped', changes }
    }

    const existingPR = await findExistingPR(octokit, owner, repo, BRANCH_NAME)
    const existingBranchSha = await getBranchSha(octokit, owner, repo, BRANCH_NAME)

    // If sync branch exists, compare against it to avoid redundant commits
    if (existingBranchSha && existingPR) {
      const branchContents = await fetchTargetContents(
        octokit,
        owner,
        repo,
        files.map((f) => f.dest),
        BRANCH_NAME
      )
      const branchChanges = computeFileChanges(files, sourceContents, branchContents)
      if (!hasChanges(branchChanges)) {
        logger.info(`Sync branch already up to date for ${repoFullName}`)
        return {
          repoFullName,
          status: 'skipped',
          pr: existingPR,
          changes: branchChanges,
        }
      }
    }

    if (!existingBranchSha) {
      await createBranch(octokit, owner, repo, BRANCH_NAME, baseSha)
    } else {
      await updateBranchRef(octokit, owner, repo, BRANCH_NAME, baseSha)
    }

    const baseCommitData = await octokit.git.getCommit({
      owner,
      repo,
      commit_sha: baseSha,
    })
    const baseTreeSha = baseCommitData.data.tree.sha

    const treeSha = await createTreeWithFiles(octokit, owner, repo, baseTreeSha, changes)
    const commitMessage = buildCommitMessage(options, changes)
    const commitSha = await createCommit(octokit, owner, repo, commitMessage, treeSha, baseSha)
    await updateBranchRef(octokit, owner, repo, BRANCH_NAME, commitSha)

    const prBody = buildPRBody(options, changes)
    const prTitle = `${options.prTitlePrefix} ${options.sourceRepo}`

    const pr = existingPR
      ? await updatePR(octokit, owner, repo, existingPR.number, prTitle, prBody)
      : await createPR(octokit, owner, repo, prTitle, prBody, BRANCH_NAME, defaultBranch)

    logger.info(`PR ${existingPR ? 'updated' : 'created'}: ${pr.url}`)

    return { repoFullName, status: 'success', pr, changes }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`Failed to sync ${repoFullName}: ${message}`)
    return { repoFullName, status: 'error', changes: [], error: message }
  }
}

const readSourceFiles = async (
  paths: readonly string[]
): Promise<ReadonlyMap<string, string>> => {
  const entries = await Promise.all(
    paths.map(async (path) => {
      const content = await fs.readFile(path, 'utf-8')
      return [path, content] as const
    })
  )
  return new Map(entries)
}

const fetchTargetContents = async (
  octokit: Octokit,
  owner: string,
  repo: string,
  paths: readonly string[],
  ref: string
): Promise<ReadonlyMap<string, string | null>> => {
  const entries = await Promise.all(
    paths.map(async (path) => {
      const result = await getFileContent(octokit, owner, repo, path, ref)
      return [path, result?.content ?? null] as const
    })
  )
  return new Map(entries)
}

const logChanges = (
  repoFullName: string,
  changes: readonly { dest: string; status: string }[]
): void => {
  const actualChanges = changes.filter((c) => c.status !== 'unchanged')
  logger.info(
    `${repoFullName}: ${actualChanges.length} file(s) to sync`
  )
  for (const change of actualChanges) {
    logger.info(`  ${change.status}: ${change.dest}`)
  }
}

const buildCommitMessage = (
  options: ExecutorOptions,
  changes: readonly { dest: string; status: string }[]
): string => {
  const actualChanges = changes.filter((c) => c.status !== 'unchanged')
  const fileList = actualChanges.map((c) => `- ${c.dest}`).join('\n')

  return [
    `${options.commitMessagePrefix} ${options.sourceRepo}`,
    '',
    `Source commit: ${options.sourceSha}`,
    'Files synced:',
    fileList,
  ].join('\n')
}

const buildPRBody = (
  options: ExecutorOptions,
  changes: readonly { dest: string; status: string }[]
): string => {
  const actualChanges = changes.filter((c) => c.status !== 'unchanged')
  const rows = actualChanges
    .map((c) => `| \`${c.dest}\` | ${c.status} |`)
    .join('\n')

  return [
    '## Cross-Repo Sync',
    '',
    `This PR was automatically created by [cross-repo-sync-action](https://github.com/NaokiOouchi/cross-repo-sync-action).`,
    '',
    `**Source repository:** [${options.sourceRepo}](https://github.com/${options.sourceRepo})`,
    `**Source commit:** [${options.sourceSha.slice(0, 7)}](https://github.com/${options.sourceRepo}/commit/${options.sourceSha})`,
    '',
    '### Changes',
    '| File | Status |',
    '|------|--------|',
    rows,
    '',
    PR_MARKER,
  ].join('\n')
}
