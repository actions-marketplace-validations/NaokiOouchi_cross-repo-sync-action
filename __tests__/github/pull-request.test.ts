import { describe, it, expect, vi } from 'vitest'
import type { Octokit } from '@octokit/rest'
import { findExistingPR, createPR, updatePR } from '../../src/github/pull-request'
import { PR_LABEL } from '../../src/utils/constants'

const createMockOctokit = (overrides = {}) => ({
  pulls: { list: vi.fn(), create: vi.fn(), update: vi.fn() },
  issues: { addLabels: vi.fn() },
  ...overrides,
}) as unknown as Octokit

describe('findExistingPR', () => {
  it('should return PR info when an open PR exists', async () => {
    const octokit = createMockOctokit()
    const mock = vi.mocked(octokit.pulls.list)
    mock.mockResolvedValue({
      data: [
        { number: 42, html_url: 'https://github.com/owner/repo/pull/42', title: 'Sync PR' },
      ],
    } as never)

    const result = await findExistingPR(octokit, 'owner', 'repo', 'sync-branch')

    expect(result).toEqual({
      number: 42,
      url: 'https://github.com/owner/repo/pull/42',
      title: 'Sync PR',
    })
    expect(mock).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      head: 'owner:sync-branch',
      state: 'open',
      per_page: 1,
    })
  })

  it('should return null when no open PR exists', async () => {
    const octokit = createMockOctokit()
    const mock = vi.mocked(octokit.pulls.list)
    mock.mockResolvedValue({ data: [] } as never)

    const result = await findExistingPR(octokit, 'owner', 'repo', 'sync-branch')

    expect(result).toBeNull()
  })
})

describe('createPR', () => {
  it('should create a PR and add label', async () => {
    const octokit = createMockOctokit()
    const createMock = vi.mocked(octokit.pulls.create)
    const labelMock = vi.mocked(octokit.issues.addLabels)

    createMock.mockResolvedValue({
      data: {
        number: 99,
        html_url: 'https://github.com/owner/repo/pull/99',
        title: 'New Sync PR',
      },
    } as never)
    labelMock.mockResolvedValue({} as never)

    const result = await createPR(
      octokit, 'owner', 'repo', 'New Sync PR', 'PR body', 'head-branch', 'main'
    )

    expect(result).toEqual({
      number: 99,
      url: 'https://github.com/owner/repo/pull/99',
      title: 'New Sync PR',
    })
    expect(createMock).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      title: 'New Sync PR',
      body: 'PR body',
      head: 'head-branch',
      base: 'main',
    })
    expect(labelMock).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      issue_number: 99,
      labels: [PR_LABEL],
    })
  })

  it('should still succeed if adding label fails', async () => {
    const octokit = createMockOctokit()
    const createMock = vi.mocked(octokit.pulls.create)
    const labelMock = vi.mocked(octokit.issues.addLabels)

    createMock.mockResolvedValue({
      data: {
        number: 100,
        html_url: 'https://github.com/owner/repo/pull/100',
        title: 'PR Title',
      },
    } as never)
    labelMock.mockRejectedValue(new Error('No permission'))

    const result = await createPR(
      octokit, 'owner', 'repo', 'PR Title', 'body', 'head', 'main'
    )

    expect(result).toEqual({
      number: 100,
      url: 'https://github.com/owner/repo/pull/100',
      title: 'PR Title',
    })
  })
})

describe('updatePR', () => {
  it('should update an existing PR', async () => {
    const octokit = createMockOctokit()
    const mock = vi.mocked(octokit.pulls.update)
    mock.mockResolvedValue({
      data: {
        number: 42,
        html_url: 'https://github.com/owner/repo/pull/42',
        title: 'Updated Title',
      },
    } as never)

    const result = await updatePR(
      octokit, 'owner', 'repo', 42, 'Updated Title', 'Updated body'
    )

    expect(result).toEqual({
      number: 42,
      url: 'https://github.com/owner/repo/pull/42',
      title: 'Updated Title',
    })
    expect(mock).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      pull_number: 42,
      title: 'Updated Title',
      body: 'Updated body',
    })
  })
})
