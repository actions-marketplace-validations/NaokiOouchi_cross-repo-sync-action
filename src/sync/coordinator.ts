import type { Octokit } from '@octokit/rest'
import type { SyncConfig, SyncResult } from '../types'
import { buildRepoSyncPlans } from '../config/parser'
import { syncRepo } from './executor'
import * as logger from '../utils/logger'

interface CoordinatorOptions {
  readonly dryRun: boolean
  readonly prTitlePrefix: string
  readonly commitMessagePrefix: string
  readonly sourceRepo: string
  readonly sourceSha: string
}

export const syncAllRepos = async (
  octokit: Octokit,
  config: SyncConfig,
  options: CoordinatorOptions
): Promise<readonly SyncResult[]> => {
  const plans = buildRepoSyncPlans(config)

  logger.info(`Syncing to ${plans.length} repository(ies)`)

  let results: readonly SyncResult[] = []
  for (const plan of plans) {
    logger.startGroup(`Syncing: ${plan.repoFullName}`)
    try {
      const result = await syncRepo(octokit, plan, options)
      results = [...results, result]
    } finally {
      logger.endGroup()
    }
  }

  logSummary(results)

  return results
}

const logSummary = (results: readonly SyncResult[]): void => {
  const success = results.filter((r) => r.status === 'success').length
  const skipped = results.filter((r) => r.status === 'skipped').length
  const errors = results.filter((r) => r.status === 'error').length

  logger.info('')
  logger.info('=== Sync Summary ===')
  logger.info(`Success: ${success}`)
  logger.info(`Skipped: ${skipped}`)
  logger.info(`Errors:  ${errors}`)

  const errorResults = results.filter((r) => r.status === 'error')
  for (const r of errorResults) {
    logger.error(`  ${r.repoFullName}: ${r.error}`)
  }
}
