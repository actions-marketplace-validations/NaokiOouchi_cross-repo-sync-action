import * as fs from 'fs/promises'
import * as yaml from 'js-yaml'
import { syncConfigSchema } from './schema'
import { expandDirectoryMapping, isDirectoryPath } from '../utils/files'
import type { SyncConfig, RepoSyncPlan, RepoFileMapping } from '../types'

export const parseConfigFile = async (
  filePath: string
): Promise<SyncConfig> => {
  const content = await fs.readFile(filePath, 'utf-8')
  const raw = yaml.load(content, { schema: yaml.JSON_SCHEMA })
  return syncConfigSchema.parse(raw)
}

export const buildRepoSyncPlans = (config: SyncConfig): readonly RepoSyncPlan[] => {
  const repoMap = new Map<string, RepoFileMapping[]>()

  for (const mapping of config.sync) {
    for (const repoFullName of mapping.repos) {
      const existing = repoMap.get(repoFullName) ?? []
      repoMap.set(repoFullName, [
        ...existing,
        { src: mapping.src, dest: mapping.dest, delete: mapping.delete },
      ])
    }
  }

  return Array.from(repoMap.entries()).map(([repoFullName, files]) => {
    const [owner, repo] = repoFullName.split('/')
    return { repoFullName, owner, repo, files }
  })
}

export const expandDirectoryMappings = async (
  files: readonly RepoFileMapping[]
): Promise<readonly RepoFileMapping[]> => {
  const expanded = await Promise.all(
    files.map((f) => expandDirectoryMapping(f.src, f.dest, f.delete))
  )
  return expanded.flat()
}

export const getDirectoryDestPaths = (
  files: readonly RepoFileMapping[]
): readonly string[] => {
  return files
    .filter((f) => isDirectoryPath(f.src))
    .map((f) => f.dest)
}
