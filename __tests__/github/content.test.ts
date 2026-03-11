import { describe, it, expect, vi } from 'vitest'
import type { Octokit } from '@octokit/rest'
import {
  getFileContent,
  createTreeWithFiles,
  createCommit,
  listDirectoryFiles,
} from '../../src/github/content'
import type { FileChange } from '../../src/types'

const createMockOctokit = (overrides = {}) => ({
  repos: { getContent: vi.fn() },
  git: { createTree: vi.fn(), createCommit: vi.fn() },
  ...overrides,
}) as unknown as Octokit

describe('getFileContent', () => {
  it('should return decoded content and sha for a file', async () => {
    const octokit = createMockOctokit()
    const mock = vi.mocked(octokit.repos.getContent)
    const encodedContent = Buffer.from('hello world').toString('base64')
    mock.mockResolvedValue({
      data: { type: 'file', content: encodedContent, sha: 'file-sha' },
    } as never)

    const result = await getFileContent(octokit, 'owner', 'repo', 'path/file.md', 'main')

    expect(result).toEqual({ content: 'hello world', sha: 'file-sha' })
    expect(mock).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      path: 'path/file.md',
      ref: 'main',
    })
  })

  it('should return null when file is not found (404)', async () => {
    const octokit = createMockOctokit()
    const mock = vi.mocked(octokit.repos.getContent)
    mock.mockRejectedValue({ status: 404 })

    const result = await getFileContent(octokit, 'owner', 'repo', 'missing.md')

    expect(result).toBeNull()
  })

  it('should return null when response is a directory (array)', async () => {
    const octokit = createMockOctokit()
    const mock = vi.mocked(octokit.repos.getContent)
    mock.mockResolvedValue({
      data: [{ type: 'file', name: 'a.md', path: 'dir/a.md' }],
    } as never)

    const result = await getFileContent(octokit, 'owner', 'repo', 'dir')

    expect(result).toBeNull()
  })

  it('should return null when response type is not file', async () => {
    const octokit = createMockOctokit()
    const mock = vi.mocked(octokit.repos.getContent)
    mock.mockResolvedValue({
      data: { type: 'dir', content: '', sha: 'sha' },
    } as never)

    const result = await getFileContent(octokit, 'owner', 'repo', 'dir')

    expect(result).toBeNull()
  })

  it('should throw for non-404 errors', async () => {
    const octokit = createMockOctokit()
    const mock = vi.mocked(octokit.repos.getContent)
    const error = new Error('Internal Server Error')
    Object.assign(error, { status: 500 })
    mock.mockRejectedValue(error)

    await expect(
      getFileContent(octokit, 'owner', 'repo', 'path.md')
    ).rejects.toThrow('Internal Server Error')
  })
})

describe('createTreeWithFiles', () => {
  it('should filter unchanged files and create tree', async () => {
    const octokit = createMockOctokit()
    const mock = vi.mocked(octokit.git.createTree)
    mock.mockResolvedValue({ data: { sha: 'tree-sha' } } as never)

    const files: readonly FileChange[] = [
      { dest: 'a.md', content: 'new content', status: 'created' },
      { dest: 'b.md', content: 'same', status: 'unchanged' },
      { dest: 'c.md', content: 'updated', status: 'updated' },
    ]

    const result = await createTreeWithFiles(octokit, 'owner', 'repo', 'base-tree-sha', files)

    expect(result).toBe('tree-sha')
    expect(mock).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      base_tree: 'base-tree-sha',
      tree: [
        { path: 'a.md', mode: '100644', type: 'blob', content: 'new content' },
        { path: 'c.md', mode: '100644', type: 'blob', content: 'updated' },
      ],
    })
  })

  it('should handle deleted files with sha: null', async () => {
    const octokit = createMockOctokit()
    const mock = vi.mocked(octokit.git.createTree)
    mock.mockResolvedValue({ data: { sha: 'tree-sha' } } as never)

    const files: readonly FileChange[] = [
      { dest: 'old.md', content: '', status: 'deleted' },
    ]

    const result = await createTreeWithFiles(octokit, 'owner', 'repo', 'base-tree-sha', files)

    expect(result).toBe('tree-sha')
    expect(mock).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      base_tree: 'base-tree-sha',
      tree: [
        { path: 'old.md', mode: '100644', type: 'blob', sha: null },
      ],
    })
  })
})

describe('createCommit', () => {
  it('should create a commit and return the sha', async () => {
    const octokit = createMockOctokit()
    const mock = vi.mocked(octokit.git.createCommit)
    mock.mockResolvedValue({ data: { sha: 'commit-sha' } } as never)

    const result = await createCommit(
      octokit, 'owner', 'repo', 'commit message', 'tree-sha', 'parent-sha'
    )

    expect(result).toBe('commit-sha')
    expect(mock).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      message: 'commit message',
      tree: 'tree-sha',
      parents: ['parent-sha'],
    })
  })
})

describe('listDirectoryFiles', () => {
  it('should return file paths for a directory', async () => {
    const octokit = createMockOctokit()
    const mock = vi.mocked(octokit.repos.getContent)
    mock.mockResolvedValue({
      data: [
        { type: 'file', name: 'a.md', path: 'dir/a.md' },
        { type: 'file', name: 'b.md', path: 'dir/b.md' },
      ],
    } as never)

    const result = await listDirectoryFiles(octokit, 'owner', 'repo', 'dir', 'main')

    expect(result).toEqual(['dir/a.md', 'dir/b.md'])
    expect(mock).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      path: 'dir',
      ref: 'main',
    })
  })

  it('should return empty array when directory is not found (404)', async () => {
    const octokit = createMockOctokit()
    const mock = vi.mocked(octokit.repos.getContent)
    mock.mockRejectedValue({ status: 404 })

    const result = await listDirectoryFiles(octokit, 'owner', 'repo', 'missing-dir', 'main')

    expect(result).toEqual([])
  })

  it('should recursively list files in subdirectories', async () => {
    const octokit = createMockOctokit()
    const mock = vi.mocked(octokit.repos.getContent)

    mock.mockImplementation((params: { path: string }) => {
      if (params.path === 'dir') {
        return Promise.resolve({
          data: [
            { type: 'file', name: 'a.md', path: 'dir/a.md' },
            { type: 'dir', name: 'sub', path: 'dir/sub' },
          ],
        }) as never
      }
      if (params.path === 'dir/sub') {
        return Promise.resolve({
          data: [
            { type: 'file', name: 'b.md', path: 'dir/sub/b.md' },
          ],
        }) as never
      }
      return Promise.reject({ status: 404 }) as never
    })

    const result = await listDirectoryFiles(octokit, 'owner', 'repo', 'dir', 'main')

    expect(result).toEqual(['dir/a.md', 'dir/sub/b.md'])
  })
})
