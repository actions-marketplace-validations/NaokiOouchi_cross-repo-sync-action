import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Octokit } from '@octokit/rest'
import { syncRepo } from '../../src/sync/executor'
import type { RepoSyncPlan, FileChange } from '../../src/types'

vi.mock('../../src/github/branch', () => ({
  getDefaultBranch: vi.fn(),
  getBranchSha: vi.fn(),
  createBranch: vi.fn(),
  updateBranchRef: vi.fn(),
}))

vi.mock('../../src/github/content', () => ({
  getFileContent: vi.fn(),
  createTreeWithFiles: vi.fn(),
  createCommit: vi.fn(),
  listDirectoryFiles: vi.fn(),
}))

vi.mock('../../src/github/pull-request', () => ({
  findExistingPR: vi.fn(),
  createPR: vi.fn(),
  updatePR: vi.fn(),
}))

vi.mock('../../src/sync/differ', () => ({
  computeFileChanges: vi.fn(),
  computeOrphanedFiles: vi.fn(),
  hasChanges: vi.fn(),
}))

vi.mock('../../src/config/parser', () => ({
  expandDirectoryMappings: vi.fn(),
  getDirectoryDestPaths: vi.fn(),
}))

vi.mock('../../src/utils/validation', () => ({
  validatePathWithinWorkspace: vi.fn((path: string) => path),
}))

vi.mock('../../src/utils/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}))

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}))

import { getDefaultBranch, getBranchSha, createBranch, updateBranchRef } from '../../src/github/branch'
import { getFileContent, createTreeWithFiles, createCommit } from '../../src/github/content'
import { findExistingPR, createPR, updatePR } from '../../src/github/pull-request'
import { computeFileChanges, hasChanges } from '../../src/sync/differ'
import { expandDirectoryMappings, getDirectoryDestPaths } from '../../src/config/parser'
import { readFile } from 'fs/promises'

const createMockOctokit = () => ({
  repos: { get: vi.fn() },
  git: {
    getRef: vi.fn(),
    createRef: vi.fn(),
    updateRef: vi.fn(),
    createTree: vi.fn(),
    createCommit: vi.fn(),
    getCommit: vi.fn().mockResolvedValue({ data: { tree: { sha: 'base-tree-sha' } } }),
  },
  pulls: { list: vi.fn(), create: vi.fn(), update: vi.fn() },
  issues: { addLabels: vi.fn() },
}) as unknown as Octokit

const defaultPlan: RepoSyncPlan = {
  repoFullName: 'org/target-repo',
  owner: 'org',
  repo: 'target-repo',
  files: [{ src: 'src/file.md', dest: 'dest/file.md' }],
}

const defaultOptions = {
  dryRun: false,
  prTitlePrefix: 'chore: sync files from',
  commitMessagePrefix: 'chore: sync files from',
  sourceRepo: 'org/source-repo',
  sourceSha: 'abc1234567890',
}

const setupHappyPath = () => {
  vi.mocked(getDirectoryDestPaths).mockReturnValue([])
  vi.mocked(expandDirectoryMappings).mockResolvedValue([
    { src: 'src/file.md', dest: 'dest/file.md' },
  ])
  vi.mocked(readFile).mockResolvedValue('new content')
  vi.mocked(getDefaultBranch).mockResolvedValue('main')
  vi.mocked(getBranchSha)
    .mockResolvedValueOnce('base-sha')  // baseSha
    .mockResolvedValueOnce(null)         // existingBranchSha
  vi.mocked(getFileContent).mockResolvedValue(null)

  const changes: readonly FileChange[] = [
    { dest: 'dest/file.md', content: 'new content', status: 'created' },
  ]
  vi.mocked(computeFileChanges).mockReturnValue(changes)
  vi.mocked(hasChanges).mockReturnValue(true)
  vi.mocked(findExistingPR).mockResolvedValue(null)
  vi.mocked(createBranch).mockResolvedValue(undefined)
  vi.mocked(createTreeWithFiles).mockResolvedValue('tree-sha')
  vi.mocked(createCommit).mockResolvedValue('commit-sha')
  vi.mocked(updateBranchRef).mockResolvedValue(undefined)
  vi.mocked(createPR).mockResolvedValue({
    number: 1,
    url: 'https://github.com/org/target-repo/pull/1',
    title: 'chore: sync files from org/source-repo',
  })
}

