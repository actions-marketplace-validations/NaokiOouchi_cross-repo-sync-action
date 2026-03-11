import { Octokit } from '@octokit/rest'
import { retry } from '@octokit/plugin-retry'

const OctokitWithRetry = Octokit.plugin(retry)

export const createGitHubClient = (token: string): Octokit => {
  return new OctokitWithRetry({ auth: token })
}
