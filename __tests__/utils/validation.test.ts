import { describe, it, expect } from 'vitest'
import { validateRelativePath, validateDestPath, validatePathWithinWorkspace } from '../../src/utils/validation'

describe('validateRelativePath', () => {
  it('should accept simple relative paths', () => {
    expect(validateRelativePath('rules/coding-style.md')).toBe(true)
    expect(validateRelativePath('file.md')).toBe(true)
    expect(validateRelativePath('.github/copilot-instructions.md')).toBe(true)
    expect(validateRelativePath('configs/')).toBe(true)
  })

  it('should reject absolute paths', () => {
    expect(validateRelativePath('/etc/passwd')).toBe(false)
    expect(validateRelativePath('/tmp/file.md')).toBe(false)
  })

  it('should reject paths with .. segments', () => {
    expect(validateRelativePath('../../../etc/passwd')).toBe(false)
    expect(validateRelativePath('foo/../../../etc/passwd')).toBe(false)
    expect(validateRelativePath('foo/..bar')).toBe(true) // ..bar is not ..
  })
})

describe('validateDestPath', () => {
  it('should accept safe paths', () => {
    expect(validateDestPath('.github/copilot-instructions.md')).toBe(true)
    expect(validateDestPath('configs/eslintrc.json')).toBe(true)
    expect(validateDestPath('.cursor/rules/security.md')).toBe(true)
  })

  it('should reject paths with backticks', () => {
    expect(validateDestPath('` | injected |')).toBe(false)
  })

  it('should reject paths with markdown special chars', () => {
    expect(validateDestPath('file[name].md')).toBe(false)
    expect(validateDestPath('file<script>.md')).toBe(false)
    expect(validateDestPath('file|pipe.md')).toBe(false)
  })
})

describe('validatePathWithinWorkspace', () => {
  it('should accept paths within workspace', () => {
    expect(() => validatePathWithinWorkspace('rules/file.md', 'src')).not.toThrow()
    expect(() => validatePathWithinWorkspace('configs/', 'src')).not.toThrow()
  })

  it('should reject paths that escape workspace', () => {
    expect(() => validatePathWithinWorkspace('/etc/passwd', 'src')).toThrow(
      'src must be within the workspace'
    )
    expect(() => validatePathWithinWorkspace('../../../etc/passwd', 'src')).toThrow(
      'src must be within the workspace'
    )
  })
})
