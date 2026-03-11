import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Octokit } from '@octokit/rest'
import { syncAllRepos } from '../../src/sync/coordinator'
import type { SyncConfig } from '../../src/types'

vi.mock('../../src/sync/executor', () => ({
  syncRepo: vi.fn(),
}))

vi.mock('../../src/config/parser', () => ({
  buildRepoSyncPlans: vi.fn(),
}))

vi.mock('../../src/utils/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  startGroup: vi.fn(),
  endGroup: vi.fn(),
}))

import { syncRepo } from '../../src/sync/executor'
import { buildRepoSyncPlans } from '../../src/config/parser'

const createMockOctokit = () => ({}) as unknown as Octokit

const defaultOptions = {
  dryRun: false,
  prTitlePrefix: 'chore: sync files from',
  commitMessagePrefix: 'chore: sync files from',
  sourceRepo: 'org/source-repo',
  sourceSha: 'abc1234567890',
}

const defaultConfig: SyncConfig = {
  sync: [
    { src: 'file.md', dest: 'dest.md', repos: ['org/repo-a', 'org/repo-b'] },
  ],
}

describe('syncAllRepos', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should sync multiple repos and return all results', async () => {
    const octokit = createMockOctokit()
    vi.mocked(buildRepoSyncPlans).mockReturnValue([
      { repoFullName: 'org/repo-a', owner: 'org', repo: 'repo-a', files: [{ src: 'file.md', dest: 'dest.md' }] },
      { repoFullName: 'org/repo-b', owner: 'org', repo: 'repo-b', files: [{ src: 'file.md', dest: 'dest.md' }] },
    ])

    vi.mocked(syncRepo)
      .mockResolvedValueOnce({
        repoFullName: 'org/repo-a',
        status: 'success',
        changes: [{ dest: 'dest.md', content: 'x', status: 'created' }],
        pr: { number: 1, url: 'https://github.com/org/repo-a/pull/1', title: 'PR' },
      })
      .mockResolvedValueOnce({
        repoFullName: 'org/repo-b',
        status: 'success',
        changes: [{ dest: 'dest.md', content: 'x', status: 'created' }],
        pr: { number: 2, url: 'https://github.com/org/repo-b/pull/2', title: 'PR' },
      })

    const results = await syncAllRepos(octokit, defaultConfig, defaultOptions)

    expect(results).toHaveLength(2)
    expect(results[0].status).toBe('success')
    expect(results[1].status).toBe('success')
    expect(syncRepo).toHaveBeenCalledTimes(2)
  })

  it('should continue syncing when one repo fails', async () => {
    const octokit = createMockOctokit()
    vi.mocked(buildRepoSyncPlans).mockReturnValue([
      { repoFullName: 'org/repo-a', owner: 'org', repo: 'repo-a', files: [{ src: 'file.md', dest: 'dest.md' }] },
      { repoFullName: 'org/repo-b', owner: 'org', repo: 'repo-b', files: [{ src: 'file.md', dest: 'dest.md' }] },
    ])

    vi.mocked(syncRepo)
      .mockResolvedValueOnce({
        repoFullName: 'org/repo-a',
        status: 'error',
        changes: [],
        error: 'API failure',
      })
      .mockResolvedValueOnce({
        repoFullName: 'org/repo-b',
        status: 'success',
        changes: [{ dest: 'dest.md', content: 'x', status: 'created' }],
        pr: { number: 2, url: 'https://github.com/org/repo-b/pull/2', title: 'PR' },
      })

    const results = await syncAllRepos(octokit, defaultConfig, defaultOptions)

    expect(results).toHaveLength(2)
    expect(results[0].status).toBe('error')
    expect(results[1].status).toBe('success')
    expect(syncRepo).toHaveBeenCalledTimes(2)
  })

  it('should return all skipped when no changes exist', async () => {
    const octokit = createMockOctokit()
    vi.mocked(buildRepoSyncPlans).mockReturnValue([
      { repoFullName: 'org/repo-a', owner: 'org', repo: 'repo-a', files: [{ src: 'file.md', dest: 'dest.md' }] },
      { repoFullName: 'org/repo-b', owner: 'org', repo: 'repo-b', files: [{ src: 'file.md', dest: 'dest.md' }] },
    ])

    vi.mocked(syncRepo)
      .mockResolvedValueOnce({
        repoFullName: 'org/repo-a',
        status: 'skipped',
        changes: [{ dest: 'dest.md', content: 'same', status: 'unchanged' }],
      })
      .mockResolvedValueOnce({
        repoFullName: 'org/repo-b',
        status: 'skipped',
        changes: [{ dest: 'dest.md', content: 'same', status: 'unchanged' }],
      })

    const results = await syncAllRepos(octokit, defaultConfig, defaultOptions)

    expect(results).toHaveLength(2)
    expect(results.every((r) => r.status === 'skipped')).toBe(true)
  })
})
