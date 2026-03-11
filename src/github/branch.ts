import type { Octokit } from '@octokit/rest'
import { isNotFoundError } from './errors'
import * as logger from '../utils/logger'

export const getDefaultBranch = async (
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<string> => {
  const { data } = await octokit.repos.get({ owner, repo })
  return data.default_branch
}

export const getBranchSha = async (
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string
): Promise<string | null> => {
  try {
    const { data } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    })
    return data.object.sha
  } catch (err: unknown) {
    if (isNotFoundError(err)) {
      return null
    }
    throw err
  }
}

export const createBranch = async (
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  sha: string
): Promise<void> => {
  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branch}`,
    sha,
  })
}

export const updateBranchRef = async (
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  sha: string
): Promise<void> => {
  logger.warn(`Force-updating branch ${branch} in ${owner}/${repo}`)
  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha,
    force: true,
  })
}