describe('syncRepo', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should create a PR when changes exist (happy path)', async () => {
    const octokit = createMockOctokit()
    setupHappyPath()

    const result = await syncRepo(octokit, defaultPlan, defaultOptions)

    expect(result.status).toBe('success')
    expect(result.repoFullName).toBe('org/target-repo')
    expect(result.pr).toBeDefined()
    expect(result.pr?.number).toBe(1)
    expect(createBranch).toHaveBeenCalled()
    expect(createPR).toHaveBeenCalled()
  })

  it('should return skipped when no changes are needed', async () => {
    const octokit = createMockOctokit()
    vi.mocked(getDirectoryDestPaths).mockReturnValue([])
    vi.mocked(expandDirectoryMappings).mockResolvedValue([
      { src: 'src/file.md', dest: 'dest/file.md' },
    ])
    vi.mocked(readFile).mockResolvedValue('same content')
    vi.mocked(getDefaultBranch).mockResolvedValue('main')
    vi.mocked(getBranchSha).mockResolvedValueOnce('base-sha')
    vi.mocked(getFileContent).mockResolvedValue(null)
    vi.mocked(computeFileChanges).mockReturnValue([
      { dest: 'dest/file.md', content: 'same content', status: 'unchanged' },
    ])
    vi.mocked(hasChanges).mockReturnValue(false)

    const result = await syncRepo(octokit, defaultPlan, defaultOptions)

    expect(result.status).toBe('skipped')
    expect(createPR).not.toHaveBeenCalled()
  })

  it('should return skipped in dry run mode', async () => {
    const octokit = createMockOctokit()
    setupHappyPath()

    const result = await syncRepo(octokit, defaultPlan, {
      ...defaultOptions,
      dryRun: true,
    })

    expect(result.status).toBe('skipped')
    expect(createPR).not.toHaveBeenCalled()
    expect(createBranch).not.toHaveBeenCalled()
  })

  it('should return error status on API failure', async () => {
    const octokit = createMockOctokit()
    vi.mocked(getDirectoryDestPaths).mockReturnValue([])
    vi.mocked(expandDirectoryMappings).mockResolvedValue([
      { src: 'src/file.md', dest: 'dest/file.md' },
    ])
    vi.mocked(readFile).mockResolvedValue('content')
    vi.mocked(getDefaultBranch).mockRejectedValue(new Error('API rate limit exceeded'))

    const result = await syncRepo(octokit, defaultPlan, defaultOptions)

    expect(result.status).toBe('error')
    expect(result.error).toBe('API rate limit exceeded')
  })

  it('should update existing PR instead of creating a new one', async () => {
    const octokit = createMockOctokit()
    vi.mocked(getDirectoryDestPaths).mockReturnValue([])
    vi.mocked(expandDirectoryMappings).mockResolvedValue([
      { src: 'src/file.md', dest: 'dest/file.md' },
    ])
    vi.mocked(readFile).mockResolvedValue('new content')
    vi.mocked(getDefaultBranch).mockResolvedValue('main')
    vi.mocked(getBranchSha)
      .mockResolvedValueOnce('base-sha')    // baseSha
      .mockResolvedValueOnce('branch-sha')  // existingBranchSha
    vi.mocked(getFileContent).mockResolvedValue(null)

    const changes: readonly FileChange[] = [
      { dest: 'dest/file.md', content: 'new content', status: 'created' },
    ]
    vi.mocked(computeFileChanges)
      .mockReturnValueOnce(changes)   // against default branch
      .mockReturnValueOnce(changes)   // against sync branch (checkBranchUpToDate)
    vi.mocked(hasChanges)
      .mockReturnValueOnce(true)   // against default branch
      .mockReturnValueOnce(true)   // against sync branch
    vi.mocked(findExistingPR).mockResolvedValue({
      number: 42,
      url: 'https://github.com/org/target-repo/pull/42',
      title: 'Existing PR',
    })
    vi.mocked(updateBranchRef).mockResolvedValue(undefined)
    vi.mocked(createTreeWithFiles).mockResolvedValue('tree-sha')
    vi.mocked(createCommit).mockResolvedValue('commit-sha')
    vi.mocked(updatePR).mockResolvedValue({
      number: 42,
      url: 'https://github.com/org/target-repo/pull/42',
      title: 'Updated PR',
    })

    const result = await syncRepo(octokit, defaultPlan, defaultOptions)

    expect(result.status).toBe('success')
    expect(result.pr?.number).toBe(42)
    expect(updatePR).toHaveBeenCalled()
    expect(createPR).not.toHaveBeenCalled()
  })
})
