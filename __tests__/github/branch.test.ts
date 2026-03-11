import { describe, it, expect, vi } from 'vitest'
import type { Octokit } from '@octokit/rest'
import { getDefaultBranch, getBranchSha, createBranch, updateBranchRef } from '../../src/github/branch'

vi.mock('../../src/utils/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}))

const createMockOctokit = (overrides = {}) => ({
  repos: { get: vi.fn() },
  git: { getRef: vi.fn(), createRef: vi.fn(), updateRef: vi.fn() },
  ...overrides,
}) as unknown as Octokit

describe('getDefaultBranch', () => {
  it('should return the default branch name', async () => {
    const octokit = createMockOctokit()
    const mock = vi.mocked(octokit.repos.get)
    mock.mockResolvedValue({ data: { default_branch: 'main' } } as never)

    const result = await getDefaultBranch(octokit, 'owner', 'repo')

    expect(result).toBe('main')
    expect(mock).toHaveBeenCalledWith({ owner: 'owner', repo: 'repo' })
  })
})

describe('getBranchSha', () => {
  it('should return the SHA when branch exists', async () => {
    const octokit = createMockOctokit()
    const mock = vi.mocked(octokit.git.getRef)
    mock.mockResolvedValue({
      data: { object: { sha: 'abc123' } },
    } as never)

    const result = await getBranchSha(octokit, 'owner', 'repo', 'main')

    expect(result).toBe('abc123')
    expect(mock).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      ref: 'heads/main',
    })
  })

  it('should return null when branch is not found (404)', async () => {
    const octokit = createMockOctokit()
    const mock = vi.mocked(octokit.git.getRef)
    mock.mockRejectedValue({ status: 404 })

    const result = await getBranchSha(octokit, 'owner', 'repo', 'nonexistent')

    expect(result).toBeNull()
  })

  it('should throw for non-404 errors', async () => {
    const octokit = createMockOctokit()
    const mock = vi.mocked(octokit.git.getRef)
    const error = new Error('Server Error')
    Object.assign(error, { status: 500 })
    mock.mockRejectedValue(error)

    await expect(
      getBranchSha(octokit, 'owner', 'repo', 'main')
    ).rejects.toThrow('Server Error')
  })
})

describe('createBranch', () => {
  it('should create a branch with the correct ref format', async () => {
    const octokit = createMockOctokit()
    const mock = vi.mocked(octokit.git.createRef)
    mock.mockResolvedValue({} as never)

    await createBranch(octokit, 'owner', 'repo', 'feature-branch', 'sha123')

    expect(mock).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      ref: 'refs/heads/feature-branch',
      sha: 'sha123',
    })
  })
})

describe('updateBranchRef', () => {
  it('should update the branch ref with force: true', async () => {
    const octokit = createMockOctokit()
    const mock = vi.mocked(octokit.git.updateRef)
    mock.mockResolvedValue({} as never)

    await updateBranchRef(octokit, 'owner', 'repo', 'feature-branch', 'sha456')

    expect(mock).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      ref: 'heads/feature-branch',
      sha: 'sha456',
      force: true,
    })
  })
})
