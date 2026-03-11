import * as core from '@actions/core'
import * as github from '@actions/github'
import { createGitHubClient } from './github/client'
import { parseConfigFile } from './config/parser'
import { syncAllRepos } from './sync/coordinator'
import { validatePathWithinWorkspace } from './utils/validation'

export const run = async (): Promise<void> => {
  const token = core.getInput('token', { required: true })
  core.setSecret(token)

  const configPath = core.getInput('config-path')
  const dryRun = core.getBooleanInput('dry-run')
  const prTitlePrefix = core.getInput('pr-title-prefix')
  const commitMessagePrefix = core.getInput('commit-message-prefix')

  const sourceRepo = `${github.context.repo.owner}/${github.context.repo.repo}`
  const sourceSha = github.context.sha

  core.info(`Source repo: ${sourceRepo}`)
  core.info(`Source commit: ${sourceSha}`)
  core.info(`Config path: ${configPath}`)

  if (dryRun) {
    core.info('Running in DRY RUN mode')
  }

  const resolvedConfigPath = validatePathWithinWorkspace(configPath, 'config-path')
  const config = await parseConfigFile(resolvedConfigPath)
  const octokit = createGitHubClient(token)

  const results = await syncAllRepos(octokit, config, {
    dryRun,
    prTitlePrefix,
    commitMessagePrefix,
    sourceRepo,
    sourceSha,
  })

  const prUrls = results
    .filter((r) => r.pr)
    .map((r) => r.pr!.url)

  core.setOutput('pr-urls', JSON.stringify(prUrls))
  core.setOutput('repos-synced', results.filter((r) => r.status === 'success').length)

  const hasErrors = results.some((r) => r.status === 'error')
  if (hasErrors) {
    core.setFailed('Some repositories failed to sync. Check logs for details.')
  }
}

run().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  core.setFailed(message)
})
