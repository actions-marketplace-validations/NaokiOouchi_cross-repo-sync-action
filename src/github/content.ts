import type { Octokit } from '@octokit/rest'
import type { FileChange } from '../types'
import { isNotFoundError } from './errors'

export interface FileContent {
  readonly content: string
  readonly sha: string
}

export const getFileContent = async (
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<FileContent | null> => {
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref,
    })

    if (Array.isArray(data) || data.type !== 'file') {
      return null
    }

    const content = Buffer.from(data.content, 'base64').toString('utf-8')
    return { content, sha: data.sha }
  } catch (err: unknown) {
    if (isNotFoundError(err)) {
      return null
    }
    throw err
  }
}

export const createTreeWithFiles = async (
  octokit: Octokit,
  owner: string,
  repo: string,
  baseTreeSha: string,
  files: readonly FileChange[]
): Promise<string> => {
  const tree = files
    .filter((f) => f.status !== 'unchanged')
    .map((f) => ({
      path: f.dest,
      mode: '100644' as const,
      type: 'blob' as const,
      ...(f.status === 'deleted'
        ? { sha: null }
        : { content: f.content }),
    }))

  const { data } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree,
  })

  return data.sha
}

export const createCommit = async (
  octokit: Octokit,
  owner: string,
  repo: string,
  message: string,
  treeSha: string,
  parentSha: string
): Promise<string> => {
  const { data } = await octokit.git.createCommit({
    owner,
    repo,
    message,
    tree: treeSha,
    parents: [parentSha],
  })

  return data.sha
}

export const listDirectoryFiles = async (
  octokit: Octokit,
  owner: string,
  repo: string,
  dirPath: string,
  ref: string
): Promise<readonly string[]> => {
  try {
    return await listDirectoryFilesRecursively(octokit, owner, repo, dirPath, ref)
  } catch (err: unknown) {
    if (isNotFoundError(err)) {
      return []
    }
    throw err
  }
}

const listDirectoryFilesRecursively = async (
  octokit: Octokit,
  owner: string,
  repo: string,
  dirPath: string,
  ref: string
): Promise<readonly string[]> => {
  const { data } = await octokit.repos.getContent({
    owner,
    repo,
    path: dirPath,
    ref,
  })

  if (!Array.isArray(data)) {
    return [dirPath]
  }

  const nestedResults = await Promise.all(
    data.map(async (item) => {
      if (item.type === 'dir') {
        return listDirectoryFilesRecursively(octokit, owner, repo, item.path, ref)
      }
      return [item.path]
    })
  )
  return nestedResults.flat().sort()
}
