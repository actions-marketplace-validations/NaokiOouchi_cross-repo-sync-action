import * as path from 'path'

const getWorkspace = (): string => {
  return process.env.GITHUB_WORKSPACE ?? process.cwd()
}

export const validatePathWithinWorkspace = (
  filePath: string,
  label: string
): string => {
  const workspace = getWorkspace()
  const resolved = path.resolve(workspace, filePath)
  const workspaceResolved = path.resolve(workspace)

  if (!resolved.startsWith(workspaceResolved + path.sep) && resolved !== workspaceResolved) {
    throw new Error(`${label} must be within the workspace: ${filePath}`)
  }

  return resolved
}

export const validateRelativePath = (filePath: string): boolean => {
  if (path.isAbsolute(filePath)) {
    return false
  }

  const segments = filePath.split('/')
  return !segments.some((s) => s === '..')
}

const SAFE_PATH_REGEX = /^[a-zA-Z0-9\/._\- ]+$/

export const validateDestPath = (destPath: string): boolean => {
  return SAFE_PATH_REGEX.test(destPath)
}
